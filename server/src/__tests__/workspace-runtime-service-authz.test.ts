import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  createDb,
  executionWorkspaces,
  heartbeatRuns,
  issues,
  projectWorkspaces,
  projects,
} from "@paperclipai/db";
import { LOW_TRUST_REVIEW_PRESET } from "@paperclipai/shared";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import {
  assertCanManageExecutionWorkspaceRuntimeServices,
  assertCanManageProjectWorkspaceRuntimeServices,
} from "../routes/workspace-runtime-service-authz.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres workspace runtime auth tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("workspace runtime service authz helper", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-workspace-runtime-authz-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(issues);
    await db.delete(executionWorkspaces);
    await db.delete(projectWorkspaces);
    await db.delete(projects);
    await db.delete(heartbeatRuns);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompany() {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `PAP-${companyId.slice(0, 8)}`,
      requireBoardApprovalForNewAgents: false,
    });
    return companyId;
  }

  async function seedProjectWorkspace() {
    const projectId = randomUUID();
    const projectWorkspaceId = randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: "Workspace authz",
      status: "in_progress",
    });
    await db.insert(projectWorkspaces).values({
      id: projectWorkspaceId,
      projectId,
      name: "Primary",
      sourceType: "local_path",
      cwd: "/tmp/paperclip-authz-project",
      isPrimary: true,
    });
    return { projectId, projectWorkspaceId };
  }

  async function seedExecutionWorkspace(projectId: string, projectWorkspaceId: string) {
    const executionWorkspaceId = randomUUID();
    await db.insert(executionWorkspaces).values({
      id: executionWorkspaceId,
      projectId,
      projectWorkspaceId,
      mode: "isolated_workspace",
      strategyType: "git_worktree",
      name: "Execution workspace",
      status: "active",
      providerType: "local_fs",
      cwd: "/tmp/paperclip-authz-execution",
    });
    return executionWorkspaceId;
  }

  async function seedAgent(
    input: { role?: string; reportsTo?: string | null; name?: string } = {},
  ) {
    const agentId = randomUUID();
    await db.insert(agents).values({
      id: agentId,
      name: input.name ?? "Agent",
      role: input.role ?? "engineer",
      reportsTo: input.reportsTo ?? null,
    });
    return agentId;
  }

  it("allows board actors to manage project workspace runtime services", async () => {
    const companyId = await seedCompany();
    const { projectWorkspaceId } = await seedProjectWorkspace();

    await expect(assertCanManageProjectWorkspaceRuntimeServices(db, {
      actor: {
        type: "board",
        userId: "board-1",
        memberships: [{ membershipRole: "owner", status: "active" }],
        source: "session",
        isInstanceAdmin: false,
      },
    } as any, {
      projectWorkspaceId,
    })).resolves.toBeUndefined();
  });

  it("allows CEO agents to manage any project workspace runtime services in their company", async () => {
    const companyId = await seedCompany();
    const { projectWorkspaceId } = await seedProjectWorkspace();
    const ceoAgentId = await seedAgent({ role: "ceo", name: "CEO" });

    await expect(assertCanManageProjectWorkspaceRuntimeServices(db, {
      actor: {
        type: "agent",
        agentId: ceoAgentId,
        source: "agent_key",
      },
    } as any, {
      projectWorkspaceId,
    })).resolves.toBeUndefined();
  });

  it("rejects low-trust CEO runtime service mutations unless runtime.manage is granted", async () => {
    const companyId = await seedCompany();
    const { projectId, projectWorkspaceId } = await seedProjectWorkspace();
    const ceoAgentId = await seedAgent({ role: "ceo", name: "CEO" });
    await db
      .update(agents)
      .set({
        permissions: {
          trustPreset: LOW_TRUST_REVIEW_PRESET,
          authorizationPolicy: {
            trustBoundary: {
              mode: LOW_TRUST_REVIEW_PRESET,
              projectIds: [projectId],
            },
          },
        },
      })
      .where(eq(agents.id, ceoAgentId));

    await db.insert(issues).values({
      id: randomUUID(),
      projectId,
      projectWorkspaceId,
      title: "Low-trust workspace",
      status: "todo",
      priority: "medium",
      assigneeAgentId: ceoAgentId,
    });

    await expect(assertCanManageProjectWorkspaceRuntimeServices(db, {
      actor: {
        type: "agent",
        agentId: ceoAgentId,
        source: "agent_key",
      },
    } as any, {
      projectWorkspaceId,
    })).rejects.toMatchObject({
      status: 403,
      message: "Low-trust runs cannot manage workspace runtime services unless the boundary grants runtime.manage",
    });
  });

  it("allows standard CEO runtime service mutations for low-trust workspace issues", async () => {
    const companyId = await seedCompany();
    const { projectId, projectWorkspaceId } = await seedProjectWorkspace();
    const ceoAgentId = await seedAgent({ role: "ceo", name: "CEO" });

    await db.insert(issues).values({
      id: randomUUID(),
      projectId,
      projectWorkspaceId,
      title: "Issue-scoped low-trust workspace",
      status: "todo",
      priority: "medium",
      assigneeAgentId: ceoAgentId,
      executionPolicy: {
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [projectId],
          },
        },
      },
    });

    await expect(assertCanManageProjectWorkspaceRuntimeServices(db, {
      actor: {
        type: "agent",
        agentId: ceoAgentId,
        source: "agent_key",
      },
    } as any, {
      projectWorkspaceId,
    })).resolves.toBeUndefined();
  });

  it("rejects runtime service mutations when only the run policy is low-trust without runtime.manage", async () => {
    const companyId = await seedCompany();
    const { projectId, projectWorkspaceId } = await seedProjectWorkspace();
    const ceoAgentId = await seedAgent({ role: "ceo", name: "CEO" });
    const issueId = randomUUID();
    const runId = randomUUID();

    await db.insert(issues).values({
      id: issueId,
      projectId,
      projectWorkspaceId,
      title: "Run-scoped low-trust workspace",
      status: "in_progress",
      priority: "medium",
      assigneeAgentId: ceoAgentId,
    });
    await db.insert(heartbeatRuns).values({
      id: runId,
      agentId: ceoAgentId,
      status: "running",
      contextSnapshot: {
        issueId,
        executionPolicy: {
          authorizationPolicy: {
            trustBoundary: {
              mode: LOW_TRUST_REVIEW_PRESET,
              projectIds: [projectId],
            },
          },
        },
      },
    });

    await expect(assertCanManageProjectWorkspaceRuntimeServices(db, {
      actor: {
        type: "agent",
        agentId: ceoAgentId,
        runId,
        source: "agent_key",
      },
    } as any, {
      projectWorkspaceId,
    })).rejects.toMatchObject({
      status: 403,
      message: "Low-trust runs cannot manage workspace runtime services unless the boundary grants runtime.manage",
    });
  });

  it("allows agents with a non-terminal assigned issue in the target project workspace", async () => {
    const companyId = await seedCompany();
    const { projectId, projectWorkspaceId } = await seedProjectWorkspace();
    const agentId = await seedAgent({ name: "Engineer" });

    await db.insert(issues).values({
      id: randomUUID(),
      projectId,
      projectWorkspaceId,
      title: "Use this workspace",
      status: "todo",
      priority: "medium",
      assigneeAgentId: agentId,
    });

    await expect(assertCanManageProjectWorkspaceRuntimeServices(db, {
      actor: {
        type: "agent",
        agentId,
        source: "agent_key",
      },
    } as any, {
      projectWorkspaceId,
    })).resolves.toBeUndefined();
  });

  it("allows managers to manage execution workspace runtime services for their reporting subtree", async () => {
    const companyId = await seedCompany();
    const { projectId, projectWorkspaceId } = await seedProjectWorkspace();
    const executionWorkspaceId = await seedExecutionWorkspace(projectId, projectWorkspaceId);
    const managerId = await seedAgent({ role: "cto", name: "Manager" });
    const reportId = await seedAgent({ reportsTo: managerId, name: "Report" });

    await db.insert(issues).values({
      id: randomUUID(),
      projectId,
      projectWorkspaceId,
      executionWorkspaceId,
      title: "Use execution workspace",
      status: "in_progress",
      priority: "medium",
      assigneeAgentId: reportId,
    });

    await expect(assertCanManageExecutionWorkspaceRuntimeServices(db, {
      actor: {
        type: "agent",
        agentId: managerId,
        source: "agent_key",
      },
    } as any, {
      executionWorkspaceId,
    })).resolves.toMatchObject({
      actorType: "agent",
      agentId: managerId,
      issueId: null,
    });
  });

  it("rejects unrelated same-company agents without matching workspace assignments", async () => {
    const companyId = await seedCompany();
    const { projectId, projectWorkspaceId } = await seedProjectWorkspace();
    const executionWorkspaceId = await seedExecutionWorkspace(projectId, projectWorkspaceId);
    const assignedAgentId = await seedAgent({ name: "Assigned" });
    const unrelatedAgentId = await seedAgent({ name: "Unrelated" });

    await db.insert(issues).values({
      id: randomUUID(),
      projectId,
      projectWorkspaceId,
      executionWorkspaceId,
      title: "Assigned issue",
      status: "todo",
      priority: "medium",
      assigneeAgentId: assignedAgentId,
    });

    await expect(assertCanManageExecutionWorkspaceRuntimeServices(db, {
      actor: {
        type: "agent",
        agentId: unrelatedAgentId,
        source: "agent_key",
      },
    } as any, {
      executionWorkspaceId,
    })).rejects.toMatchObject({
      status: 403,
      message: "Missing permission to manage workspace runtime services",
    });
  });

  it("rejects completed workspace assignments so stale issues do not keep access alive", async () => {
    const companyId = await seedCompany();
    const { projectId, projectWorkspaceId } = await seedProjectWorkspace();
    const agentId = await seedAgent({ name: "Engineer" });

    await db.insert(issues).values({
      id: randomUUID(),
      projectId,
      projectWorkspaceId,
      title: "Completed issue",
      status: "done",
      priority: "medium",
      assigneeAgentId: agentId,
    });

    await expect(assertCanManageProjectWorkspaceRuntimeServices(db, {
      actor: {
        type: "agent",
        agentId,
        source: "agent_key",
      },
    } as any, {
      projectWorkspaceId,
    })).rejects.toMatchObject({
      status: 403,
      message: "Missing permission to manage workspace runtime services",
    });
  });
});
