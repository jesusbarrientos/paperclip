import { describe, expect, it } from "vitest";
import type { Machine, WorkContextState } from "@paperclipai/shared";
import type { CurrentBoardAccess } from "@/api/access";
import {
  canManageMachine,
  canUseMachine,
  capabilityLabels,
  currentLocationKey,
  executionLocationView,
  locationFromKey,
  locationKey,
  platformLabel,
} from "./machines";

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: "m-1",
    name: "Laptop",
    ownerUserId: "user-1",
    shared: false,
    status: "authorized",
    platform: "darwin",
    arch: "arm64",
    hostname: "laptop.local",
    daemonVersion: "1.0.0",
    capabilities: null,
    workspaceRoot: null,
    environmentId: null,
    connected: true,
    lastSeenAt: null,
    authorizedAt: null,
    revokedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function access(overrides: Partial<CurrentBoardAccess> = {}): CurrentBoardAccess {
  return { user: null, userId: "user-1", isInstanceAdmin: false, source: "session", keyId: null, ...overrides };
}

function stateWith(machineId: string | null, run: boolean): WorkContextState {
  return {
    context: { machineId } as WorkContextState["context"],
    machine: null,
    run: run ? { id: "r-1", status: "running", agentId: "a-1", executionMachineId: machineId, startedAt: null } : null,
    pendingRuntimeRequestCount: 0,
    pendingInteractionCount: 0,
  };
}

describe("location keys", () => {
  it("round-trip server and machine locations", () => {
    expect(locationFromKey(locationKey({ kind: "server" }))).toEqual({ kind: "server" });
    expect(locationFromKey(locationKey({ kind: "machine", machineId: "m-1" }))).toEqual({
      kind: "machine",
      machineId: "m-1",
    });
  });

  it("treat a task without a work context as running on the server", () => {
    expect(currentLocationKey(undefined)).toBe("server");
    expect(currentLocationKey(stateWith(null, false))).toBe("server");
    expect(currentLocationKey(stateWith("m-1", false))).toBe("machine:m-1");
  });
});

describe("machine permissions", () => {
  it("lets only the owner use a personal machine", () => {
    expect(canUseMachine(machine(), "user-1")).toBe(true);
    expect(canUseMachine(machine(), "user-2")).toBe(false);
    expect(canUseMachine(machine({ shared: true }), "user-2")).toBe(true);
    expect(canUseMachine(machine({ status: "revoked" }), "user-1")).toBe(false);
  });

  it("lets owners and instance admins manage, but nobody manage a revoked machine", () => {
    expect(canManageMachine(machine(), access())).toBe(true);
    expect(canManageMachine(machine(), access({ userId: "user-2" }))).toBe(false);
    expect(canManageMachine(machine(), access({ userId: "user-2", isInstanceAdmin: true }))).toBe(true);
    expect(canManageMachine(machine({ status: "revoked" }), access())).toBe(false);
  });
});

describe("machine descriptions", () => {
  it("names platform, architecture and capabilities", () => {
    expect(platformLabel(machine())).toBe("macOS · arm64");
    expect(
      capabilityLabels({ docker: true, devcontainerCli: false, runnerd: { path: "/x", version: "0.2" }, tools: [] }),
    ).toEqual(["Docker", "runnerd 0.2"]);
  });
});

describe("executionLocationView", () => {
  it("offers Run here when idle and Move only toward a different location while running", () => {
    expect(executionLocationView(stateWith(null, false), "server", { hasAssignee: true })).toMatchObject({
      canRunHere: true,
      canMoveHere: false,
      canPersistSelection: true,
    });
    expect(executionLocationView(stateWith("m-1", true), "machine:m-1", { hasAssignee: true })).toMatchObject({
      canRunHere: false,
      canMoveHere: false,
      canPersistSelection: false,
    });
    expect(executionLocationView(stateWith("m-1", true), "server", { hasAssignee: true })).toMatchObject({
      canMoveHere: true,
    });
  });

  it("offers no run actions without an assignee", () => {
    expect(executionLocationView(stateWith(null, false), "server", { hasAssignee: false })).toMatchObject({
      canRunHere: false,
      canMoveHere: false,
    });
  });
});
