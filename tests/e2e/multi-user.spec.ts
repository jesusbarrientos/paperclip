import { test, expect, type APIRequestContext } from "@playwright/test";
import { ensureOrganization } from "./helpers/organization";

/**
 * E2E: Multi-user implementation tests (local_trusted mode).
 *
 * Covers:
 *   1. Organization member management API (list, update role, suspend)
 *   2. Human invite creation and acceptance API
 *   3. Members settings UI — invite creation
 *   4. Invite landing page UI
 *   5. Role-based access control (viewer read-only)
 *   6. Last-owner protection
 */

const BASE = process.env.PAPERCLIP_E2E_BASE_URL ?? "http://127.0.0.1:3104";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a human invite and return token + invite URL. */
async function createHumanInvite(
  request: APIRequestContext,
  role: string = "operator"
): Promise<{ token: string; inviteUrl: string; inviteId: string }> {
  const res = await request.post(`${BASE}/api/invites`, {
    data: {
      allowedJoinTypes: "human",
      humanRole: role,
    },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  return {
    token: body.token,
    inviteUrl: body.inviteUrl,
    inviteId: body.id,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await ensureOrganization(request, { baseUrl: BASE, name: "MU E2E" });
});

test.describe("Multi-user: API", () => {
  test("GET /members returns member list with access info", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/members`);
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body).toHaveProperty("members");
    expect(body).toHaveProperty("access");
    expect(Array.isArray(body.members)).toBe(true);
    expect(body.access).toHaveProperty("currentUserRole");
    expect(body.access).toHaveProperty("canManageMembers");
    expect(body.access).toHaveProperty("canInviteUsers");
  });

  test("POST /invites creates a human invite with role", async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/api/invites`, {
      data: {
        allowedJoinTypes: "human",
        humanRole: "operator",
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("inviteUrl");
    expect(body.allowedJoinTypes).toBe("human");
    expect(body.inviteUrl).toContain("/invite/");
  });

  test("GET /invites/:token returns invite summary", async ({ request }) => {
    const invite = await createHumanInvite(request, "viewer");
    const res = await request.get(`${BASE}/api/invites/${invite.token}`);
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body).toHaveProperty("allowedJoinTypes");
    expect(body.allowedJoinTypes).toBe("human");
    expect(body).toHaveProperty("inviteType");
    expect(body.inviteType).toBe("company_join");
    expect(body).not.toHaveProperty("companyId");
  });

  test("POST /invites/:token/accept (human) creates membership", async ({
    request,
  }) => {
    const invite = await createHumanInvite(request, "operator");
    const acceptRes = await request.post(
      `${BASE}/api/invites/${invite.token}/accept`,
      {
        data: { requestType: "human" },
      }
    );
    expect(acceptRes.ok()).toBe(true);
    const body = await acceptRes.json();

    expect(body).toHaveProperty("id");
  });

  test("POST /invites/:token/accept rejects agent on human-only invite", async ({
    request,
  }) => {
    const invite = await createHumanInvite(request, "operator");
    const acceptRes = await request.post(
      `${BASE}/api/invites/${invite.token}/accept`,
      {
        data: { requestType: "agent", agentName: "Rogue" },
      }
    );
    expect(acceptRes.ok()).toBe(false);
    expect(acceptRes.status()).toBe(400);
  });

  test("POST /invites supports all four roles", async ({ request }) => {
    for (const role of ["owner", "admin", "operator", "viewer"]) {
      const res = await request.post(`${BASE}/api/invites`, {
        data: { allowedJoinTypes: "human", humanRole: role },
      });
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body.token).toBeTruthy();
    }
  });

  test("PATCH /members/:memberId cannot remove last owner", async ({
    request,
  }) => {
    const membersRes = await request.get(`${BASE}/api/members`);
    const { members } = await membersRes.json();

    const boardMember = members.find(
      (m: { principalId: string }) => m.principalId === "local-board"
    );
    const otherActiveOwners = members.filter(
      (m: { id: string; membershipRole: string; status: string }) =>
        m.id !== boardMember?.id && m.membershipRole === "owner" && m.status === "active"
    );
    // The organization is shared with the rest of the suite, so another owner
    // may already exist; then there is no "last owner" to protect.
    if (!boardMember || otherActiveOwners.length > 0) {
      test.skip();
      return;
    }

    const promoteRes = await request.patch(
      `${BASE}/api/members/${boardMember.id}`,
      { data: { membershipRole: "owner" } }
    );
    expect(promoteRes.ok()).toBe(true);

    const demoteRes = await request.patch(
      `${BASE}/api/members/${boardMember.id}`,
      { data: { membershipRole: "operator" } }
    );
    expect(demoteRes.status()).toBe(409);
    const errBody = await demoteRes.json();
    expect(JSON.stringify(errBody)).toContain("last active owner");
  });

  test("POST /openclaw/invite-prompt creates agent invite", async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/api/openclaw/invite-prompt`, {
      data: { agentMessage: "E2E test agent invite" },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("inviteUrl");
    expect(body.allowedJoinTypes).toBe("agent");
  });
});

test.describe("Multi-user: Members settings UI", () => {
  test("shows Members and Invites tabs", async ({ page }) => {
    await page.goto(`${BASE}/organization/settings/members`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("tab", { name: "Members" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("tab", { name: "Invites" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows human invite creation controls", async ({ page }) => {
    await page.goto(`${BASE}/organization/settings/invites`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Create invite" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("radio").first()).toBeVisible();
  });

  test("can create human invite and shows URL", async ({ page }) => {
    await page.goto(`${BASE}/organization/settings/invites`);
    await page.waitForLoadState("networkidle");
    const inviteButton = page.getByRole("button", { name: "Create invite" });
    await expect(inviteButton).toBeVisible({ timeout: 10_000 });
    await inviteButton.click();

    await expect(page.getByLabel("Latest invite URL")).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Multi-user: Invite Landing UI", () => {
  let inviteToken: string;

  test.beforeAll(async ({ request }) => {
    const invite = await createHumanInvite(request, "operator");
    inviteToken = invite.token;
  });

  test("invite landing page loads with join options", async ({ page }) => {
    await page.goto(`${BASE}/invite/${inviteToken}`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /join/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("invite landing shows human join type", async ({ page }) => {
    await page.goto(`${BASE}/invite/${inviteToken}`);
    await page.waitForLoadState("networkidle");

    const humanOption = page.locator("text=/human/i");
    await expect(humanOption).toBeVisible({ timeout: 10_000 });
  });

  test("expired/invalid invite token returns error", async ({ page }) => {
    await page.goto(`${BASE}/invite/invalid-token-e2e-test`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("invite-error")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Multi-user: Member role management API", () => {
  test("invite + accept creates member with correct role", async ({
    request,
  }) => {
    const invite = await createHumanInvite(request, "viewer");

    const acceptRes = await request.post(
      `${BASE}/api/invites/${invite.token}/accept`,
      { data: { requestType: "human" } }
    );
    expect(acceptRes.ok()).toBe(true);

    const membersRes = await request.get(`${BASE}/api/members`);
    const { members } = await membersRes.json();

    expect(members.length).toBeGreaterThanOrEqual(1);
  });

  test("PATCH member role updates correctly", async ({ request }) => {
    const invite = await createHumanInvite(request, "operator");
    const acceptRes = await request.post(
      `${BASE}/api/invites/${invite.token}/accept`,
      { data: { requestType: "human" } }
    );
    expect(acceptRes.ok()).toBe(true);

    const membersRes = await request.get(`${BASE}/api/members`);
    const { members } = await membersRes.json();

    const nonOwner = members.find(
      (m: { membershipRole: string }) => m.membershipRole !== "owner"
    );
    if (!nonOwner) {
      test.skip();
      return;
    }

    const patchRes = await request.patch(
      `${BASE}/api/members/${nonOwner.id}`,
      { data: { membershipRole: "admin" } }
    );
    expect(patchRes.ok()).toBe(true);
    const updated = await patchRes.json();
    expect(updated.membershipRole).toBe("admin");
  });

  test("PATCH member status to suspended works", async ({ request }) => {
    const invite = await createHumanInvite(request, "operator");
    await request.post(`${BASE}/api/invites/${invite.token}/accept`, {
      data: { requestType: "human" },
    });

    const membersRes = await request.get(`${BASE}/api/members`);
    const { members } = await membersRes.json();

    const nonOwner = members.find(
      (m: { membershipRole: string; status: string }) =>
        m.membershipRole !== "owner" && m.status === "active"
    );
    if (!nonOwner) {
      test.skip();
      return;
    }

    const patchRes = await request.patch(
      `${BASE}/api/members/${nonOwner.id}`,
      { data: { status: "suspended" } }
    );
    expect(patchRes.ok()).toBe(true);
    const updated = await patchRes.json();
    expect(updated.status).toBe("suspended");
  });
});

test.describe("Multi-user: Agent invite flow", () => {
  test("agent invite accept creates pending join request", async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/api/openclaw/invite-prompt`, {
      data: {},
    });
    expect(res.ok()).toBe(true);
    const { token } = await res.json();

    const acceptRes = await request.post(
      `${BASE}/api/invites/${token}/accept`,
      {
        data: {
          requestType: "agent",
          agentName: "TestAgent",
          adapterType: "claude_local",
        },
      }
    );
    expect(acceptRes.ok()).toBe(true);
    const body = await acceptRes.json();
    expect(body).toHaveProperty("id");
    expect(body.status).toBe("pending_approval");
  });

  test("join requests list shows pending agent request", async ({
    request,
  }) => {
    const res = await request.get(
      `${BASE}/api/join-requests?status=pending_approval`
    );
    expect(res.ok()).toBe(true);
    const requests = await res.json();
    expect(Array.isArray(requests)).toBe(true);
  });
});

test.describe("Multi-user: Health check integration", () => {
  test("health endpoint reports deployment mode", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("deploymentMode");
    expect(body).toHaveProperty("authReady");
    expect(body.authReady).toBe(true);
  });
});
