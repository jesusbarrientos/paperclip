import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { heartbeatRunEvents, heartbeatRuns, issues, machines, workContexts } from "@paperclipai/db";
import type { ExecutionLocation, WorkContext, WorkContextState } from "@paperclipai/shared";
import { conflict, forbidden, notFound, unprocessable } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";
import { isMachineConnected } from "./machine-connections.js";
import { canUseMachine, toMachine, type MachineViewer } from "./machines.js";

type WorkContextRow = typeof workContexts.$inferSelect;

/** Runs in these states own the workspace, so the developer side is read-only. */
export const EDIT_LOCKING_RUN_STATUSES = ["queued", "scheduled_retry", "running"] as const;

/** A VS Code window that stops reporting for this long is treated as closed. */
export const CLIENT_SESSION_TIMEOUT_MS = 90_000;

export class MachineExecutionUnavailableError extends Error {
  readonly code = "machine_disconnected";
  constructor(message: string) {
    super(message);
  }
}

export function toWorkContext(row: WorkContextRow, editLocked: boolean, lockRunId: string | null): WorkContext {
  return {
    id: row.id,
    issueId: row.issueId,
    machineId: row.machineId,
    status: row.status,
    active: row.active,
    fencingToken: row.fencingToken,
    editLocked,
    lockRunId,
    syncState: row.syncState,
    syncError: row.syncError,
    lastSnapshotSeq: row.lastSnapshotSeq,
    remotePath: row.remotePath,
    clientSessionId: row.clientSessionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function workContextService(db: Db) {
  async function getActiveRow(issueId: string) {
    return db
      .select()
      .from(workContexts)
      .where(and(eq(workContexts.issueId, issueId), eq(workContexts.active, true)))
      .then((rows) => rows[0] ?? null);
  }

  async function lockingRun(issueId: string) {
    return db
      .select({
        id: heartbeatRuns.id,
        status: heartbeatRuns.status,
        agentId: heartbeatRuns.agentId,
        executionMachineId: heartbeatRuns.executionMachineId,
        startedAt: heartbeatRuns.startedAt,
      })
      .from(heartbeatRuns)
      .where(
        and(
          sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issueId}`,
          inArray(heartbeatRuns.status, [...EDIT_LOCKING_RUN_STATUSES]),
        ),
      )
      .orderBy(desc(heartbeatRuns.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  async function requireIssue(issueId: string) {
    const issue = await db
      .select({ id: issues.id, assigneeAgentId: issues.assigneeAgentId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
    if (!issue) throw notFound("Issue not found");
    return issue;
  }

  function publish(issueId: string) {
    publishLiveEvent({ type: "work_context.updated", payload: { issueId } });
  }

  async function activate(issueId: string, machineId: string | null, extra: Partial<typeof workContexts.$inferInsert> = {}) {
    return db.transaction(async (tx) => {
      const current = await tx
        .select()
        .from(workContexts)
        .where(and(eq(workContexts.issueId, issueId), eq(workContexts.active, true)))
        .for("update")
        .then((rows) => rows[0] ?? null);
      if (current && current.machineId === machineId) {
        if (Object.keys(extra).length === 0) return current;
        const [updated] = await tx
          .update(workContexts)
          .set({ ...extra, updatedAt: new Date() })
          .where(eq(workContexts.id, current.id))
          .returning();
        return updated!;
      }
      if (current) {
        await tx
          .update(workContexts)
          .set({ active: false, status: "closed", updatedAt: new Date() })
          .where(eq(workContexts.id, current.id));
      }
      const [created] = await tx
        .insert(workContexts)
        .values({
          issueId,
          machineId,
          active: true,
          status: "active",
          fencingToken: (current?.fencingToken ?? 0) + 1,
          ...extra,
        })
        .returning();
      return created!;
    });
  }

  async function resolveMachineForViewer(location: ExecutionLocation, viewer: MachineViewer) {
    if (location.kind === "server") return null;
    const row = await db
      .select()
      .from(machines)
      .where(eq(machines.id, location.machineId))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Machine not found");
    if (!canUseMachine(row, viewer)) throw forbidden("You cannot run work on this machine");
    return row;
  }

  async function countPendingRuntimeRequests(runId: string) {
    const latest = await db
      .selectDistinctOn([sql`coalesce(
          ${heartbeatRunEvents.payload} #>> '{prpEvent,payload,request,requestId}',
          ${heartbeatRunEvents.payload} #>> '{prpEvent,payload,requestId}'
        )`], { eventType: heartbeatRunEvents.eventType })
      .from(heartbeatRunEvents)
      .where(and(eq(heartbeatRunEvents.runId, runId), sql`${heartbeatRunEvents.eventType} like 'runtime_request.%'`))
      .orderBy(
        sql`coalesce(
          ${heartbeatRunEvents.payload} #>> '{prpEvent,payload,request,requestId}',
          ${heartbeatRunEvents.payload} #>> '{prpEvent,payload,requestId}'
        )`,
        desc(heartbeatRunEvents.seq),
      );
    return latest.filter((row) => row.eventType === "runtime_request.created").length;
  }

  return {
    getActiveRow,
    lockingRun,

    async getState(issueId: string): Promise<WorkContextState> {
      await requireIssue(issueId);
      const [row, run] = await Promise.all([getActiveRow(issueId), lockingRun(issueId)]);
      const machine = row?.machineId
        ? await db.select().from(machines).where(eq(machines.id, row.machineId)).then((rows) => rows[0] ?? null)
        : null;
      const pending = run ? await countPendingRuntimeRequests(run.id) : 0;
      return {
        context: row ? toWorkContext(row, Boolean(run), run?.id ?? null) : null,
        machine: machine ? toMachine(machine) : null,
        run,
        pendingRuntimeRequestCount: pending,
        pendingInteractionCount: 0,
      };
    },

    async setLocation(issueId: string, location: ExecutionLocation, viewer: MachineViewer, clientSessionId?: string | null) {
      await requireIssue(issueId);
      const machine = await resolveMachineForViewer(location, viewer);
      const run = await lockingRun(issueId);
      const current = await getActiveRow(issueId);
      if (run && (current?.machineId ?? null) !== (machine?.id ?? null)) {
        throw conflict("A run is in progress for this issue. Use handoff to move it to another location.");
      }
      const row = await activate(issueId, machine?.id ?? null, {
        ...(clientSessionId !== undefined
          ? { clientSessionId, clientSessionSeenAt: clientSessionId ? new Date() : null }
          : {}),
        ...(machine?.workspaceRoot ? { remotePath: `${machine.workspaceRoot}/issues/${issueId}` } : {}),
      });
      publish(issueId);
      return row;
    },

    /**
     * Pick the environment for a run of this issue from its active context.
     * Returns null when the issue runs on the server. A machine that is
     * revoked or offline fails the run instead of silently moving the work.
     */
    async resolveRunEnvironment(issueId: string | null): Promise<{ machineId: string; environmentId: string } | null> {
      if (!issueId) return null;
      const context = await getActiveRow(issueId);
      if (!context?.machineId) return null;
      const machine = await db
        .select()
        .from(machines)
        .where(eq(machines.id, context.machineId))
        .then((rows) => rows[0] ?? null);
      if (!machine || machine.status !== "authorized" || !machine.environmentId) {
        throw new MachineExecutionUnavailableError(
          "machine_disconnected: the machine selected for this issue is no longer authorized. Choose another location.",
        );
      }
      if (!isMachineConnected(machine.id)) {
        throw new MachineExecutionUnavailableError(
          `machine_disconnected: ${machine.name} is offline. The work stays on that machine until it reconnects or you move it.`,
        );
      }
      return { machineId: machine.id, environmentId: machine.environmentId };
    },

    async markStatus(issueId: string, status: WorkContextRow["status"]) {
      const row = await getActiveRow(issueId);
      if (!row) return null;
      const [updated] = await db
        .update(workContexts)
        .set({ status, updatedAt: new Date() })
        .where(eq(workContexts.id, row.id))
        .returning();
      publish(issueId);
      return updated!;
    },

    async touchClientSession(clientSessionId: string) {
      await db
        .update(workContexts)
        .set({ clientSessionSeenAt: new Date() })
        .where(and(eq(workContexts.clientSessionId, clientSessionId), eq(workContexts.active, true)));
    },

    /** Contexts on machines whose VS Code window stopped reporting. */
    async listStaleClientSessionContexts(now = Date.now()) {
      return db
        .select()
        .from(workContexts)
        .where(
          and(
            eq(workContexts.active, true),
            eq(workContexts.status, "active"),
            isNotNull(workContexts.machineId),
            isNotNull(workContexts.clientSessionId),
            lt(workContexts.clientSessionSeenAt, new Date(now - CLIENT_SESSION_TIMEOUT_MS)),
          ),
        );
    },

    async listContextsForClientSession(clientSessionId: string) {
      return db
        .select()
        .from(workContexts)
        .where(and(eq(workContexts.clientSessionId, clientSessionId), eq(workContexts.active, true)));
    },

    async pauseContext(contextId: string) {
      const [updated] = await db
        .update(workContexts)
        .set({ status: "paused", clientSessionId: null, updatedAt: new Date() })
        .where(eq(workContexts.id, contextId))
        .returning();
      if (updated) publish(updated.issueId);
      return updated ?? null;
    },

    async resumeIfPaused(issueId: string) {
      const row = await getActiveRow(issueId);
      if (row?.status !== "paused") return;
      await db.update(workContexts).set({ status: "active", updatedAt: new Date() }).where(eq(workContexts.id, row.id));
      publish(issueId);
    },

    assertLocationAllowedForAgentWake(location: ExecutionLocation | null) {
      if (location && location.kind === "machine") {
        throw unprocessable("Agents cannot choose an execution machine");
      }
    },

    publish,
  };
}

export type WorkContextService = ReturnType<typeof workContextService>;
