import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MACHINE_CREDENTIAL_REJECTED_ERROR } from "@paperclipai/shared";
import { checkCredential } from "../commands/machine/daemon.js";
import { materializeContext, snapshotContext, syncRepoFor } from "../commands/machine/sync.js";

const ISSUE = "11111111-1111-4111-8111-111111111111";
const roots: string[] = [];

async function workspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pc-machine-sync-"));
  roots.push(root);
  const workTree = path.join(root, "issues", ISSUE);
  await fs.mkdir(workTree, { recursive: true });
  return { root, workTree };
}

describe("machine sync", () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it("refuses paths outside the workspace root", () => {
    expect(() => syncRepoFor({ workspaceRoot: "/w" }, ISSUE, "/etc")).toThrow(/outside/);
    expect(() => syncRepoFor({ workspaceRoot: "/w" }, ISSUE, "/w")).toThrow(/outside/);
    expect(() => syncRepoFor({ workspaceRoot: "/w" }, "../x", "/w/issues/x")).toThrow(/uuid/);
  });

  it("uploads a bundle with the commit and fencing headers, then reports no change", async () => {
    const { root, workTree } = await workspace();
    await fs.writeFile(path.join(workTree, "a.txt"), "hi");
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    const deps = { serverUrl: "http://pc/", headers: { authorization: "Bearer pcm_x" }, workspaceRoot: root, fetch };

    const first = await snapshotContext({ issueId: ISSUE, path: workTree, fencingToken: 3, seq: 1, since: null }, deps);
    expect(first).toMatchObject({ changed: true, seq: 1 });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`http://pc/api/machines/v1/issues/${ISSUE}/snapshots/1`);
    expect(init.headers).toMatchObject({
      authorization: "Bearer pcm_x",
      "x-paperclip-snapshot-commit": first.commit,
      "x-paperclip-fencing-token": "3",
    });

    const again = await snapshotContext({ issueId: ISSUE, path: workTree, fencingToken: 3, seq: 2, since: first.commit }, deps);
    expect(again).toEqual({ changed: false, commit: first.commit, seq: 1 });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("will not publish from a replica that is behind the mirror", async () => {
    const { root, workTree } = await workspace();
    await fs.writeFile(path.join(workTree, "a.txt"), "old");
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    const deps = { serverUrl: "http://pc", headers: {}, workspaceRoot: root, fetch };
    await expect(
      snapshotContext({ issueId: ISSUE, path: workTree, fencingToken: 1, seq: 4, since: "a".repeat(40) }, deps),
    ).rejects.toThrow(/replica_out_of_date/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces a download failure from the server", async () => {
    const { root, workTree } = await workspace();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "No work context for this machine" }), { status: 404 }));
    await expect(
      materializeContext(
        { issueId: ISSUE, path: workTree, seq: 1, commit: "b".repeat(40) },
        { serverUrl: "http://pc", headers: {}, workspaceRoot: root, fetch },
      ),
    ).rejects.toThrow(/No work context for this machine/);
  });
});

describe("checkCredential", () => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("treats only Paperclip's own rejection as revoked", async () => {
    await expect(checkCredential("http://pc", {}, async () => json(401, { error: MACHINE_CREDENTIAL_REJECTED_ERROR }))).resolves.toBe("revoked");
    await expect(checkCredential("http://pc", {}, async () => new Response("<html>Sign in</html>", { status: 401 }))).resolves.toBe("unknown");
    await expect(checkCredential("http://pc", {}, async () => json(200, { id: "m1" }))).resolves.toBe("valid");
    await expect(checkCredential("http://pc", {}, async () => { throw new Error("offline"); })).resolves.toBe("unknown");
  });
});
