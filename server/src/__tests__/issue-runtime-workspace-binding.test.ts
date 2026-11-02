import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, executionWorkspaces, issues, projects } from "@paperclipai/db";
import { issueService } from "../services/issues.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";

const support = await getEmbeddedPostgresTestSupport();
(support.supported ? describe : describe.skip)("runtime shared workspace binding", () => {
  let temporary: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>>;
  let db: ReturnType<typeof createDb>;
  beforeAll(async () => {
    temporary = await startEmbeddedPostgresTestDatabase("paperclip-runtime-workspace-binding-");
    db = createDb(temporary.connectionString);
    await instanceSettingsService(db).updateExperimental({ enableIsolatedWorkspaces: false });
  }, 30_000);
  afterAll(async () => { await temporary?.cleanup(); });

  async function fixture(mode = "shared_workspace") {
    const projectId = randomUUID(), issueId = randomUUID(), workspaceId = randomUUID();
    await db.insert(projects).values({ id: projectId, name: "Studio" });
    await db.insert(issues).values({ id: issueId, projectId, title: "Continue the conversation" });
    await db.insert(executionWorkspaces).values({ id: workspaceId, projectId, mode, strategyType: "project_primary", name: "Studio workspace" });
    return { issueId, workspaceId };
  }
  const binding = (workspaceId: string) => ({
    executionWorkspaceId: workspaceId,
    executionWorkspacePreference: "reuse_existing",
    executionWorkspaceSettings: { mode: "shared_workspace" as const },
  });

  it("persists the internal binding with isolated workspaces off while public updates remain gated", async () => {
    const f = await fixture(), svc = issueService(db);
    const ordinary = await svc.update(f.issueId, binding(f.workspaceId));
    expect(ordinary?.executionWorkspaceId).toBeNull();
    const bound = await svc.update(f.issueId, binding(f.workspaceId), db, undefined, undefined, { bindRuntimeSharedWorkspace: true });
    expect(bound).toMatchObject(binding(f.workspaceId));
    const followUp = await svc.update(f.issueId, { title: "A second message" });
    expect(followUp).toMatchObject(binding(f.workspaceId));
  });

  it("rejects another project's workspace and cannot opt into isolated worktrees", async () => {
    const local = await fixture(), foreign = await fixture(), isolated = await fixture("isolated_workspace"), svc = issueService(db);
    await expect(svc.update(local.issueId, binding(foreign.workspaceId), db, undefined, undefined, { bindRuntimeSharedWorkspace: true })).rejects.toThrow("selected project");
    await expect(svc.update(isolated.issueId, binding(isolated.workspaceId), db, undefined, undefined, { bindRuntimeSharedWorkspace: true })).rejects.toThrow("existing shared workspace");
  });
});
