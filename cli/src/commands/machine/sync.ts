import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applySnapshot,
  createBundle,
  createSnapshot,
  hasCommit,
  removeBundle,
  resolveRef,
  SNAPSHOT_LOCAL_REF,
  type SnapshotRepo,
} from "@paperclipai/adapter-utils/work-context-snapshot";
import {
  MACHINE_FENCING_TOKEN_HEADER,
  MACHINE_SNAPSHOT_COMMIT_HEADER,
  MACHINE_SNAPSHOT_SEQ_HEADER,
  type MachineContextMaterializeParams,
  type MachineContextMaterializeResult,
  type MachineContextSnapshotParams,
  type MachineContextSnapshotResult,
} from "@paperclipai/shared";

export interface SyncDeps {
  serverUrl: string;
  headers: Record<string, string>;
  workspaceRoot: string;
  fetch?: typeof fetch;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The server names the path, but the daemon only ever touches directories under its own workspace root. */
export function syncRepoFor(deps: Pick<SyncDeps, "workspaceRoot">, issueId: string, workPath: string): SnapshotRepo {
  if (!UUID_PATTERN.test(issueId)) throw new Error("issueId must be a uuid");
  const root = path.resolve(deps.workspaceRoot);
  const workTree = path.resolve(workPath);
  const relative = path.relative(root, workTree);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to sync ${workTree}: it is outside the machine workspace root ${root}`);
  }
  return { gitDir: path.join(root, ".paperclip-sync", `${issueId}.git`), workTree };
}

function snapshotUrl(serverUrl: string, issueId: string, suffix: string) {
  return `${serverUrl.replace(/\/+$/, "")}/api/machines/v1/issues/${encodeURIComponent(issueId)}/snapshots/${suffix}`;
}

async function failure(response: Response) {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {}
  return text.slice(0, 500) || `HTTP ${response.status}`;
}

export async function snapshotContext(
  params: MachineContextSnapshotParams,
  deps: SyncDeps,
): Promise<MachineContextSnapshotResult> {
  const repo = syncRepoFor(deps, params.issueId, params.path);
  await fs.mkdir(repo.workTree, { recursive: true });
  // A replica that never received the mirror's latest snapshot would publish
  // an older line of work on top of it and hide the newer changes.
  const baseline = await resolveRef(repo.gitDir, SNAPSHOT_LOCAL_REF).catch(() => null);
  if (params.since && baseline !== params.since) {
    throw new Error("replica_out_of_date: this machine does not have the latest snapshot; bring it up to date before syncing");
  }
  const created = await createSnapshot(repo, `Paperclip snapshot ${params.seq}`);
  const bundle = await createBundle(repo.gitDir, created.commit, params.since);
  if (!bundle) return { changed: false, commit: created.commit, seq: params.seq - 1 };
  try {
    const response = await (deps.fetch ?? fetch)(snapshotUrl(deps.serverUrl, params.issueId, String(params.seq)), {
      method: "PUT",
      headers: {
        ...deps.headers,
        "content-type": "application/octet-stream",
        [MACHINE_SNAPSHOT_COMMIT_HEADER]: created.commit,
        [MACHINE_FENCING_TOKEN_HEADER]: String(params.fencingToken),
      },
      body: await fs.readFile(bundle),
    });
    if (!response.ok) throw new Error(`snapshot upload failed: ${await failure(response)}`);
  } finally {
    await removeBundle(bundle);
  }
  return { changed: true, commit: created.commit, seq: params.seq };
}

export async function materializeContext(
  params: MachineContextMaterializeParams,
  deps: SyncDeps,
): Promise<MachineContextMaterializeResult> {
  const repo = syncRepoFor(deps, params.issueId, params.path);
  await fs.mkdir(path.dirname(repo.gitDir), { recursive: true });
  let bundle: string | null = null;
  let commit = params.commit;
  try {
    if (!(await hasCommit(repo.gitDir, params.commit).catch(() => false))) {
      const have = await resolveRef(repo.gitDir, SNAPSHOT_LOCAL_REF).catch(() => null);
      const response = await (deps.fetch ?? fetch)(
        `${snapshotUrl(deps.serverUrl, params.issueId, "latest")}${have ? `?have=${have}` : ""}`,
        { headers: deps.headers },
      );
      if (!response.ok) throw new Error(`snapshot download failed: ${await failure(response)}`);
      commit = response.headers.get(MACHINE_SNAPSHOT_COMMIT_HEADER) ?? params.commit;
      const seq = Number(response.headers.get(MACHINE_SNAPSHOT_SEQ_HEADER));
      if (Number.isFinite(seq) && seq < params.seq) throw new Error(`snapshot ${params.seq} is not on the server yet`);
      if (response.status === 204) return await applySnapshot(repo, null, commit);
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-bundle-"));
      bundle = path.join(dir, "snapshot.bundle");
      await fs.writeFile(bundle, Buffer.from(await response.arrayBuffer()));
    }
    return await applySnapshot(repo, bundle, commit);
  } finally {
    await removeBundle(bundle);
  }
}
