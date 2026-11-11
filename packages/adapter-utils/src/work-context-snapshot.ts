import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GIT_SYNC_COMMIT_IDENTITY_ARGS } from "./git-workspace-sync.js";

/**
 * The snapshot git dir lives outside the work tree, so the work tree's own
 * `.git` (if any) is never read or written. `.gitignore` rules still apply.
 */
export interface SnapshotRepo {
  gitDir: string;
  workTree: string;
}

export const SNAPSHOT_LOCAL_REF = "refs/paperclip/local";
export const SNAPSHOT_EXPORT_REF = "refs/paperclip/export";
export const SNAPSHOT_INCOMING_REF = "refs/paperclip/incoming";
export const MIRROR_LATEST_REF = "refs/paperclip/latest";
export const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

const GIT_TIMEOUT_MS = 5 * 60_000;
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

export function mirrorSnapshotRef(seq: number) {
  return `refs/paperclip/wip/${seq}`;
}

function gitEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", ...extra };
}

export function runGit(args: string[], options: { env?: Record<string, string>; cwd?: string } = {}) {
  return new Promise<string>((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd: options.cwd, env: gitEnv(options.env), timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(new Error(`git failed: ${String(stderr || error.message).trim()}`), { stderr }));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function repoGit(repo: SnapshotRepo, args: string[], env: Record<string, string> = {}) {
  return runGit(["--git-dir", repo.gitDir, "--work-tree", repo.workTree, ...args], {
    cwd: repo.workTree,
    env: { GIT_INDEX_FILE: path.join(repo.gitDir, "paperclip-snapshot.index"), ...env },
  });
}

export async function resolveRef(gitDir: string, ref: string): Promise<string | null> {
  try {
    return (await runGit(["--git-dir", gitDir, "rev-parse", "--verify", "-q", `${ref}^{commit}`])).trim() || null;
  } catch {
    return null;
  }
}

export async function hasCommit(gitDir: string, sha: string) {
  try {
    await runGit(["--git-dir", gitDir, "cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

export async function ensureBareRepo(gitDir: string) {
  try {
    await fs.access(path.join(gitDir, "HEAD"));
  } catch {
    await fs.mkdir(path.dirname(gitDir), { recursive: true });
    await runGit(["init", "--bare", "-q", gitDir]);
  }
}

async function treeOf(gitDir: string, commit: string | null) {
  if (!commit) return EMPTY_TREE;
  return (await runGit(["--git-dir", gitDir, "rev-parse", `${commit}^{tree}`])).trim();
}

/** The index is persistent on purpose: it doubles as a stat cache, so unchanged files are not re-hashed. */
async function stageWorkTree(repo: SnapshotRepo) {
  await repoGit(repo, ["add", "-A", "--", "."]);
  return (await repoGit(repo, ["write-tree"])).trim();
}

export interface CreatedSnapshot {
  commit: string;
  changed: boolean;
}

export async function createSnapshot(repo: SnapshotRepo, message: string): Promise<CreatedSnapshot> {
  await ensureBareRepo(repo.gitDir);
  const parent = await resolveRef(repo.gitDir, SNAPSHOT_LOCAL_REF);
  const tree = await stageWorkTree(repo);
  if (parent && (await treeOf(repo.gitDir, parent)) === tree) return { commit: parent, changed: false };
  const commit = (
    await runGit(
      ["--git-dir", repo.gitDir, ...GIT_SYNC_COMMIT_IDENTITY_ARGS, "commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", message],
    )
  ).trim();
  await runGit(["--git-dir", repo.gitDir, "update-ref", SNAPSHOT_LOCAL_REF, commit]);
  return { commit, changed: true };
}

export async function createBundle(gitDir: string, commit: string, since: string | null): Promise<string | null> {
  if (since === commit) return null;
  await runGit(["--git-dir", gitDir, "update-ref", SNAPSHOT_EXPORT_REF, commit]);
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-bundle-")), "snapshot.bundle");
  const exclude = since && (await hasCommit(gitDir, since)) ? [`^${since}`] : [];
  await runGit(["--git-dir", gitDir, "bundle", "create", "-q", file, SNAPSHOT_EXPORT_REF, ...exclude]);
  return file;
}

export async function removeBundle(file: string | null) {
  if (file) await fs.rm(path.dirname(file), { recursive: true, force: true });
}

export async function fetchBundle(gitDir: string, bundleFile: string, ref: string, expectedCommit: string) {
  await runGit(["--git-dir", gitDir, "fetch", "-q", "--no-tags", bundleFile, `+${SNAPSHOT_EXPORT_REF}:${ref}`]);
  const fetched = await resolveRef(gitDir, ref);
  if (fetched !== expectedCommit) {
    throw new Error(`snapshot_commit_mismatch: bundle carries ${fetched ?? "nothing"}, expected ${expectedCommit}`);
  }
}

export type ApplySnapshotResult =
  | { status: "applied"; commit: string }
  | { status: "unchanged"; commit: string }
  | { status: "conflict"; commit: string; localChanges: string[] };

/** Local edits since the last synced snapshot are never overwritten; the incoming commit waits under SNAPSHOT_INCOMING_REF. */
export async function applySnapshot(repo: SnapshotRepo, bundleFile: string | null, commit: string): Promise<ApplySnapshotResult> {
  await ensureBareRepo(repo.gitDir);
  await fs.mkdir(repo.workTree, { recursive: true });
  if (bundleFile) await fetchBundle(repo.gitDir, bundleFile, SNAPSHOT_INCOMING_REF, commit);
  else if (!(await hasCommit(repo.gitDir, commit))) throw new Error(`snapshot_missing: ${commit} is not available locally`);

  const baseline = await resolveRef(repo.gitDir, SNAPSHOT_LOCAL_REF);
  if (baseline === commit) return { status: "unchanged", commit };
  const baselineTree = await treeOf(repo.gitDir, baseline);
  const currentTree = await stageWorkTree(repo);
  if (currentTree !== baselineTree) {
    const changed = await runGit(["--git-dir", repo.gitDir, "diff-tree", "-r", "--name-only", baselineTree, currentTree]);
    return { status: "conflict", commit, localChanges: changed.split("\n").filter(Boolean).slice(0, 200) };
  }
  // Two-tree read-tree moves the work tree from the baseline to the target and only touches paths that differ.
  await repoGit(repo, ["read-tree", "-m", "-u", baselineTree, commit]);
  await runGit(["--git-dir", repo.gitDir, "update-ref", SNAPSHOT_LOCAL_REF, commit]);
  return { status: "applied", commit };
}
