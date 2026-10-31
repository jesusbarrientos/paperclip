import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ProjectClonedRepository, ProjectWorkspace } from "@paperclipai/shared";
import { resolveManagedProjectWorkspaceDir } from "../home-paths.js";

const execFileAsync = promisify(execFile);
const REPO_ONLY_CWD_SENTINEL = "/__paperclip_repo_only__";
const GIT_TIMEOUT_MS = 10_000;

type WorkspaceInput = Pick<ProjectWorkspace, "id" | "name" | "cwd" | "repoUrl" | "companyId" | "projectId">;

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
  });
  return stdout;
}

function repoNameFromUrl(repoUrl: string | null): string | null {
  if (!repoUrl?.trim()) return null;
  try {
    const name = new URL(repoUrl.trim()).pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop()?.replace(/\.git$/i, "");
    return name || null;
  } catch {
    return null;
  }
}

async function isDirectory(target: string): Promise<boolean> {
  return fs.stat(target).then((entry) => entry.isDirectory()).catch(() => false);
}

async function originOf(cwd: string): Promise<string | null> {
  return git(cwd, ["remote", "get-url", "origin"]).then((out) => out.trim() || null).catch(() => null);
}

/**
 * Mirror the heartbeat's managed checkout resolution: the default dir, or a hash-suffixed
 * sibling when the default dir already holds a different repository.
 */
async function resolveManagedPath(workspace: WorkspaceInput): Promise<string> {
  const base = resolveManagedProjectWorkspaceDir({
    companyId: workspace.companyId,
    projectId: workspace.projectId,
    repoName: repoNameFromUrl(workspace.repoUrl),
  });
  if (!workspace.repoUrl) return base;
  const origin = await originOf(base);
  if (!origin || origin === workspace.repoUrl) return base;
  return `${base}-${createHash("sha256").update(workspace.repoUrl).digest("hex").slice(0, 12)}`;
}

export async function inspectClonedRepository(workspace: WorkspaceInput): Promise<ProjectClonedRepository> {
  const configured = workspace.cwd?.trim();
  const useConfigured = Boolean(configured && configured !== REPO_ONLY_CWD_SENTINEL);
  const repoPath = useConfigured ? path.resolve(configured!) : await resolveManagedPath(workspace);
  const result: ProjectClonedRepository = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    repoUrl: workspace.repoUrl,
    path: repoPath,
    location: useConfigured ? "configured" : "managed",
    status: "missing",
    branch: null,
    lastCommit: null,
    dirty: false,
    changedFileCount: 0,
    error: null,
  };
  if (!(await isDirectory(repoPath))) return result;
  const topLevel = await git(repoPath, ["rev-parse", "--show-toplevel"]).then((out) => out.trim()).catch(() => null);
  if (!topLevel) {
    result.status = "not_git";
    return result;
  }
  result.status = "cloned";
  try {
    const [branch, status, log] = await Promise.all([
      git(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]).then((out) => out.trim()).catch(() => null),
      git(repoPath, ["status", "--porcelain"]),
      git(repoPath, ["log", "-1", "--format=%H%x1f%s%x1f%an%x1f%cI"]).catch(() => ""),
    ]);
    result.branch = branch && branch !== "HEAD" ? branch : null;
    const changed = status.split("\n").filter((line) => line.trim().length > 0);
    result.changedFileCount = changed.length;
    result.dirty = changed.length > 0;
    const [sha, subject, authorName, committedAt] = log.trim().split("\x1f");
    if (sha && committedAt) result.lastCommit = { sha, subject: subject ?? "", authorName: authorName ?? "", committedAt };
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

export async function listProjectClonedRepositories(workspaces: WorkspaceInput[]): Promise<ProjectClonedRepository[]> {
  const relevant = workspaces.filter((workspace) =>
    Boolean(workspace.repoUrl?.trim()) || Boolean(workspace.cwd?.trim() && workspace.cwd !== REPO_ONLY_CWD_SENTINEL));
  return Promise.all(relevant.map((workspace) => inspectClonedRepository(workspace)));
}
