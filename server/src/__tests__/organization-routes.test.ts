import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCompanyService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockOrganizationService = vi.hoisted(() => ({
  findId: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  companyService: () => mockCompanyService,
  organizationService: () => mockOrganizationService,
}));

async function createApp(actor: Record<string, unknown>) {
  const [{ organizationRoutes }, { errorHandler }] = await Promise.all([
    import("../routes/organization.js"),
    import("../middleware/index.js"),
  ]);
  const app = express();
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", organizationRoutes({} as any));
  app.use(errorHandler);
  return app;
}

const memberActor = {
  type: "board",
  source: "session",
  userId: "user-1",
  companyIds: ["org-1"],
  memberships: [{ membershipRole: "owner", status: "active" }],
  isInstanceAdmin: false,
};

describe("GET /api/organization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the instance organization to a member", async () => {
    mockOrganizationService.findId.mockResolvedValue("org-1");
    mockCompanyService.getById.mockResolvedValue({ id: "org-1", name: "Acme" });

    const res = await request(await createApp(memberActor)).get("/api/organization");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "org-1", name: "Acme" });
  });

  it("returns 404 organization_missing before onboarding creates it", async () => {
    mockOrganizationService.findId.mockResolvedValue(null);

    const res = await request(await createApp(memberActor)).get("/api/organization");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "organization_missing" });
  });

  it("rejects a board user who is not a member", async () => {
    mockOrganizationService.findId.mockResolvedValue("org-1");

    const res = await request(
      await createApp({ ...memberActor, companyIds: [], memberships: [] }),
    ).get("/api/organization");

    expect(res.status).toBe(403);
    expect(mockCompanyService.getById).not.toHaveBeenCalled();
  });
});
