import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applySnapshot,
  createBundle,
  createSnapshot,
  ensureBareRepo,
  fetchBundle,
  MIRROR_LATEST_REF,
  removeBundle,
  resolveRef,
  runGit,
} from "./work-context-snapshot.js";

const roots: string[] = [];

async function tempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pc-snapshot-"));
  roots.push(dir);
  return dir;
}

async function side(root: string, name: string) {
  const workTree = path.join(root, name, "work");
  await fs.mkdir(workTree, { recursive: true });
  return { gitDir: path.join(root, name, "sync.git"), workTree };
}

async function relay(from: { gitDir: string }, mirror: string, commit: string, since: string | null) {
  const bundle = await createBundle(from.gitDir, commit, since);
  if (bundle) await fetchBundle(mirror, bundle, MIRROR_LATEST_REF, commit);
  await removeBundle(bundle);
}

describe("work context snapshots", () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it("moves files writer → mirror → replica, honoring .gitignore and deletions", async () => {
    const root = await tempDir();
    const writer = await side(root, "writer");
    const replica = await side(root, "replica");
    const mirror = path.join(root, "mirror.git");
    await ensureBareRepo(mirror);

    await fs.writeFile(path.join(writer.workTree, ".gitignore"), "node_modules/\n");
    await fs.mkdir(path.join(writer.workTree, "node_modules"));
    await fs.writeFile(path.join(writer.workTree, "node_modules", "big.js"), "x");
    await fs.writeFile(path.join(writer.workTree, "a.txt"), "one\n");
    await fs.writeFile(path.join(writer.workTree, "gone.txt"), "bye\n");
    const first = await createSnapshot(writer, "snapshot 1");
    expect(first.changed).toBe(true);
    await relay(writer, mirror, first.commit, null);

    const fullBundle = await createBundle(mirror, first.commit, null);
    await expect(applySnapshot(replica, fullBundle, first.commit)).resolves.toMatchObject({ status: "applied" });
    await removeBundle(fullBundle);
    expect(await fs.readFile(path.join(replica.workTree, "a.txt"), "utf8")).toBe("one\n");
    await expect(fs.access(path.join(replica.workTree, "node_modules"))).rejects.toThrow();

    await fs.writeFile(path.join(writer.workTree, "a.txt"), "two\n");
    await fs.rm(path.join(writer.workTree, "gone.txt"));
    const second = await createSnapshot(writer, "snapshot 2");
    expect((await createSnapshot(writer, "again")).changed).toBe(false);
    await relay(writer, mirror, second.commit, first.commit);
    expect(await resolveRef(mirror, MIRROR_LATEST_REF)).toBe(second.commit);

    const delta = await createBundle(mirror, second.commit, first.commit);
    await expect(applySnapshot(replica, delta, second.commit)).resolves.toMatchObject({ status: "applied" });
    await removeBundle(delta);
    expect(await fs.readFile(path.join(replica.workTree, "a.txt"), "utf8")).toBe("two\n");
    await expect(fs.access(path.join(replica.workTree, "gone.txt"))).rejects.toThrow();
  });

  it("reports a conflict instead of overwriting local edits on the replica", async () => {
    const root = await tempDir();
    const writer = await side(root, "writer");
    const replica = await side(root, "replica");
    await fs.writeFile(path.join(writer.workTree, "a.txt"), "one\n");
    const first = await createSnapshot(writer, "s1");
    const bundle = await createBundle(writer.gitDir, first.commit, null);
    await applySnapshot(replica, bundle, first.commit);
    await removeBundle(bundle);

    await fs.writeFile(path.join(replica.workTree, "a.txt"), "edited in Fork\n");
    await fs.writeFile(path.join(writer.workTree, "a.txt"), "agent\n");
    const second = await createSnapshot(writer, "s2");
    const delta = await createBundle(writer.gitDir, second.commit, first.commit);
    const result = await applySnapshot(replica, delta, second.commit);
    await removeBundle(delta);

    expect(result).toEqual({ status: "conflict", commit: second.commit, localChanges: ["a.txt"] });
    expect(await fs.readFile(path.join(replica.workTree, "a.txt"), "utf8")).toBe("edited in Fork\n");
  });

  it("never snapshots the work tree's own .git directory", async () => {
    const root = await tempDir();
    const writer = await side(root, "writer");
    await fs.mkdir(path.join(writer.workTree, ".git"));
    await fs.writeFile(path.join(writer.workTree, ".git", "HEAD"), "ref: refs/heads/main\n");
    await fs.writeFile(path.join(writer.workTree, "file.txt"), "x");
    const { commit } = await createSnapshot(writer, "s1");
    const files = await runGit(["--git-dir", writer.gitDir, "ls-tree", "-r", "--name-only", commit]);
    expect(files.trim().split("\n")).toEqual(["file.txt"]);
  });
});
