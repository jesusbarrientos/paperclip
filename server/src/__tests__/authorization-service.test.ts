import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, beforeEach } from "vitest";
import { resetOrganizationState, membershipUpsert } from "./helpers/reset-organization.js";
import { and, eq } from "drizzle-orm";
import {
  agents,
  authUsers,
  organizations,
  companyMemberships,
  createDb,
  instanceUserRoles,
  issueComments,
  issues,
  principalPermissionGrants,
  projects,
  userInboxAgentPolicies,
} from "@paperclipai/db";
import { LOW_TRUST_REVIEW_PRESET, type PermissionKey } from "@paperclipai/shared";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { authorizationService } from "../services/authorization.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

async function createCompany(db: ReturnType<typeof createDb>, label: string) {
  return db
    .insert(organizations)
    .values({
      name: `Authorization ${label} ${randomUUID()}`,
      issuePrefix: `AZ${randomUUID().slice(0, 6).toUpperCase()}`,
    })
    .returning()
    .then((rows) => rows[0]!);
}

async function createAgent(
  db: ReturnType<typeof createDb>,
  input: { role?: string; reportsTo?: string | null; permissions?: Record<string, unknown> } = {},
) {
  return db
    .insert(agents)
    .values({
      name: `Agent ${randomUUID()}`,
      role: input.role ?? "engineer",
      reportsTo: input.reportsTo ?? null,
      permissions: input.permissions ?? {},
      adapterType: "process",
      adapterConfig: {},
      runtimeConfig: {},
    })
    .returning()
    .then((rows) => rows[0]!);
}

async function createProject(db: ReturnType<typeof createDb>, label: string) {
  return db
    .insert(projects)
    .values({
      name: `Project ${label} ${randomUUID()}`,
    })
    .returning()
    .then((rows) => rows[0]!);
}

async function createIssue(
  db: ReturnType<typeof createDb>,
  input: {
    id?: string;
    title?: string;
    projectId?: string | null;
    parentId?: string | null;
    assigneeAgentId?: string | null;
    originKind?: string | null;
    originId?: string | null;
  } = {},
) {
  return db
    .insert(issues)
    .values({
      id: input.id ?? randomUUID(),
      title: input.title ?? `Issue ${randomUUID()}`,
      status: "todo",
      priority: "medium",
      projectId: input.projectId ?? null,
      parentId: input.parentId ?? null,
      assigneeAgentId: input.assigneeAgentId ?? null,
      originKind: input.originKind ?? "manual",
      originId: input.originId ?? null,
    })
    .returning()
    .then((rows) => rows[0]!);
}

async function grantAgentPermission(
  db: ReturnType<typeof createDb>,
  agentId: string,
  permissionKey: PermissionKey,
  scope: Record<string, unknown> | null = null,
) {
  await db.insert(companyMemberships).values({
    principalType: "agent",
    principalId: agentId,
    status: "active",
    membershipRole: "member",
  }).onConflictDoUpdate(membershipUpsert);
  await db.insert(principalPermissionGrants).values({
    principalType: "agent",
    principalId: agentId,
    permissionKey,
    scope,
    grantedByUserId: null,
  });
}

async function createUser(
  db: ReturnType<typeof createDb>,
  input: { id?: string; email?: string } = {},
) {
  const id = input.id ?? `user-${randomUUID()}`;
  await db.insert(authUsers).values({
    id,
    name: `User ${id}`,
    email: input.email ?? `${id}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

async function grantUserPermission(
  db: ReturnType<typeof createDb>,
  userId: string,
  permissionKey: PermissionKey,
  scope: Record<string, unknown> | null = null,
) {
  await db.insert(companyMemberships).values({
    principalType: "user",
    principalId: userId,
    status: "active",
    membershipRole: "operator",
  }).onConflictDoUpdate(membershipUpsert);
  await db.insert(principalPermissionGrants).values({
    principalType: "user",
    principalId: userId,
    permissionKey,
    scope,
    grantedByUserId: "owner",
  });
}

describeEmbeddedPostgres("authorization service", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-authorization-service-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  beforeEach(async () => {
    await resetOrganizationState(db);
  });

  afterEach(async () => {
    await db.delete(issueComments);
    await db.delete(userInboxAgentPolicies);
    await db.delete(principalPermissionGrants);
    await db.delete(companyMemberships);
    await db.delete(instanceUserRoles);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(projects);
    await db.delete(organizations);
    await db.delete(authUsers);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("allows active user role grants and explains the grant source", async () => {
    const company = await createCompany(db, "UserGrant");
    const userId = `user-${randomUUID()}`;
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);
    await db.insert(principalPermissionGrants).values({
      principalType: "user",
      principalId: userId,
      permissionKey: "tasks:assign",
      grantedByUserId: "owner",
    });

    const decision = await authorizationService(db).decidePrincipalGrant({
      principalType: "user",
      principalId: userId,
      action: "tasks:assign",
      permissionKey: "tasks:assign",
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allow_explicit_grant",
      grant: {
        principalType: "user",
        principalId: userId,
        permissionKey: "tasks:assign",
      },
    });
    expect(decision.explanation).toContain("Allowed by explicit grant tasks:assign");
  });

  it("allows suggest grants to read peer agent configuration", async () => {
    const company = await createCompany(db, "AgentReadGrant");
    const actorAgent = await createAgent(db);
    const targetAgent = await createAgent(db);
    await grantAgentPermission(db, actorAgent.id, "agents:suggest-changes");

    const decision = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_key" },
      action: "agent_config:read",
      resource: { type: "agent", agentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allow_explicit_grant",
      grant: {
        principalType: "agent",
        principalId: actorAgent.id,
        permissionKey: "agents:suggest-changes",
      },
    });
  });

  it("falls back to the direct config-read grant decision when a suggest read grant is scoped away", async () => {
    const company = await createCompany(db, "AgentReadScopedSuggestGrant");
    const actorAgent = await createAgent(db);
    const targetAgent = await createAgent(db);
    await grantAgentPermission(db, actorAgent.id, "agents:suggest-changes", {
      projectId: randomUUID(),
    });

    const decision = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_key" },
      action: "agent_config:read",
      resource: { type: "agent", agentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "deny_missing_grant",
      explanation: "Missing permission: agents:configure.",
    });
  });

  it("enforces direct or consented suggest grants for agent configuration changes", async () => {
    const company = await createCompany(db, "AgentChangeGrant");
    const directAgent = await createAgent(db);
    const suggestAgent = await createAgent(db);
    const noGrantAgent = await createAgent(db);
    const targetAgent = await createAgent(db);
    await grantAgentPermission(db, directAgent.id, "agents:configure");
    await grantAgentPermission(db, suggestAgent.id, "agents:suggest-changes");
    await db.insert(companyMemberships).values({
      principalType: "agent",
      principalId: noGrantAgent.id,
      status: "active",
      membershipRole: "member",
    }).onConflictDoUpdate(membershipUpsert);

    const authz = authorizationService(db);
    await expect(authz.decide({
      actor: { type: "agent", agentId: directAgent.id, source: "agent_key" },
      action: "agent_config:update",
      resource: { type: "agent", agentId: targetAgent.id },
      scope: { requiresChangeGrant: true },
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_direct_change",
      grant: { permissionKey: "agents:configure" },
    });

    await expect(authz.decide({
      actor: { type: "agent", agentId: suggestAgent.id, source: "agent_key" },
      action: "agent_config:update",
      resource: { type: "agent", agentId: targetAgent.id },
      scope: { requiresChangeGrant: true },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_missing_consent",
      grant: { permissionKey: "agents:suggest-changes" },
    });

    await expect(authz.decide({
      actor: { type: "agent", agentId: suggestAgent.id, source: "agent_key" },
      action: "agent_config:update",
      resource: { type: "agent", agentId: targetAgent.id },
      scope: { requiresChangeGrant: true, consentedChange: true },
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_consented_change",
      grant: { permissionKey: "agents:suggest-changes" },
    });

    await expect(authz.decide({
      actor: { type: "agent", agentId: noGrantAgent.id, source: "agent_key" },
      action: "agent_config:update",
      resource: { type: "agent", agentId: targetAgent.id },
      scope: { requiresChangeGrant: true },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_no_grant",
    });
  });

  it("enforces direct or consented suggest grants for skill configuration changes", async () => {
    const company = await createCompany(db, "SkillChangeGrant");
    const directAgent = await createAgent(db);
    const suggestAgent = await createAgent(db);
    const noGrantAgent = await createAgent(db);
    await grantAgentPermission(db, directAgent.id, "skills:create");
    await grantAgentPermission(db, suggestAgent.id, "skills:suggest-changes");
    await db.insert(companyMemberships).values({
      principalType: "agent",
      principalId: noGrantAgent.id,
      status: "active",
      membershipRole: "member",
    }).onConflictDoUpdate(membershipUpsert);

    const authz = authorizationService(db);
    await expect(authz.decide({
      actor: { type: "agent", agentId: directAgent.id, source: "agent_key" },
      action: "skill_config:update",
      resource: { type: "company" },
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_direct_change",
      grant: { permissionKey: "skills:create" },
    });

    await expect(authz.decide({
      actor: { type: "agent", agentId: suggestAgent.id, source: "agent_key" },
      action: "skill_config:update",
      resource: { type: "company" },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_missing_consent",
      grant: { permissionKey: "skills:suggest-changes" },
    });

    await expect(authz.decide({
      actor: { type: "agent", agentId: suggestAgent.id, source: "agent_key" },
      action: "skill_config:update",
      resource: { type: "company" },
      scope: { consentedChange: true },
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_consented_change",
      grant: { permissionKey: "skills:suggest-changes" },
    });

    await expect(authz.decide({
      actor: { type: "agent", agentId: noGrantAgent.id, source: "agent_key" },
      action: "skill_config:update",
      resource: { type: "company" },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_no_grant",
    });
  });

  it("allows board users with direct skills:create grants to mutate company skills", async () => {
    const company = await createCompany(db, "BoardUserSkillGrant");
    const userId = await createUser(db);
    await grantUserPermission(db, userId, "skills:create");

    const decision = await authorizationService(db).decide({
      actor: {
        type: "board",
        userId,
        companyIds: [company.id],
        source: "session",
      },
      action: "skill_config:update",
      resource: { type: "company" },
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allow_direct_change",
      grant: {
        principalType: "user",
        principalId: userId,
        permissionKey: "skills:create",
      },
    });
  });

  it("allows responsible-user JWT agents with direct skills:create grants to mutate company skills", async () => {
    const company = await createCompany(db, "ResponsibleUserSkillGrant");
    const actorAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    await grantAgentPermission(db, actorAgent.id, "skills:create");
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);

    const decision = await authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "skill_config:update",
      resource: { type: "company" },
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allow_direct_change",
      grant: {
        principalType: "agent",
        principalId: actorAgent.id,
        permissionKey: "skills:create",
      },
    });
  });

  it("keeps responsible-user skill mutations denied for viewer memberships", async () => {
    const company = await createCompany(db, "ResponsibleUserSkillViewerDenied");
    const actorAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    await grantAgentPermission(db, actorAgent.id, "skills:create");
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "viewer",
    }).onConflictDoUpdate(membershipUpsert);

    const decision = await authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "skill_config:update",
      resource: { type: "company" },
    });

    expect(decision).toMatchObject({
      allowed: false,
      code: "RESPONSIBLE_USER_UNAUTHORIZED",
    });
    expect(decision.explanation).toContain(`Responsible user ${responsibleUserId} is not authorized`);
  });

  it("allows simple-mode task assignment between same-company agents without explicit grants", async () => {
    const company = await createCompany(db, "AssignmentDefault");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const targetAgent = await createAgent(db, { role: "engineer" });
    await db.insert(companyMemberships).values({
      principalType: "agent",
      principalId: actorAgent.id,
      status: "active",
      membershipRole: "member",
    }).onConflictDoUpdate(membershipUpsert);

    const decision = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_key" },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allow_visible_issue_write",
    });
    expect(decision.explanation).toContain("shared default-open");
  });

  it("allows standard-trust agents to comment on and update visible peer-owned issues", async () => {
    const company = await createCompany(db, "DefaultOpenPeerWrites");
    const actorAgent = await createAgent(db);
    const ownerAgent = await createAgent(db);
    const issue = await createIssue(db, { assigneeAgentId: ownerAgent.id });
    const actor = {
      type: "agent" as const,
      agentId: actorAgent.id,
      source: "agent_jwt" as const,
    };
    const resource = {
      type: "issue" as const,
      issueId: issue.id,
      assigneeAgentId: ownerAgent.id,
      status: issue.status,
    };
    const authorization = authorizationService(db);

    for (const action of ["issue:comment", "issue:mutate"] as const) {
      await expect(authorization.decide({ actor, action, resource })).resolves.toMatchObject({
        allowed: true,
        reason: "allow_visible_issue_write",
      });
    }
  });

  it("keeps the responsible-user ceiling on every default-open peer write", async () => {
    const company = await createCompany(db, "DefaultOpenPeerWriteCeiling");
    const actorAgent = await createAgent(db);
    const ownerAgent = await createAgent(db);
    const issue = await createIssue(db, { assigneeAgentId: ownerAgent.id });
    const unavailableUserId = await createUser(db);
    const actor = {
      type: "agent" as const,
      agentId: actorAgent.id,
      onBehalfOfUserId: unavailableUserId,
      source: "agent_jwt" as const,
    };
    const resource = {
      type: "issue" as const,
      issueId: issue.id,
      assigneeAgentId: ownerAgent.id,
      status: issue.status,
    };
    const authorization = authorizationService(db);

    for (const action of ["issue:comment", "issue:mutate"] as const) {
      await expect(authorization.decide({ actor, action, resource })).resolves.toMatchObject({
        allowed: false,
        code: "RESPONSIBLE_USER_UNAVAILABLE",
        reason: "deny_missing_membership",
      });
    }
  });

  it("structurally keeps default-open comments inside issue visibility", async () => {
    const company = await createCompany(db, "CommentReadSubset");
    const project = await createProject(db, "Visible");
    const outsideProject = await createProject(db, "Outside");
    const rootIssueId = randomUUID();
    const actorAgent = await createAgent(db, {
      permissions: {
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [project.id],
            rootIssueId,
          },
        },
      },
    });
    const ownerAgent = await createAgent(db);
    const visibleIssue = await createIssue(db, {
      id: rootIssueId,
      projectId: project.id,
      assigneeAgentId: ownerAgent.id,
    });
    const hiddenIssue = await createIssue(db, {
      projectId: outsideProject.id,
      assigneeAgentId: ownerAgent.id,
    });
    const actor = {
      type: "agent" as const,
      agentId: actorAgent.id,
      source: "agent_key" as const,
    };
    const authorization = authorizationService(db);

    for (const issue of [visibleIssue, hiddenIssue]) {
      const resource = {
        type: "issue" as const,
        issueId: issue.id,
        projectId: issue.projectId,
        parentIssueId: issue.parentId,
        assigneeAgentId: issue.assigneeAgentId,
        status: issue.status,
      };
      const read = await authorization.decide({ actor, action: "issue:read", resource });
      const comment = await authorization.decide({ actor, action: "issue:comment", resource });
      expect(comment.allowed && !read.allowed).toBe(false);
    }
  });

  it("does not let default-open non-assignee comments mint mention grants", async () => {
    const company = await createCompany(db, "DefaultOpenMentionNonTransitive");
    const ownerAgent = await createAgent(db);
    const commentingAgent = await createAgent(db);
    const mentionedAgent = await createAgent(db);
    const issue = await createIssue(db, { assigneeAgentId: ownerAgent.id });
    await db.insert(issueComments).values({
      issueId: issue.id,
      authorAgentId: commentingAgent.id,
      body: `[@Mentioned](agent://${mentionedAgent.id}) please take a look`,
    });

    await expect(authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: mentionedAgent.id,
        source: "agent_jwt",
      },
      action: "issue:comment",
      resource: {
        type: "issue",
        issueId: issue.id,
        assigneeAgentId: ownerAgent.id,
        status: issue.status,
      },
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_visible_issue_write",
    });
  });

  it("denies delegated protected assignment when the responsible user lacks matching authority", async () => {
    const company = await createCompany(db, "ResponsibleUserDenied");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const ceoAgent = await createAgent(db, {
      role: "ceo",
      permissions: {
        authorizationPolicy: {
          assignmentPolicy: { mode: "protected" },
        },
      },
    });
    const responsibleUserId = await createUser(db);
    await grantAgentPermission(db, actorAgent.id, "tasks:assign");
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);

    const decision = await authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: ceoAgent.id },
      scope: { assigneeAgentId: ceoAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: false,
      code: "RESPONSIBLE_USER_UNAUTHORIZED",
    });
  });

  it("allows active non-viewer responsible users to authorize assigned agent issue mutations", async () => {
    const company = await createCompany(db, "ResponsibleUserIssueMutation");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const issue = await createIssue(db, {
      title: "Assigned issue mutation",
      assigneeAgentId: actorAgent.id,
    });
    const responsibleUserId = await createUser(db);
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);

    await expect(authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "issue:mutate",
      resource: {
        type: "issue",
        issueId: issue.id,
        assigneeAgentId: actorAgent.id,
      },
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_self",
    });
  });

  it("rechecks responsible-user membership on a new request actor after revocation", async () => {
    const company = await createCompany(db, "ResponsibleUserRevocation");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const issue = await createIssue(db, {
      title: "Assigned issue mutation after revocation",
      assigneeAgentId: actorAgent.id,
    });
    const responsibleUserId = await createUser(db);
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);
    const authz = authorizationService(db);
    const resource = {
      type: "issue" as const,
      issueId: issue.id,
      assigneeAgentId: actorAgent.id,
    };

    await expect(authz.decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "issue:mutate",
      resource,
    })).resolves.toMatchObject({ allowed: true });

    await db
      .update(companyMemberships)
      .set({ status: "suspended" })
      .where(and(
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, responsibleUserId),
      ));

    await expect(authz.decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "issue:mutate",
      resource,
    })).resolves.toMatchObject({
      allowed: false,
      code: "RESPONSIBLE_USER_UNAVAILABLE",
    });
  });

  it("keeps responsible-user issue mutations denied for viewer memberships", async () => {
    const company = await createCompany(db, "ResponsibleUserIssueViewerDenied");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const issue = await createIssue(db, {
      title: "Assigned viewer-denied mutation",
      assigneeAgentId: actorAgent.id,
    });
    const responsibleUserId = await createUser(db);
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "viewer",
    }).onConflictDoUpdate(membershipUpsert);

    await expect(authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "issue:mutate",
      resource: {
        type: "issue",
        issueId: issue.id,
        assigneeAgentId: actorAgent.id,
      },
    })).resolves.toMatchObject({
      allowed: false,
      code: "RESPONSIBLE_USER_UNAUTHORIZED",
      reason: "deny_unsupported_action",
    });
  });

  it("fails closed when the responsible user is unavailable", async () => {
    const company = await createCompany(db, "ResponsibleUserUnavailable");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const targetAgent = await createAgent(db, { role: "engineer" });

    const decision = await authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: `missing-${randomUUID()}`,
        source: "agent_jwt",
      },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: false,
      code: "RESPONSIBLE_USER_UNAVAILABLE",
    });
  });

  it("allows delegated protected assignment when both agent and responsible user are authorized", async () => {
    const company = await createCompany(db, "ResponsibleUserAllowed");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const ceoAgent = await createAgent(db, {
      role: "ceo",
      permissions: {
        authorizationPolicy: {
          assignmentPolicy: { mode: "protected" },
        },
      },
    });
    const responsibleUserId = await createUser(db);
    await grantAgentPermission(db, actorAgent.id, "tasks:assign");
    await grantUserPermission(db, responsibleUserId, "tasks:assign");

    const decision = await authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: ceoAgent.id },
      scope: { assigneeAgentId: ceoAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allow_explicit_grant",
    });
  });

  it("limits low-trust issue reads to the configured project and root issue boundary", async () => {
    const company = await createCompany(db, "LowTrustIssueReads");
    const project = await createProject(db, "Allowed");
    const otherProject = await createProject(db, "Denied");
    const rootIssueId = randomUUID();
    const actorAgent = await createAgent(db, {
      permissions: {
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [project.id],
            rootIssueId,
          },
        },
      },
    });
    const rootIssue = await createIssue(db, {
      id: rootIssueId,
      projectId: project.id,
      assigneeAgentId: actorAgent.id,
    });
    const childIssue = await createIssue(db, {
      projectId: project.id,
      parentId: rootIssue.id,
    });
    const unrelatedIssue = await createIssue(db, {
      projectId: otherProject.id,
    });

    const authorization = authorizationService(db);
    const actor = { type: "agent" as const, agentId: actorAgent.id, source: "agent_key" as const };
    const rootDecision = await authorization.decide({
      actor,
      action: "issue:read",
      resource: {
        type: "issue",
        issueId: rootIssue.id,
        projectId: rootIssue.projectId,
        parentIssueId: rootIssue.parentId,
        assigneeAgentId: rootIssue.assigneeAgentId,
        status: rootIssue.status,
      },
    });
    const childDecision = await authorization.decide({
      actor,
      action: "issue:read",
      resource: {
        type: "issue",
        issueId: childIssue.id,
        projectId: childIssue.projectId,
        parentIssueId: childIssue.parentId,
        status: childIssue.status,
      },
    });
    const unrelatedDecision = await authorization.decide({
      actor,
      action: "issue:read",
      resource: {
        type: "issue",
        issueId: unrelatedIssue.id,
        projectId: unrelatedIssue.projectId,
        parentIssueId: unrelatedIssue.parentId,
        status: unrelatedIssue.status,
      },
    });

    expect(rootDecision).toMatchObject({ allowed: true, reason: "allow_low_trust_boundary" });
    expect(childDecision).toMatchObject({ allowed: true, reason: "allow_low_trust_boundary" });
    expect(unrelatedDecision).toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
  });

  it("blocks low-trust project, agent, company-wide, and outside-boundary assignment access", async () => {
    const company = await createCompany(db, "LowTrustOtherResources");
    const project = await createProject(db, "Allowed");
    const otherProject = await createProject(db, "Denied");
    const collaborator = await createAgent(db);
    const higherTrustAgent = await createAgent(db, { role: "cto" });
    const actorAgent = await createAgent(db, {
      permissions: {
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [project.id],
            allowedAgentIds: [collaborator.id],
          },
        },
      },
    });

    const authorization = authorizationService(db);
    const actor = { type: "agent" as const, agentId: actorAgent.id, source: "agent_key" as const };

    await expect(authorization.decide({
      actor,
      action: "project:read",
      resource: { type: "project", projectId: project.id },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_low_trust_boundary" });
    await expect(authorization.decide({
      actor,
      action: "project:read",
      resource: { type: "project", projectId: otherProject.id },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
    await expect(authorization.decide({
      actor,
      action: "agent:read",
      resource: { type: "agent", agentId: collaborator.id },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_low_trust_boundary" });
    await expect(authorization.decide({
      actor,
      action: "agent:read",
      resource: { type: "agent", agentId: higherTrustAgent.id },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
    await expect(authorization.decide({
      actor,
      action: "company_scope:read",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
    await expect(authorization.decide({
      actor,
      action: "tasks:assign",
      resource: {
        type: "issue",
        projectId: project.id,
        assigneeAgentId: collaborator.id,
      },
      scope: { projectId: project.id, assigneeAgentId: collaborator.id },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
    await expect(authorization.decide({
      actor,
      action: "tasks:assign",
      resource: {
        type: "issue",
        projectId: project.id,
        assigneeAgentId: higherTrustAgent.id,
      },
      scope: { projectId: project.id, assigneeAgentId: higherTrustAgent.id },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
  });

  it("blocks low-trust configuration actions before evaluating explicit change grants", async () => {
    const company = await createCompany(db, "LowTrustConfigGrants");
    const project = await createProject(db, "Allowed");
    const targetAgent = await createAgent(db);
    const actorAgent = await createAgent(db, {
      role: "ceo",
      permissions: {
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [project.id],
            allowedAgentIds: [targetAgent.id],
          },
        },
      },
    });
    await grantAgentPermission(db, actorAgent.id, "agents:configure");
    await db.insert(principalPermissionGrants).values({
      principalType: "agent",
      principalId: actorAgent.id,
      permissionKey: "skills:create",
      grantedByUserId: null,
    });

    const authz = authorizationService(db);
    const actor = { type: "agent" as const, agentId: actorAgent.id, source: "agent_key" as const };

    await expect(authz.decide({
      actor,
      action: "agent:read",
      resource: { type: "agent", agentId: targetAgent.id },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_low_trust_boundary" });

    await expect(authz.decide({
      actor,
      action: "agent_config:read",
      resource: { type: "agent", agentId: targetAgent.id },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });

    await expect(authz.decide({
      actor,
      action: "agent_config:read",
      resource: { type: "agent", agentId: actorAgent.id },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });

    await expect(authz.decide({
      actor,
      action: "agent_config:update",
      resource: { type: "agent", agentId: targetAgent.id },
      scope: { requiresChangeGrant: true, consentedChange: true },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });

    await expect(authz.decide({
      actor,
      action: "skill_config:update",
      resource: { type: "company" },
      scope: { consentedChange: true },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
  });

  it("hard-blocks assignment when the target agent blocks protected assignment", async () => {
    const company = await createCompany(db, "ProtectedAssignment");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const targetAgent = await createAgent(db, {
      role: "engineer",
      permissions: {
        authorizationPolicy: {
          assignmentPolicy: {
            mode: "protected",
          },
          protectedAgent: {
            blockAssignment: true,
            blockReason: "Production deployment authority",
          },
          managedBy: "permissions-extension",
        },
      },
    });

    await grantAgentPermission(db, actorAgent.id, "tasks:assign");

    const decision = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_key" },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "deny_policy_restricted",
    });
    expect(decision.explanation).toBe(
      "Target agent assignment is blocked by protected-agent policy. " +
      "A company administrator can remove the assignment block, then retry.",
    );
    expect(decision.explanation).not.toContain("approval");
  });

  it("keeps legacy protected-assignment approval flags as hard blocks without approval copy", async () => {
    const company = await createCompany(db, "LegacyProtectedAssignment");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const targetAgent = await createAgent(db, {
      role: "engineer",
      permissions: {
        authorizationPolicy: {
          assignmentPolicy: {
            mode: "protected",
            protectedAgentRequiresApproval: true,
          },
          protectedAgent: {
            requiresApproval: true,
          },
        },
      },
    });

    await grantAgentPermission(db, actorAgent.id, "tasks:assign");

    const decision = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_key" },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "deny_policy_restricted",
    });
    expect(decision.explanation).toContain("assignment is blocked");
    expect(decision.explanation).toContain("company administrator");
    expect(decision.explanation).not.toContain("approval");
  });

  it("requires an explicit grant before assigning to a private target agent", async () => {
    const company = await createCompany(db, "PrivateAssignment");
    const actorAgent = await createAgent(db, { role: "engineer" });
    const targetAgent = await createAgent(db, {
      role: "engineer",
      permissions: {
        authorizationPolicy: {
          agentVisibility: {
            mode: "private",
            hiddenFromDefaultDirectory: true,
          },
          assignmentPolicy: {
            mode: "company_default",
            protectedAgentRequiresApproval: false,
          },
          protectedAgent: {
            requiresApproval: false,
          },
          managedBy: "permissions-extension",
        },
      },
    });

    const denied = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_key" },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });

    await grantAgentPermission(db, actorAgent.id, "tasks:assign_scope", {
      assigneeAgentId: targetAgent.id,
    });

    const allowed = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_key" },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(denied).toMatchObject({
      allowed: false,
      reason: "deny_policy_restricted",
    });
    expect(denied.explanation).toContain("private");
    expect(allowed).toMatchObject({
      allowed: true,
      reason: "allow_explicit_grant",
      grant: { permissionKey: "tasks:assign_scope" },
    });
  });

  it("allows simple-mode task assignment for active same-company board operators without explicit grants", async () => {
    const company = await createCompany(db, "BoardAssignmentDefault");
    const userId = `user-${randomUUID()}`;
    const targetAgent = await createAgent(db, { role: "engineer" });
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);

    const decision = await authorizationService(db).decide({
      actor: { type: "board", userId, source: "session" },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allow_simple_company_member",
    });
  });

  it("allows null-mapped visibility actions for active same-company board members", async () => {
    const company = await createCompany(db, "BoardVisibility");
    const userId = `user-${randomUUID()}`;
    const project = await createProject(db, "Visible");
    const targetAgent = await createAgent(db, { role: "engineer" });
    const issue = await createIssue(db, { projectId: project.id });
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "member",
    }).onConflictDoUpdate(membershipUpsert);

    const authorization = authorizationService(db);
    const actor = { type: "board" as const, userId, source: "session" as const };

    await expect(authorization.decide({
      actor,
      action: "agent:read",
      resource: { type: "agent", agentId: targetAgent.id },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
    await expect(authorization.decide({
      actor,
      action: "company_scope:read",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
    await expect(authorization.decide({
      actor,
      action: "project:read",
      resource: { type: "project", projectId: project.id },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
    await expect(authorization.decide({
      actor,
      action: "issue:read",
      resource: {
        type: "issue",
        issueId: issue.id,
        projectId: issue.projectId,
        parentIssueId: issue.parentId,
        status: issue.status,
      },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
    await expect(authorization.decide({
      actor,
      action: "runtime:manage",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
    await expect(authorization.decide({
      actor,
      action: "secrets:read",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
  });

  it("allows same-company non-viewer board members to comment and mutate issues assigned to another agent", async () => {
    const company = await createCompany(db, "BoardIssueMutation");
    const userId = `user-${randomUUID()}`;
    const assignee = await createAgent(db, { role: "engineer" });
    const issue = await createIssue(db, { assigneeAgentId: assignee.id });
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);

    const authorization = authorizationService(db);
    const actor = { type: "board" as const, userId, source: "board_key" as const };
    const resource = {
      type: "issue" as const,
      issueId: issue.id,
      projectId: issue.projectId,
      parentIssueId: issue.parentId,
      assigneeAgentId: issue.assigneeAgentId,
      assigneeUserId: issue.assigneeUserId,
      status: issue.status,
    };

    await expect(authorization.decide({
      actor,
      action: "issue:comment",
      resource,
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
    await expect(authorization.decide({
      actor,
      action: "issue:mutate",
      resource,
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
  });

  it("denies same-company viewer board members issue comment and mutation", async () => {
    const company = await createCompany(db, "BoardViewerIssueMutation");
    const userId = `user-${randomUUID()}`;
    const assignee = await createAgent(db, { role: "engineer" });
    const issue = await createIssue(db, { assigneeAgentId: assignee.id });
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "viewer",
    }).onConflictDoUpdate(membershipUpsert);

    const authorization = authorizationService(db);
    const actor = { type: "board" as const, userId, source: "board_key" as const };
    const resource = {
      type: "issue" as const,
      issueId: issue.id,
      projectId: issue.projectId,
      parentIssueId: issue.parentId,
      assigneeAgentId: issue.assigneeAgentId,
      assigneeUserId: issue.assigneeUserId,
      status: issue.status,
    };

    await expect(authorization.decide({
      actor,
      action: "issue:comment",
      resource,
    })).resolves.toMatchObject({ allowed: false, reason: "deny_missing_grant" });
    await expect(authorization.decide({
      actor,
      action: "issue:mutate",
      resource,
    })).resolves.toMatchObject({ allowed: false, reason: "deny_missing_grant" });
  });

  it("denies null-mapped visibility actions for board users without an active membership", async () => {
    const otherCompany = await createCompany(db, "BoardVisibilityOther");
    const inactiveUserId = `user-${randomUUID()}`;
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: inactiveUserId,
      status: "removed",
      membershipRole: "member",
    }).onConflictDoUpdate(membershipUpsert);

    const authorization = authorizationService(db);

    await expect(authorization.decide({
      actor: { type: "board", userId: inactiveUserId, source: "session" },
      action: "company_scope:read",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_missing_membership" });
  });

  it("allows legacy member roles to wake agents while rejecting incomplete task mutation scope", async () => {
    const company = await createCompany(db, "BoardWake");
    const userId = `user-${randomUUID()}`;
    const targetAgent = await createAgent(db, { role: "engineer" });
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "member",
    }).onConflictDoUpdate(membershipUpsert);

    const authorization = authorizationService(db);

    await expect(authorization.decide({
      actor: { type: "board", userId, source: "session" },
      action: "agent:wake",
      resource: { type: "agent", agentId: targetAgent.id },
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_simple_company_member",
    });
    const issue = await createIssue(db, { title: "Wake denied issue" });
    await expect(authorization.decide({
      actor: { type: "board", userId, source: "session" },
      action: "issue:mutate",
      resource: { type: "issue", issueId: issue.id },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_unsupported_action",
    });
  });

  it("allows mentioned agents to read and comment on assigned issues without granting issue mutation", async () => {
    const company = await createCompany(db, "MentionCommentAuth");
    const allowedProject = await createProject(db, "MentionAllowed");
    const targetProject = await createProject(db, "MentionTarget");
    const ownerAgent = await createAgent(db, { role: "engineer" });
    const mentionedAgent = await createAgent(db, {
      role: "engineer",
      permissions: {
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [allowedProject.id],
          },
        },
      },
    });
    const issue = await createIssue(db, {
      title: "Mention-scoped comment target",
      projectId: targetProject.id,
      assigneeAgentId: ownerAgent.id,
    });

    const authorization = authorizationService(db);
    const actor = { type: "agent", agentId: mentionedAgent.id, source: "agent_key" } as const;
    const resource = {
      type: "issue",
      issueId: issue.id,
      projectId: issue.projectId,
      assigneeAgentId: ownerAgent.id,
      status: issue.status,
    } as const;

    await expect(authorization.decide({
      actor,
      action: "issue:comment",
      resource,
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });

    const deletedMention = await db.insert(issueComments).values({
      issueId: issue.id,
      body: `[@Mentioned Agent](agent://${mentionedAgent.id}) this deleted comment should not count`,
      deletedAt: new Date(),
    }).returning().then((rows) => rows[0]!);
    expect(deletedMention.id).toBeTruthy();

    await expect(authorization.decide({
      actor,
      action: "issue:comment",
      resource,
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });

    await db.insert(issueComments).values({
      issueId: issue.id,
      body: `[@Mentioned Agent](agent://${mentionedAgent.id}) please respond here`,
      authorAgentId: ownerAgent.id,
    });

    await expect(authorization.decide({
      actor,
      action: "issue:read",
      resource,
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_issue_mention_grant",
    });
    await expect(authorization.decide({
      actor,
      action: "issue:comment",
      resource,
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_issue_mention_grant",
    });
    await expect(authorization.decide({
      actor,
      action: "issue:mutate",
      resource,
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
  });

  it("allows a mentioned non-assignee to comment when the mention author is the issue assignee", async () => {
    const company = await createCompany(db, "MentionCommentAssigneeGrant");
    const allowedProject = await createProject(db, "MentionAssigneeAllowed");
    const targetProject = await createProject(db, "MentionAssigneeTarget");
    const assigneeAgent = await createAgent(db, { role: "coach" });
    const mentionedAgent = await createAgent(db, {
      role: "qa",
      permissions: {
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [allowedProject.id],
          },
        },
      },
    });
    const issue = await createIssue(db, {
      title: "Assignee-authored mention reply target",
      projectId: targetProject.id,
      assigneeAgentId: assigneeAgent.id,
    });
    await db.insert(issueComments).values({
      issueId: issue.id,
      authorAgentId: assigneeAgent.id,
      authorType: "agent",
      body: `[@QA](agent://${mentionedAgent.id}) please reply on this issue.`,
    });

    await expect(authorizationService(db).decide({
      actor: { type: "agent", agentId: mentionedAgent.id, source: "agent_key" },
      action: "issue:comment",
      resource: {
        type: "issue",
        issueId: issue.id,
        projectId: issue.projectId,
        assigneeAgentId: assigneeAgent.id,
        status: issue.status,
      },
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_issue_mention_grant",
    });
  });

  it("does not grant mention-scoped issue access from self-authored or unauthorized-author comments", async () => {
    const company = await createCompany(db, "MentionCommentDenied");
    const allowedProject = await createProject(db, "MentionDeniedAllowed");
    const targetProject = await createProject(db, "MentionDeniedTarget");
    const ownerAgent = await createAgent(db, { role: "engineer" });
    const mentionedAgent = await createAgent(db, {
      role: "engineer",
      permissions: {
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [allowedProject.id],
          },
        },
      },
    });
    const unrelatedAgent = await createAgent(db, { role: "engineer" });
    const issue = await createIssue(db, {
      title: "Mention-scoped comment denial target",
      projectId: targetProject.id,
      assigneeAgentId: ownerAgent.id,
    });

    const authorization = authorizationService(db);
    const actor = { type: "agent", agentId: mentionedAgent.id, source: "agent_key" } as const;
    const resource = {
      type: "issue",
      issueId: issue.id,
      projectId: issue.projectId,
      assigneeAgentId: ownerAgent.id,
      status: issue.status,
    } as const;

    await db.insert(issueComments).values([
      {
        issueId: issue.id,
        body: `Self mention [@Mentioned Agent](agent://${mentionedAgent.id})`,
        authorAgentId: mentionedAgent.id,
      },
      {
        issueId: issue.id,
        body: `Unauthorized mention [@Mentioned Agent](agent://${mentionedAgent.id})`,
        authorAgentId: unrelatedAgent.id,
      },
    ]);

    await expect(authorization.decide({
      actor,
      action: "issue:read",
      resource,
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
    await expect(authorization.decide({
      actor,
      action: "issue:comment",
      resource,
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
  });

  it("allows active board-user comments to create mention-scoped issue grants", async () => {
    const company = await createCompany(db, "MentionCommentBoardGrant");
    const allowedProject = await createProject(db, "MentionBoardAllowed");
    const targetProject = await createProject(db, "MentionBoardTarget");
    const ownerAgent = await createAgent(db, { role: "engineer" });
    const mentionedAgent = await createAgent(db, {
      role: "engineer",
      permissions: {
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [allowedProject.id],
          },
        },
      },
    });
    const issue = await createIssue(db, {
      title: "Mention-scoped board grant target",
      projectId: targetProject.id,
      assigneeAgentId: ownerAgent.id,
    });
    const boardUserId = `user-${randomUUID()}`;
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: boardUserId,
      status: "active",
      membershipRole: "member",
    }).onConflictDoUpdate(membershipUpsert);
    await db.insert(issueComments).values({
      issueId: issue.id,
      body: `Board mention [@Mentioned Agent](agent://${mentionedAgent.id})`,
      authorUserId: boardUserId,
    });

    const actor = { type: "agent", agentId: mentionedAgent.id, source: "agent_key" } as const;
    const resource = {
      type: "issue",
      issueId: issue.id,
      projectId: issue.projectId,
      assigneeAgentId: ownerAgent.id,
      status: issue.status,
    } as const;

    await expect(authorizationService(db).decide({
      actor,
      action: "issue:comment",
      resource,
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_issue_mention_grant",
    });
  });

  it.each(["session", "cloud_tenant"] as const)("allows %s operators to start agents, without granting hiring rights", async (source) => {
    const company = await createCompany(db, "wake");
    const agent = await createAgent(db);
    const userId = await createUser(db);
    await db.insert(companyMemberships).values({ principalType: "user", principalId: userId, status: "active", membershipRole: "operator" }).onConflictDoUpdate(membershipUpsert);
    const auth = authorizationService(db);
    const actor = { type: "board" as const, source, userId, companyIds: [company.id] };
    const resource = { type: "agent" as const, agentId: agent.id };
    expect(await auth.decide({ actor, action: "agent:wake", resource })).toMatchObject({ allowed: true });
    expect(await auth.decide({ actor, action: "agents:create", resource: { type: "company" } })).toMatchObject({ allowed: false });
    await db.update(companyMemberships).set({ membershipRole: "viewer" }).where(eq(companyMemberships.principalId, userId));
    expect(await auth.decide({ actor, action: "agent:wake", resource })).toMatchObject({ allowed: false });
    await db.update(companyMemberships).set({ membershipRole: "operator", status: "suspended" }).where(eq(companyMemberships.principalId, userId));
    expect(await auth.decide({ actor, action: "agent:wake", resource })).toMatchObject({ allowed: false });
    const otherCompany = await createCompany(db, "other-wake");
    expect(await auth.decide({ actor, action: "agent:wake", resource: { ...resource } })).toMatchObject({ allowed: false });
  });

  it("limits viewer members to read-only visibility actions", async () => {
    const company = await createCompany(db, "BoardViewerVisibility");
    const userId = `user-${randomUUID()}`;
    const targetAgent = await createAgent(db, { role: "engineer" });
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "viewer",
    }).onConflictDoUpdate(membershipUpsert);

    const authorization = authorizationService(db);
    const actor = { type: "board", userId, source: "session" } as const;

    await expect(authorization.decide({
      actor,
      action: "agent:read",
      resource: { type: "agent", agentId: targetAgent.id },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
    await expect(authorization.decide({
      actor,
      action: "company_scope:read",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_simple_company_member" });
    await expect(authorization.decide({
      actor,
      action: "runtime:manage",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_missing_grant" });
    await expect(authorization.decide({
      actor,
      action: "secrets:read",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_missing_grant" });
  });

  it("denies legacy board assignment context for viewers", async () => {
    const company = await createCompany(db, "BoardViewerAssignment");
    const userId = `user-${randomUUID()}`;
    const targetAgent = await createAgent(db, { role: "engineer" });
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "viewer",
    }).onConflictDoUpdate(membershipUpsert);

    const decision = await authorizationService(db).decide({
      actor: { type: "board", userId, companyIds: [company.id], source: "session" },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "deny_missing_grant",
    });
  });

  it("never elevates cloud_tenant actors through stale instance_admin rows", async () => {
    const tenantCompany = await createCompany(db, "CloudTenantStale");
    const otherCompany = tenantCompany;
    const userId = `user-${randomUUID()}`;
    const targetAgent = await createAgent(db, { role: "engineer" });
    // Stale grant left behind by a pre-hardening cloud_tenant deployment.
    await db.insert(instanceUserRoles).values({ userId, role: "instance_admin" });

    const decision = await authorizationService(db).decide({
      actor: {
        type: "board",
        userId,
        companyIds: [tenantCompany.id],
        isInstanceAdmin: false,
        source: "cloud_tenant",
      },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).not.toBe("allow_instance_admin");

    // Control: the instanceUserRoles lookup still elevates non-cloud_tenant
    // board actors, so the carve-out is scoped to the tenant contract only.
    const sessionDecision = await authorizationService(db).decide({
      actor: { type: "board", userId, companyIds: [tenantCompany.id], source: "session" },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });
    expect(sessionDecision).toMatchObject({ allowed: true, reason: "allow_instance_admin" });
  });

  it("trusts the computed isInstanceAdmin flag on cloud_tenant actors", async () => {
    // The trusted-header resolver is the only code path that can set
    // isInstanceAdmin on a cloud_tenant actor (stack owner +
    // enableOwnerInstanceAdmin). The authorization service must honor the
    // computed flag without consulting instance_user_roles.
    const tenantCompany = await createCompany(db, "CloudTenantOwnerAdmin");
    const otherCompany = await createCompany(db, "CloudTenantOwnerAdminOther");
    const userId = `user-${randomUUID()}`;
    const targetAgent = await createAgent(db, { role: "engineer" });
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "owner",
    }).onConflictDoUpdate(membershipUpsert);
    // Deliberately NO instanceUserRoles row: elevation is computed, not stored.

    const decision = await authorizationService(db).decide({
      actor: {
        type: "board",
        userId,
        companyIds: [tenantCompany.id],
        isInstanceAdmin: true,
        source: "cloud_tenant",
      },
      action: "tasks:assign",
      resource: { type: "issue", assigneeAgentId: targetAgent.id },
      scope: { assigneeAgentId: targetAgent.id },
    });
    expect(decision).toMatchObject({ allowed: true, reason: "allow_instance_admin" });
  });

  it("preserves legacy CEO agent creator authority", async () => {
    const company = await createCompany(db, "Legacy");
    const actorAgent = await createAgent(db, { role: "ceo" });

    const decision = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_jwt" },
      action: "agents:create",
      resource: { type: "company" },
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allow_legacy_agent_creator",
    });
  });

  it("grants hire authority through the persisted new-agent default", async () => {
    const company = await createCompany(db, "DefaultHire");
    // The service create path persists the create-context default
    // (canCreateAgents: true for standard trust); enforcement reads it back.
    const actorAgent = await createAgent(db, {
      role: "engineer",
      permissions: { canCreateAgents: true, canCreateSkills: true },
    });

    const decision = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_jwt" },
      action: "agents:create",
      resource: { type: "company" },
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allow_legacy_agent_creator",
    });
  });

  it("keeps legacy rows without an explicit canCreateAgents fail-closed", async () => {
    const company = await createCompany(db, "LegacyRowFailClosed");
    const actorAgent = await createAgent(db, { role: "engineer", permissions: {} });

    const decision = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_jwt" },
      action: "agents:create",
      resource: { type: "company" },
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "deny_missing_grant",
    });
  });

  it("denies agent creation for a low-trust boundary even with explicit canCreateAgents", async () => {
    const company = await createCompany(db, "LowTrustHireDenied");
    const project = await createProject(db, "Contained");
    const actorAgent = await createAgent(db, {
      permissions: {
        canCreateAgents: true,
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [project.id],
          },
        },
      },
    });

    const decision = await authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_jwt" },
      action: "agents:create",
      resource: { type: "company" },
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "deny_low_trust_boundary",
    });
  });

  it("allows scoped assignment inside a granted project and denies other projects", async () => {
    const company = await createCompany(db, "ProjectScope");
    const project = await createProject(db, "Allowed");
    const otherProject = await createProject(db, "Denied");
    const actorAgent = await createAgent(db);
    const targetAgent = await createAgent(db);
    await grantAgentPermission(db, actorAgent.id, "tasks:assign_scope", {
      projectIds: [project.id],
    });

    const allowed = await authorizationService(db).decidePrincipalGrant({
      principalType: "agent",
      principalId: actorAgent.id,
      action: "tasks:assign",
      permissionKey: "tasks:assign_scope",
      scope: { projectId: project.id, assigneeAgentId: targetAgent.id },
    });
    const denied = await authorizationService(db).decidePrincipalGrant({
      principalType: "agent",
      principalId: actorAgent.id,
      action: "tasks:assign",
      permissionKey: "tasks:assign_scope",
      scope: { projectId: otherProject.id, assigneeAgentId: targetAgent.id },
    });

    expect(allowed).toMatchObject({
      allowed: true,
      grant: { permissionKey: "tasks:assign_scope" },
    });
    expect(denied).toMatchObject({
      allowed: false,
      reason: "deny_scope",
    });
    expect(denied.explanation).toContain("does not cover the requested scope");
  });

  it("treats unknown grant scope metadata as unconstrained", async () => {
    const company = await createCompany(db, "UnknownScopeMetadata");
    const actorAgent = await createAgent(db);
    const targetAgent = await createAgent(db);
    await grantAgentPermission(db, actorAgent.id, "tasks:assign_scope", {
      note: "CEO-approved",
    });

    const decision = await authorizationService(db).decidePrincipalGrant({
      principalType: "agent",
      principalId: actorAgent.id,
      action: "tasks:assign",
      permissionKey: "tasks:assign_scope",
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: true,
      grant: { permissionKey: "tasks:assign_scope" },
    });
  });

  it("allows scoped assignment to agents inside a managed subtree only", async () => {
    const company = await createCompany(db, "SubtreeScope");
    const actorAgent = await createAgent(db);
    const managerAgent = await createAgent(db);
    const childAgent = await createAgent(db, { reportsTo: managerAgent.id });
    const grandchildAgent = await createAgent(db, { reportsTo: childAgent.id });
    const outsideAgent = await createAgent(db);
    await grantAgentPermission(db, actorAgent.id, "tasks:assign_scope", {
      managedSubtreeAgentIds: [managerAgent.id],
    });

    const allowed = await authorizationService(db).decidePrincipalGrant({
      principalType: "agent",
      principalId: actorAgent.id,
      action: "tasks:assign",
      permissionKey: "tasks:assign_scope",
      scope: { assigneeAgentId: grandchildAgent.id },
    });
    const denied = await authorizationService(db).decidePrincipalGrant({
      principalType: "agent",
      principalId: actorAgent.id,
      action: "tasks:assign",
      permissionKey: "tasks:assign_scope",
      scope: { assigneeAgentId: outsideAgent.id },
    });

    expect(allowed.allowed).toBe(true);
    expect(allowed.grant?.permissionKey).toBe("tasks:assign_scope");
    expect(denied).toMatchObject({
      allowed: false,
      reason: "deny_scope",
    });
  });

  it("allows scoped assignment to an explicit target-agent allowlist only", async () => {
    const company = await createCompany(db, "AllowlistScope");
    const actorAgent = await createAgent(db);
    const allowedTarget = await createAgent(db);
    const deniedTarget = await createAgent(db);
    await grantAgentPermission(db, actorAgent.id, "tasks:assign_scope", {
      assigneeAgentIds: [allowedTarget.id],
    });

    const allowed = await authorizationService(db).decidePrincipalGrant({
      principalType: "agent",
      principalId: actorAgent.id,
      action: "tasks:assign",
      permissionKey: "tasks:assign_scope",
      scope: { assigneeAgentId: allowedTarget.id },
    });
    const denied = await authorizationService(db).decidePrincipalGrant({
      principalType: "agent",
      principalId: actorAgent.id,
      action: "tasks:assign",
      permissionKey: "tasks:assign_scope",
      scope: { assigneeAgentId: deniedTarget.id },
    });

    expect(allowed.allowed).toBe(true);
    expect(denied.allowed).toBe(false);
  });

  it("preserves unscoped tasks:assign compatibility for assignment decisions", async () => {
    const company = await createCompany(db, "BroadAssign");
    const actorAgent = await createAgent(db);
    const targetAgent = await createAgent(db);
    await grantAgentPermission(db, actorAgent.id, "tasks:assign");

    const decision = await authorizationService(db).decidePrincipalGrant({
      principalType: "agent",
      principalId: actorAgent.id,
      action: "tasks:assign",
      permissionKey: "tasks:assign",
      scope: { assigneeAgentId: targetAgent.id },
    });

    expect(decision).toMatchObject({
      allowed: true,
      grant: { permissionKey: "tasks:assign" },
    });
  });

  it("scopes task bridge JWTs away from company-wide reads and unrelated issue writes", async () => {
    const company = await createCompany(db, "TaskBridge");
    const bridgeAgent = await createAgent(db);
    const targetAgent = await createAgent(db);
    const project = await createProject(db, "Bridge");
    const parentIssue = await createIssue(db, { projectId: project.id });
    const assignedIssue = await createIssue(db, { assigneeAgentId: bridgeAgent.id });
    const keyId = randomUUID();
    const bridgeCreatedIssue = await createIssue(db, {
      originKind: "task_bridge",
      originId: keyId,
    });
    const unrelatedIssue = await createIssue(db);
    const actor = {
      type: "agent" as const,
      agentId: bridgeAgent.id,
      source: "agent_jwt" as const,
      keyId,
      keyScope: {
        kind: "task_bridge" as const,
        parentIssueId: parentIssue.id,
        allowedAssigneeAgentIds: [targetAgent.id],
      },
    };
    const authz = authorizationService(db);

    await expect(authz.decide({
      actor,
      action: "company_scope:read",
      resource: { type: "company" },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_scope",
    });

    await expect(authz.decide({
      actor,
      action: "tasks:assign",
      resource: {
        type: "issue",
        parentIssueId: parentIssue.id,
        assigneeAgentId: targetAgent.id,
      },
    })).resolves.toMatchObject({
      allowed: true,
    });

    await expect(authz.decide({
      actor,
      action: "tasks:assign",
      resource: {
        type: "issue",
        projectId: project.id,
        assigneeUserId: randomUUID(),
      },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_scope",
    });

    await expect(authz.decide({
      actor,
      action: "issue:comment",
      resource: {
        type: "issue",
        issueId: assignedIssue.id,
      },
    })).resolves.toMatchObject({
      allowed: true,
    });

    await expect(authz.decide({
      actor,
      action: "issue:mutate",
      resource: {
        type: "issue",
        issueId: bridgeCreatedIssue.id,
      },
    })).resolves.toMatchObject({
      allowed: true,
    });

    await expect(authz.decide({
      actor,
      action: "issue:mutate",
      resource: {
        type: "issue",
        issueId: unrelatedIssue.id,
      },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_scope",
    });

    await expect(authz.decide({
      actor,
      action: "agent_config:read",
      resource: {
        type: "agent",
        agentId: bridgeAgent.id,
      },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_scope",
    });
  });

  it("scopes skill-test keys to their own issue only", async () => {
    const company = await createCompany(db, "SkillTest");
    const skillTestAgent = await createAgent(db);
    const ownIssue = await createIssue(db, { assigneeAgentId: skillTestAgent.id });
    const otherIssue = await createIssue(db);
    const actor = {
      type: "agent" as const,
      agentId: skillTestAgent.id,
      source: "agent_key" as const,
      keyScope: {
        kind: "skill_test" as const,
        issueId: ownIssue.id,
      },
    };
    const authz = authorizationService(db);

    for (const action of ["issue:read", "issue:comment", "issue:mutate"] as const) {
      await expect(authz.decide({
        actor,
        action,
        resource: {
          type: "issue",
          issueId: ownIssue.id,
        },
      })).resolves.toMatchObject({
        allowed: true,
      });
    }

    await expect(authz.decide({
      actor,
      action: "issue:mutate",
      resource: {
        type: "issue",
        issueId: otherIssue.id,
      },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_scope",
    });

    await expect(authz.decide({
      actor,
      action: "company_scope:read",
      resource: { type: "company" },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_scope",
    });

    await expect(authz.decide({
      actor,
      action: "tasks:assign",
      resource: {
        type: "issue",
        parentIssueId: ownIssue.id,
        assigneeAgentId: skillTestAgent.id,
      },
    })).resolves.toMatchObject({
      allowed: false,
      reason: "deny_scope",
    });
  });

  it("allows responsible-user inbox management by default", async () => {
    const company = await createCompany(db, "InboxDefaultOpen");
    const actorAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);

    await expect(authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "inbox:manage",
      resource: { type: "company" },
    })).resolves.toMatchObject({
      allowed: true,
      reason: "allow_self",
      inboxPolicyMode: "open",
    });
  });

  it("denies responsible-user inbox management when disabled", async () => {
    const company = await createCompany(db, "InboxDisabled");
    const actorAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);
    await db.insert(userInboxAgentPolicies).values({
      userId: responsibleUserId,
      mode: "disabled",
    });

    await expect(authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "inbox:manage",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: false, reason: "inbox_management_disabled" });
  });

  it("enforces responsible-user inbox allowlists", async () => {
    const company = await createCompany(db, "InboxAllowlist");
    const allowedAgent = await createAgent(db);
    const deniedAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);
    await db.insert(userInboxAgentPolicies).values({
      userId: responsibleUserId,
      mode: "allowlist",
      allowedAgentIds: [allowedAgent.id],
    });
    const decideFor = (agentId: string) => authorizationService(db).decide({
      actor: {
        type: "agent" as const,
        agentId,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt" as const,
      },
      action: "inbox:manage" as const,
      resource: { type: "company" as const },
    });

    await expect(decideFor(allowedAgent.id)).resolves.toMatchObject({
      allowed: true,
      reason: "allow_self",
      inboxPolicyMode: "allowlist",
    });
    await expect(decideFor(deniedAgent.id)).resolves.toMatchObject({
      allowed: false,
      reason: "inbox_agent_not_allowed",
    });
  });

  it("requires a grant for cross-user inbox management", async () => {
    const company = await createCompany(db, "InboxCrossUserDenied");
    const actorAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    const targetUserId = await createUser(db);
    await db.insert(companyMemberships).values([
      {
        principalType: "user",
        principalId: responsibleUserId,
        status: "active",
        membershipRole: "operator",
      },
      {
        principalType: "user",
        principalId: targetUserId,
        status: "active",
        membershipRole: "operator",
      },
    ]).onConflictDoUpdate(membershipUpsert);

    await expect(authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "inbox:manage",
      resource: { type: "company" },
      scope: { userId: targetUserId },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_missing_grant" });
  });

  it("honors a target user's saved inbox policy for cross-user management", async () => {
    const company = await createCompany(db, "InboxCrossUserPolicy");
    const actorAgent = await createAgent(db);
    const deniedAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    const allowlistTargetUserId = await createUser(db);
    const openTargetUserId = await createUser(db);
    await db.insert(companyMemberships).values([
      {
        principalType: "user",
        principalId: responsibleUserId,
        status: "active",
        membershipRole: "operator",
      },
      {
        principalType: "user",
        principalId: allowlistTargetUserId,
        status: "active",
        membershipRole: "operator",
      },
      {
        principalType: "user",
        principalId: openTargetUserId,
        status: "active",
        membershipRole: "operator",
      },
    ]).onConflictDoUpdate(membershipUpsert);
    await db.insert(userInboxAgentPolicies).values([
      {
        userId: allowlistTargetUserId,
        mode: "allowlist",
        allowedAgentIds: [actorAgent.id],
      },
      {
        userId: openTargetUserId,
        mode: "open",
      },
    ]);
    const decideFor = (agentId: string, userId: string) => authorizationService(db).decide({
      actor: {
        type: "agent" as const,
        agentId,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt" as const,
      },
      action: "inbox:manage" as const,
      resource: { type: "company" as const },
      scope: { userId },
    });

    await expect(decideFor(actorAgent.id, allowlistTargetUserId)).resolves.toMatchObject({
      allowed: true,
      reason: "allow_user_inbox_policy",
      inboxPolicyMode: "allowlist",
    });
    await expect(decideFor(deniedAgent.id, allowlistTargetUserId)).resolves.toMatchObject({
      allowed: false,
      reason: "inbox_agent_not_allowed",
    });
    await expect(decideFor(actorAgent.id, openTargetUserId)).resolves.toMatchObject({
      allowed: true,
      reason: "allow_user_inbox_policy",
      inboxPolicyMode: "open",
    });
  });

  it("allows cross-user inbox management with an unscoped grant", async () => {
    const company = await createCompany(db, "InboxCrossUserGranted");
    const actorAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    const targetUserId = await createUser(db);
    await db.insert(companyMemberships).values([
      {
        principalType: "user",
        principalId: responsibleUserId,
        status: "active",
        membershipRole: "operator",
      },
      {
        principalType: "user",
        principalId: targetUserId,
        status: "active",
        membershipRole: "operator",
      },
    ]).onConflictDoUpdate(membershipUpsert);
    await grantAgentPermission(db, actorAgent.id, "inbox:manage");

    await expect(authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "inbox:manage",
      resource: { type: "company" },
      scope: { userId: targetUserId },
    })).resolves.toMatchObject({ allowed: true, reason: "allow_explicit_grant" });
  });

  it("keeps a default inbox grant within the responsible user's policy", async () => {
    const company = await createCompany(db, "InboxDefaultScoped");
    const actorAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    const disabledUserId = await createUser(db);
    const disallowedUserId = await createUser(db);
    await db.insert(companyMemberships).values(
      [responsibleUserId, disabledUserId, disallowedUserId].map((principalId) => ({
        principalType: "user" as const,
        principalId,
        status: "active" as const,
        membershipRole: "operator" as const,
      })),
    ).onConflictDoUpdate(membershipUpsert);
    await db.insert(userInboxAgentPolicies).values([
      { userId: disabledUserId, mode: "disabled" },
      { userId: disallowedUserId, mode: "allowlist", allowedAgentIds: [] },
    ]);
    await grantAgentPermission(db, actorAgent.id, "inbox:manage", { responsibleUserOnly: true });
    const decideFor = (userId: string) => authorizationService(db).decide({
      actor: {
        type: "agent" as const,
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt" as const,
      },
      action: "inbox:manage" as const,
      resource: { type: "company" as const },
      scope: { userId },
    });

    await expect(decideFor(responsibleUserId)).resolves.toMatchObject({ allowed: true, reason: "allow_self" });
    await expect(decideFor(disabledUserId)).resolves.toMatchObject({ allowed: false, reason: "inbox_management_disabled" });
    await expect(decideFor(disallowedUserId)).resolves.toMatchObject({ allowed: false, reason: "inbox_agent_not_allowed" });
  });

  it("enforces user-scoped cross-user inbox grants", async () => {
    const company = await createCompany(db, "InboxCrossUserScoped");
    const actorAgent = await createAgent(db);
    const responsibleUserId = await createUser(db);
    const allowedTargetUserId = await createUser(db);
    const deniedTargetUserId = await createUser(db);
    await db.insert(companyMemberships).values([
      {
        principalType: "user",
        principalId: responsibleUserId,
        status: "active",
        membershipRole: "operator",
      },
      {
        principalType: "user",
        principalId: allowedTargetUserId,
        status: "active",
        membershipRole: "operator",
      },
      {
        principalType: "user",
        principalId: deniedTargetUserId,
        status: "active",
        membershipRole: "operator",
      },
    ]).onConflictDoUpdate(membershipUpsert);
    await grantAgentPermission(db, actorAgent.id, "inbox:manage", {
      userIds: [allowedTargetUserId],
    });
    const decideFor = (userId: string) => authorizationService(db).decide({
      actor: {
        type: "agent" as const,
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt" as const,
      },
      action: "inbox:manage" as const,
      resource: { type: "company" as const },
      scope: { userId },
    });

    await expect(decideFor(allowedTargetUserId)).resolves.toMatchObject({
      allowed: true,
      reason: "allow_explicit_grant",
    });
    await expect(decideFor(deniedTargetUserId)).resolves.toMatchObject({ allowed: false, reason: "deny_scope" });
  });

  it("denies inbox management when the target user cannot be resolved", async () => {
    const company = await createCompany(db, "InboxUnresolved");
    const actorAgent = await createAgent(db);

    await expect(authorizationService(db).decide({
      actor: { type: "agent", agentId: actorAgent.id, source: "agent_key" },
      action: "inbox:manage",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: false, reason: "inbox_target_user_unresolved" });
  });

  it("denies low-trust inbox management", async () => {
    const company = await createCompany(db, "InboxLowTrust");
    const project = await createProject(db, "InboxLowTrust");
    const responsibleUserId = await createUser(db);
    const actorAgent = await createAgent(db, {
      permissions: {
        trustPreset: LOW_TRUST_REVIEW_PRESET,
        authorizationPolicy: {
          trustBoundary: {
            mode: LOW_TRUST_REVIEW_PRESET,
            projectIds: [project.id],
          },
        },
      },
    });
    await db.insert(companyMemberships).values({
      principalType: "user",
      principalId: responsibleUserId,
      status: "active",
      membershipRole: "operator",
    }).onConflictDoUpdate(membershipUpsert);

    await expect(authorizationService(db).decide({
      actor: {
        type: "agent",
        agentId: actorAgent.id,
        onBehalfOfUserId: responsibleUserId,
        source: "agent_jwt",
      },
      action: "inbox:manage",
      resource: { type: "company" },
    })).resolves.toMatchObject({ allowed: false, reason: "deny_low_trust_boundary" });
  });

  it("denies secrets proposals for scoped tokens regardless of request source", async () => {
    const company = await createCompany(db, "SecretProposalScopes");
    const actorAgent = await createAgent(db);
    const resource = { type: "company" as const };
    const authz = authorizationService(db);

    for (const actor of [
      {
        type: "agent" as const,
        agentId: actorAgent.id,
        source: "agent_jwt" as const,
        keyId: randomUUID(),
        keyScope: { kind: "task_bridge" as const, parentIssueId: randomUUID() },
      },
      {
        type: "agent" as const,
        agentId: actorAgent.id,
        source: "agent_jwt" as const,
        keyScope: { kind: "skill_test" as const, issueId: randomUUID() },
      },
    ]) {
      await expect(authz.decide({ actor, action: "secrets:propose", resource }))
        .resolves.toMatchObject({ allowed: false, reason: "deny_scope" });
    }
  });
});
