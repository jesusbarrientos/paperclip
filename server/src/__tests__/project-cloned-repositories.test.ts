import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listProjectClonedRepositories } from "../services/project-cloned-repositories.js";

const base = { companyId: "company-1", projectId: "project-1" };
let root: string;

function git(cwd: string, ...args: string[]) {
  execFileSync("git", ["-C", cwd, "-c", "user.name=Tester", "-c", "user.email=t@example.com", ...args], { stdio: "pipe" });
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cloned-repos-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("listProjectClonedRepositories", () => {
  it("reports branch, last commit and uncommitted changes for a configured checkout", async () => {
    const repo = path.join(root, "repo");
    await fs.mkdir(repo);
    git(repo, "init", "-b", "main");
    await fs.writeFile(path.join(repo, "a.txt"), "a");
    git(repo, "add", ".");
    git(repo, "commit", "-m", "first commit");
    await fs.writeFile(path.join(repo, "b.txt"), "b");

    const [result] = await listProjectClonedRepositories([
      { ...base, id: "ws-1", name: "acme/repo", cwd: repo, repoUrl: "https://github.com/acme/repo" },
    ]);
    expect(result).toMatchObject({
      workspaceId: "ws-1",
      path: repo,
      location: "configured",
      status: "cloned",
      branch: "main",
      dirty: true,
      changedFileCount: 1,
    });
    expect(result.lastCommit).toMatchObject({ subject: "first commit", authorName: "Tester" });
  });

  it("flags missing and non-git paths and skips workspaces without a repo or path", async () => {
    const plain = path.join(root, "plain");
    await fs.mkdir(plain);
    const results = await listProjectClonedRepositories([
      { ...base, id: "ws-missing", name: "missing", cwd: path.join(root, "nope"), repoUrl: null },
      { ...base, id: "ws-plain", name: "plain", cwd: plain, repoUrl: null },
      { ...base, id: "ws-empty", name: "empty", cwd: null, repoUrl: null },
    ]);
    expect(results.map((r) => [r.workspaceId, r.status])).toEqual([
      ["ws-missing", "missing"],
      ["ws-plain", "not_git"],
    ]);
  });

  it("resolves repo-only workspaces to the managed checkout dir", async () => {
    const [result] = await listProjectClonedRepositories([
      { ...base, id: "ws-managed", name: "acme/svc", cwd: "/__paperclip_repo_only__", repoUrl: "https://github.com/acme/svc.git" },
    ]);
    expect(result.location).toBe("managed");
    expect(result.path).toMatch(/projects[\\/]company-1[\\/]project-1[\\/]svc$/);
  });
});
