import { describe, expect, it } from "vitest";
import { HttpError } from "../errors.js";
import { assertBoardOrgAccess, assertOrgAccess, hasBoardOrgAccess, hasOrgAccess } from "../routes/authz.js";

function makeReq(input: {
  method?: string;
  actor: Express.Request["actor"];
}) {
  return {
    method: input.method ?? "GET",
    actor: input.actor,
  } as Express.Request;
}

describe("assertOrgAccess", () => {
  it("allows viewer memberships to read", () => {
    const req = makeReq({
      method: "GET",
      actor: {
        type: "board",
        userId: "user-1",
        source: "session",
        memberships: [
          { membershipRole: "viewer", status: "active" },
        ],
      },
    });

    expect(() => assertOrgAccess(req)).not.toThrow();
  });

  it("rejects viewer memberships for writes", () => {
    const req = makeReq({
      method: "PATCH",
      actor: {
        type: "board",
        userId: "user-1",
        source: "session",
        memberships: [
          { membershipRole: "viewer", status: "active" },
        ],
      },
    });

    expect(() => assertOrgAccess(req)).toThrow("Viewer access is read-only");
  });

  it("rejects writes from users without an active membership", () => {
    const req = makeReq({
      method: "POST",
      actor: {
        type: "board",
        userId: "user-1",
        source: "session",
        memberships: [],
      },
    });

    expect(() => assertOrgAccess(req)).toThrow("User is not an active member of this organization");
  });

  it("rejects signed-in instance admins without a membership", () => {
    const req = makeReq({
      method: "GET",
      actor: {
        type: "board",
        userId: "admin-1",
        source: "session",
        isInstanceAdmin: true,
        memberships: [],
      },
    });

    expect(() => assertOrgAccess(req)).toThrow("User is not an active member of this organization");
  });

  it("allows local trusted board access without explicit membership", () => {
    const req = makeReq({
      method: "GET",
      actor: {
        type: "board",
        userId: "local-board",
        source: "local_implicit",
        isInstanceAdmin: true,
      },
    });

    expect(() => assertOrgAccess(req)).not.toThrow();
  });

  it("fails closed when an on-behalf-of agent lacks a responsible user membership snapshot", () => {
    const req = makeReq({
      method: "GET",
      actor: {
        type: "agent",
        agentId: "agent-1",
        onBehalfOfUserId: "user-1",
        onBehalfOfMemberships: [],
        source: "agent_jwt",
      },
    });

    expect(() => assertOrgAccess(req)).toThrow(HttpError);
    try {
      assertOrgAccess(req);
    } catch (err) {
      expect((err as HttpError).details).toMatchObject({ code: "RESPONSIBLE_USER_UNAVAILABLE" });
    }
  });

  it("rejects on-behalf-of agent writes when the responsible user is read-only", () => {
    const req = makeReq({
      method: "PATCH",
      actor: {
        type: "agent",
        agentId: "agent-1",
        onBehalfOfUserId: "user-1",
        onBehalfOfMemberships: [
          { membershipRole: "viewer", status: "active" },
        ],
        source: "agent_jwt",
      },
    });

    try {
      assertOrgAccess(req);
    } catch (err) {
      expect((err as HttpError).status).toBe(403);
      expect((err as HttpError).details).toMatchObject({ code: "RESPONSIBLE_USER_UNAUTHORIZED" });
      return;
    }
    throw new Error("Expected responsible-user organization access denial");
  });

  it("logs only in shadow mode for responsible-user organization access denials", () => {
    const previous = process.env.PAPERCLIP_RESPONSIBLE_USER_AUTHZ_SHADOW;
    process.env.PAPERCLIP_RESPONSIBLE_USER_AUTHZ_SHADOW = "true";
    try {
      const req = makeReq({
        method: "PATCH",
        actor: {
          type: "agent",
          agentId: "agent-1",
          onBehalfOfUserId: "user-1",
          onBehalfOfMemberships: [],
          source: "agent_jwt",
        },
      });

      expect(() => assertOrgAccess(req)).not.toThrow();
    } finally {
      if (previous === undefined) delete process.env.PAPERCLIP_RESPONSIBLE_USER_AUTHZ_SHADOW;
      else process.env.PAPERCLIP_RESPONSIBLE_USER_AUTHZ_SHADOW = previous;
    }
  });

  it("allows on-behalf-of agent writes for active non-viewer responsible users", () => {
    const req = makeReq({
      method: "PATCH",
      actor: {
        type: "agent",
        agentId: "agent-1",
        onBehalfOfUserId: "user-1",
        onBehalfOfMemberships: [
          { membershipRole: "operator", status: "active" },
        ],
        source: "agent_jwt",
      },
    });

    expect(() => assertOrgAccess(req)).not.toThrow();
  });
});

describe("hasOrgAccess", () => {
  it("allows members of the organization", () => {
    const req = makeReq({
      actor: {
        type: "board",
        userId: "user-1",
        source: "session",
        memberships: [{ membershipRole: "viewer", status: "active" }],
      },
    });

    expect(hasOrgAccess(req)).toBe(true);
  });

  it("denies signed-in instance admins without a membership, matching assertOrgAccess", () => {
    const req = makeReq({
      actor: {
        type: "board",
        userId: "admin-1",
        source: "session",
        isInstanceAdmin: true,
        memberships: [],
      },
    });

    expect(hasOrgAccess(req)).toBe(false);
    expect(() => assertOrgAccess(req)).toThrow("User is not an active member of this organization");
  });

  it("allows local trusted board access without explicit membership", () => {
    const req = makeReq({
      actor: {
        type: "board",
        userId: "local-board",
        source: "local_implicit",
        isInstanceAdmin: true,
      },
    });

    expect(hasOrgAccess(req)).toBe(true);
  });

  it("allows agent actors", () => {
    expect(hasOrgAccess(makeReq({ actor: { type: "agent", agentId: "agent-1" } }))).toBe(true);
  });

  it("denies unauthenticated actors", () => {
    const req = makeReq({ actor: { type: "none" } });

    expect(hasOrgAccess(req)).toBe(false);
  });
});

describe("assertBoardOrgAccess", () => {
  it("allows signed-in board users with an active membership", () => {
    const req = makeReq({
      actor: {
        type: "board",
        userId: "user-1",
        source: "session",
        memberships: [{ membershipRole: "operator", status: "active" }],
        isInstanceAdmin: false,
      },
    });

    expect(hasBoardOrgAccess(req)).toBe(true);
    expect(() => assertBoardOrgAccess(req)).not.toThrow();
  });

  it("allows instance admins without a membership", () => {
    const req = makeReq({
      actor: {
        type: "board",
        userId: "admin-1",
        source: "session",
        memberships: [],
        isInstanceAdmin: true,
      },
    });

    expect(hasBoardOrgAccess(req)).toBe(true);
    expect(() => assertBoardOrgAccess(req)).not.toThrow();
  });

  it("rejects signed-in users without a membership or instance admin rights", () => {
    const req = makeReq({
      actor: {
        type: "board",
        userId: "outsider-1",
        source: "session",
        memberships: [],
        isInstanceAdmin: false,
      },
    });

    expect(hasBoardOrgAccess(req)).toBe(false);
    expect(() => assertBoardOrgAccess(req)).toThrow("Organization membership or instance admin access required");
  });
});
