import { describe, expect, it } from "vitest";
import type { CurrentBoardAccess } from "@/api/access";
import { canInviteCompanyMembers } from "./useCompanyInviteAccess";

function snapshot(overrides: Partial<CurrentBoardAccess> = {}): CurrentBoardAccess {
  return {
    user: { id: "user-1", email: "jane@example.com", name: "Jane Example", image: null },
    userId: "user-1",
    isInstanceAdmin: false,
    memberships: [{ membershipRole: "operator", status: "active" }],
    source: "session",
    keyId: null,
    ...overrides,
  };
}

describe("canInviteCompanyMembers", () => {
  it("is false until the board access snapshot is known", () => {
    expect(canInviteCompanyMembers(undefined)).toBe(false);
  });

  it("always passes local boards and instance admins", () => {
    expect(canInviteCompanyMembers(snapshot({ source: "local_implicit" }))).toBe(true);
    expect(canInviteCompanyMembers(snapshot({ isInstanceAdmin: true }))).toBe(true);
  });

  it.each(["owner", "admin"] as const)("passes an active %s", (membershipRole) => {
    const access = snapshot({
      memberships: [{ membershipRole, status: "active" }],
    });
    expect(canInviteCompanyMembers(access)).toBe(true);
  });

  it.each(["operator", "viewer", "member", null] as const)("rejects a %s", (membershipRole) => {
    const access = snapshot({
      memberships: [{ membershipRole, status: "active" }],
    });
    expect(canInviteCompanyMembers(access)).toBe(false);
  });

  it("ignores inactive memberships", () => {
    const suspended = snapshot({
      memberships: [{ membershipRole: "owner", status: "suspended" }],
    });
    expect(canInviteCompanyMembers(suspended)).toBe(false);
  });

  it("is false when the snapshot carries no memberships", () => {
    expect(canInviteCompanyMembers(snapshot({ memberships: undefined }))).toBe(false);
  });
});
