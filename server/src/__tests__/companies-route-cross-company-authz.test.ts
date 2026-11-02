import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const organizationId = "11111111-1111-4111-8111-111111111111";
const ceoAgentId = "ceo-agent-a";

const mockCompanyService = vi.hoisted(() => ({
  list: vi.fn(),
  stats: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  list: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  ensureMembership: vi.fn(),
  ensureRoleDefaultGrants: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  upsertPolicy: vi.fn(),
}));

const mockCompanyPortabilityService = vi.hoisted(() => ({
  exportBundle: vi.fn(),
  previewExport: vi.fn(),
  previewImport: vi.fn(),
  importBundle: vi.fn(),
}));

const mockCompanyArtifactsService = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockFeedbackService = vi.hoisted(() => ({
  listFeedbackTraces: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

function registerCompanyRouteMocks() {
  vi.doMock("../services/index.js", () => ({
    accessService: () => mockAccessService,
    agentService: () => mockAgentService,
    budgetService: () => mockBudgetService,
    companyArtifactsService: () => mockCompanyArtifactsService,
    companyPortabilityService: () => mockCompanyPortabilityService,
    companyService: () => mockCompanyService,
    feedbackService: () => mockFeedbackService,
    logActivity: mockLogActivity,
  }));
  vi.doMock("../services/organization.js", () => ({
    organizationService: () => ({
      findId: async () => organizationId,
      requireId: async () => organizationId,
    }),
  }));
}

let appImportCounter = 0;

async function createApp(actor: Record<string, unknown>) {
  registerCompanyRouteMocks();
  appImportCounter += 1;
  const routeModulePath = `../routes/companies.js?cross-company-authz-${appImportCounter}`;
  const middlewareModulePath = `../middleware/index.js?cross-company-authz-${appImportCounter}`;
  const [{ companyRoutes }, { errorHandler }] = await Promise.all([
    import(routeModulePath) as Promise<typeof import("../routes/companies.js")>,
    import(middlewareModulePath) as Promise<typeof import("../middleware/index.js")>,
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api/organization", companyRoutes({} as any));
  app.use(errorHandler);
  return app;
}

function createCompany(id: string = organizationId) {
  const now = new Date("2026-06-18T00:00:00.000Z");
  return {
    id,
    name: "Organization",
    description: null,
    status: "active",
    issuePrefix: "ORG",
    issueCounter: 1,
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    requireBoardApprovalForNewAgents: false,
    feedbackDataSharingEnabled: false,
    logoAssetId: null,
    logoUrl: null,
    createdAt: now,
    updatedAt: now,
  };
}

const exportRequest = {
  include: { company: true, agents: true, projects: true },
};

function exportResult() {
  return {
    rootPath: "paperclip",
    manifest: {
      agents: [],
      skills: [],
      projects: [],
      issues: [],
      envInputs: [],
      includes: { company: true, agents: true, projects: true, issues: false, skills: false },
      company: null,
      schemaVersion: 1,
      generatedAt: "2026-06-18T00:00:00.000Z",
      source: null,
    },
    files: {},
    warnings: [],
  };
}

function exportPreviewResult() {
  return {
    ...exportResult(),
    fileInventory: [],
    counts: { files: 0, agents: 0, skills: 0, projects: 0, issues: 0 },
    paperclipExtensionPath: ".paperclip.yaml",
  };
}

function importRequest() {
  return {
    source: { type: "inline", files: { "COMPANY.md": "---\nname: Imported\n---\n" } },
    include: { company: true, agents: true, projects: false, issues: false },
    target: { mode: "existing_company" },
    collisionStrategy: "rename",
  };
}

function importResult() {
  return {
    company: { id: organizationId, action: "updated" },
    agents: [],
    warnings: [],
  };
}

function resetMockDefaults() {
  mockCompanyService.getById.mockImplementation(async (id: string) => {
    if (id === organizationId) return createCompany(id);
    return null;
  });
  mockCompanyService.update.mockImplementation(async (id: string, body: Record<string, unknown>) => ({
    ...createCompany(id),
    ...body,
  }));
  mockAgentService.getById.mockImplementation(async (id: string) => {
    if (id === ceoAgentId) return { id, role: "ceo" };
    return null;
  });
  mockAgentService.list.mockResolvedValue([]);
  mockCompanyPortabilityService.exportBundle.mockResolvedValue(exportResult());
  mockCompanyPortabilityService.previewExport.mockResolvedValue(exportPreviewResult());
  mockCompanyPortabilityService.previewImport.mockResolvedValue({ ok: true });
  mockCompanyPortabilityService.importBundle.mockResolvedValue(importResult());
}

function assertNoTargetMutationSideEffects() {
  expect(mockCompanyService.update).not.toHaveBeenCalled();
  expect(mockCompanyPortabilityService.exportBundle).not.toHaveBeenCalled();
  expect(mockCompanyPortabilityService.previewExport).not.toHaveBeenCalled();
  expect(mockCompanyPortabilityService.previewImport).not.toHaveBeenCalled();
  expect(mockCompanyPortabilityService.importBundle).not.toHaveBeenCalled();
  expect(mockLogActivity).not.toHaveBeenCalled();
}

function ceoActor() {
  return {
    type: "agent",
    agentId: ceoAgentId,
    source: "agent_key",
    runId: "run-1",
  };
}

function boardActor(input: {
  userId: string;
  memberships?: Array<{ membershipRole: string; status: string }>;
  isInstanceAdmin?: boolean;
  source?: string;
}) {
  return {
    type: "board",
    userId: input.userId,
    source: input.source ?? "session",
    memberships: input.memberships ?? [],
    isInstanceAdmin: input.isInstanceAdmin ?? false,
  };
}

describe("organization route authorization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../routes/authz.js");
    vi.doUnmock("../middleware/index.js");
    vi.clearAllMocks();
    resetMockDefaults();
  });

  it("allows a CEO agent to use CEO-safe organization routes", async () => {
    const app = await createApp(ceoActor());

    await request(app).patch(`/api/organization`).send({ description: "Branding" }).expect(200);
    await request(app).patch(`/api/organization/branding`).send({ description: "Branding" }).expect(200);
    await request(app).post(`/api/organization/export`).send(exportRequest).expect(200);
    await request(app).post(`/api/organization/exports/preview`).send(exportRequest).expect(200);
    await request(app).post(`/api/organization/imports/preview`).send(importRequest()).expect(200);
    await request(app).post(`/api/organization/imports/apply`).send(importRequest()).expect(200);
  });

  it("rejects a non-CEO agent on CEO-safe organization routes", async () => {
    mockAgentService.getById.mockResolvedValue({ id: "engineer", role: "engineer" });
    const app = await createApp({ ...ceoActor(), agentId: "engineer" });

    const res = await request(app).patch(`/api/organization`).send({ description: "Nope" });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Only CEO agents");
    assertNoTargetMutationSideEffects();
  });

  it("covers board actor access for non-member, viewer, active member, local trusted board, and instance admin without membership", async () => {
    const nonMemberApp = await createApp(boardActor({ userId: "outsider" }));
    const nonMember = await request(nonMemberApp).patch(`/api/organization`).send({ description: "Nope" });
    expect(nonMember.status).toBe(403);
    expect(nonMember.body.error).toContain("not an active member");

    vi.clearAllMocks();
    resetMockDefaults();
    const viewerApp = await createApp(boardActor({
      userId: "viewer",
      memberships: [{ membershipRole: "viewer", status: "active" }],
    }));
    const viewerWrite = await request(viewerApp).patch(`/api/organization`).send({ description: "Nope" });
    expect(viewerWrite.status).toBe(403);
    expect(viewerWrite.body.error).toContain("Viewer access is read-only");
    expect(mockCompanyService.update).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();

    vi.clearAllMocks();
    resetMockDefaults();
    const memberApp = await createApp(boardActor({
      userId: "member",
      memberships: [{ membershipRole: "member", status: "active" }],
    }));
    await request(memberApp).patch(`/api/organization`).send({ description: "Updated" }).expect(200);
    await request(memberApp).patch(`/api/organization/branding`).send({ description: "Branding" }).expect(200);
    await request(memberApp).post(`/api/organization/export`).send(exportRequest).expect(200);
    await request(memberApp).post(`/api/organization/exports/preview`).send(exportRequest).expect(200);
    await request(memberApp).post(`/api/organization/imports/preview`).send(importRequest()).expect(200);
    await request(memberApp).post(`/api/organization/imports/apply`).send(importRequest()).expect(200);

    vi.clearAllMocks();
    resetMockDefaults();
    const localTrustedApp = await createApp(boardActor({
      userId: "local-board",
      source: "local_implicit",
      isInstanceAdmin: true,
    }));
    await request(localTrustedApp).patch(`/api/organization`).send({ description: "Local" }).expect(200);

    vi.clearAllMocks();
    resetMockDefaults();
    const adminWithoutMembershipApp = await createApp(boardActor({
      userId: "instance-admin",
      isInstanceAdmin: true,
    }));
    const adminWrite = await request(adminWithoutMembershipApp).patch(`/api/organization`).send({ description: "Admin" });
    expect(adminWrite.status).toBe(403);
    expect(adminWrite.body.error).toContain("not an active member");
    assertNoTargetMutationSideEffects();
  });
});
