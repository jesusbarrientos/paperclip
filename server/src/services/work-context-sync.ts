import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { workContexts } from "@paperclipai/db";
import {
  createBundle,
  ensureBareRepo,
  fetchBundle,
  MIRROR_LATEST_REF,
  mirrorSnapshotRef,
  removeBundle,
  resolveRef,
  runGit,
} from "@paperclipai/adapter-utils/work-context-snapshot";
import type {
  MachineContextMaterializeResult,
  MachineContextSnapshotResult,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { resolvePaperclipInstanceRoot } from "../home-paths.js";
import { callMachineRpc, isMachineConnected } from "./machine-connections.js";
import { workContextService } from "./work-contexts.js";

const SYNC_RPC_TIMEOUT_MS = 10 * 60_000;

export interface MirrorSnapshot {
  seq: number;
  commit: string;
}

/** One bare mirror per issue, not per context: a handoff creates a new context row but keeps the history. */
export function workContextMirrorDir(issueId: string) {
  return path.resolve(resolvePaperclipInstanceRoot(), "data", "work-context-mirrors", `${issueId}.git`);
}

function serialize<T>(locks: Map<string, Promise<unknown>>, issueId: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(issueId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(fn);
  locks.set(issueId, next);
  // `finally` re-rejects; without the catch a failed upload is an unhandled rejection that stops the process.
  void next
    .finally(() => {
      if (locks.get(issueId) === next) locks.delete(issueId);
    })
    .catch(() => undefined);
  return next;
}

const issueLocks = new Map<string, Promise<unknown>>();
const moveLocks = new Map<string, Promise<unknown>>();

/** Serializes mirror writes per issue; concurrent bundle creation would race on the export ref. */
function withIssueLock<T>(issueId: string, fn: () => Promise<T>): Promise<T> {
  return serialize(issueLocks, issueId, fn);
}

/**
 * Serializes moves and snapshots of one issue's work. A move that overtakes a
 * snapshot in flight bumps the fencing token, so the server rejects that
 * upload and the source's last changes never reach the mirror. It must stay
 * separate from `withIssueLock`: a snapshot held here waits on an upload that
 * takes that lock.
 */
export function withWorkContextMove<T>(issueId: string, fn: () => Promise<T>): Promise<T> {
  return serialize(moveLocks, issueId, fn);
}

export async function latestMirrorSnapshot(issueId: string): Promise<MirrorSnapshot | null> {
  const gitDir = workContextMirrorDir(issueId);
  const commit = await resolveRef(gitDir, MIRROR_LATEST_REF);
  if (!commit) return null;
  const refs = await runGit(["--git-dir", gitDir, "for-each-ref", "--format=%(refname)", "refs/paperclip/wip/"]);
  const seq = Math.max(
    0,
    ...refs
      .split("\n")
      .map((ref) => Number(ref.split("/").at(-1)))
      .filter(Number.isInteger),
  );
  return { seq, commit };
}

export function workContextSyncService(db: Db) {
  const contexts = workContextService(db);

  async function setSync(contextId: string, issueId: string, values: Partial<typeof workContexts.$inferInsert>) {
    await db.update(workContexts).set({ ...values, updatedAt: new Date() }).where(eq(workContexts.id, contextId));
    contexts.publish(issueId);
  }

  async function requireMachineContext(issueId: string) {
    const row = await contexts.getActiveRow(issueId);
    if (!row?.machineId) throw conflict("The work for this issue is not on a machine");
    if (!row.remotePath) throw unprocessable("The machine has not reported its workspace root yet");
    if (!isMachineConnected(row.machineId)) throw conflict("machine_disconnected: the machine holding the work is offline");
    return row as typeof row & { machineId: string; remotePath: string };
  }

  return {
    /** Re-sending the same seq and commit is a no-op, so a daemon can retry an upload safely. */
    async acceptUpload(input: {
      issueId: string;
      machineId: string;
      seq: number;
      commit: string;
      fencingToken: number;
      bundle: Buffer;
    }): Promise<MirrorSnapshot> {
      return withIssueLock(input.issueId, async () => {
        const row = await contexts.getActiveRow(input.issueId);
        if (!row || row.machineId !== input.machineId || row.fencingToken !== input.fencingToken) {
          throw conflict("stale_fencing_token: this machine no longer holds the work for the issue");
        }
        const gitDir = workContextMirrorDir(input.issueId);
        await ensureBareRepo(gitDir);
        const latest = await latestMirrorSnapshot(input.issueId);
        const latestSeq = latest?.seq ?? 0;
        if (input.seq <= latestSeq) {
          if ((await resolveRef(gitDir, mirrorSnapshotRef(input.seq))) === input.commit) {
            return { seq: input.seq, commit: input.commit };
          }
          throw conflict(`Snapshot ${input.seq} already exists with different content`);
        }
        if (input.seq !== latestSeq + 1) throw conflict(`Expected snapshot ${latestSeq + 1}, got ${input.seq}`);
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-upload-"));
        const file = path.join(dir, "snapshot.bundle");
        try {
          await fs.writeFile(file, input.bundle);
          await fetchBundle(gitDir, file, mirrorSnapshotRef(input.seq), input.commit);
        } finally {
          await fs.rm(dir, { recursive: true, force: true });
        }
        await runGit(["--git-dir", gitDir, "update-ref", MIRROR_LATEST_REF, input.commit]);
        await setSync(row.id, input.issueId, { lastSnapshotSeq: input.seq });
        return { seq: input.seq, commit: input.commit };
      });
    },

    async latestBundle(issueId: string, machineId: string, have: string | null) {
      const row = await contexts.getActiveRow(issueId);
      if (!row || row.machineId !== machineId) throw notFound("No work context for this machine");
      return withIssueLock(issueId, async () => {
        const latest = await latestMirrorSnapshot(issueId);
        if (!latest) throw notFound("No snapshot has been stored for this issue");
        const file = await createBundle(workContextMirrorDir(issueId), latest.commit, have);
        return { ...latest, file };
      });
    },

    removeBundle,

    async snapshotFromMachine(issueId: string): Promise<MachineContextSnapshotResult> {
      const row = await requireMachineContext(issueId);
      const latest = await latestMirrorSnapshot(issueId);
      await setSync(row.id, issueId, { syncState: "syncing", syncError: null });
      try {
        const result = (await callMachineRpc(
          row.machineId,
          "context.snapshot",
          {
            issueId,
            path: row.remotePath,
            fencingToken: row.fencingToken,
            seq: (latest?.seq ?? 0) + 1,
            since: latest?.commit ?? null,
          },
          SYNC_RPC_TIMEOUT_MS,
        )) as MachineContextSnapshotResult;
        await setSync(row.id, issueId, { syncState: "up_to_date", syncError: null });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await setSync(row.id, issueId, { syncState: "error", syncError: message });
        throw conflict(`Machine sync failed: ${message}`);
      }
    },

    async materializeOnMachine(issueId: string): Promise<MachineContextMaterializeResult | null> {
      const row = await requireMachineContext(issueId);
      const latest = await latestMirrorSnapshot(issueId);
      if (!latest) return null;
      await setSync(row.id, issueId, { syncState: "syncing", syncError: null, lastSnapshotSeq: latest.seq });
      try {
        const result = (await callMachineRpc(
          row.machineId,
          "context.materialize",
          { issueId, path: row.remotePath, seq: latest.seq, commit: latest.commit },
          SYNC_RPC_TIMEOUT_MS,
        )) as MachineContextMaterializeResult;
        if (result.status === "conflict") {
          await setSync(row.id, issueId, {
            syncState: "conflict",
            syncError: `Local changes would be overwritten: ${result.localChanges.slice(0, 10).join(", ")}`,
          });
        } else {
          await setSync(row.id, issueId, { syncState: "up_to_date", syncError: null });
        }
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await setSync(row.id, issueId, { syncState: "error", syncError: message });
        throw conflict(`Machine sync failed: ${message}`);
      }
    },

    async activeMachineContextForRun(issueId: string, machineId: string) {
      return db
        .select()
        .from(workContexts)
        .where(and(eq(workContexts.issueId, issueId), eq(workContexts.active, true), eq(workContexts.machineId, machineId)))
        .then((rows) => rows[0] ?? null);
    },
  };
}

export type WorkContextSyncService = ReturnType<typeof workContextSyncService>;
