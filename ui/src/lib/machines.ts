import type { ExecutionLocation, Machine, MachineCapabilities, WorkContextState } from "@paperclipai/shared";
import type { CurrentBoardAccess } from "@/api/access";
import { agentStatusDot, agentStatusDotDefault } from "@/lib/status-colors";

export const SERVER_LOCATION_KEY = "server";

export type LocationKey = string;

export function locationKey(location: ExecutionLocation): LocationKey {
  return location.kind === "server" ? SERVER_LOCATION_KEY : `machine:${location.machineId}`;
}

export function locationFromKey(key: LocationKey): ExecutionLocation {
  if (key.startsWith("machine:")) return { kind: "machine", machineId: key.slice("machine:".length) };
  return { kind: "server" };
}

export function currentLocationKey(state: WorkContextState | null | undefined): LocationKey {
  const machineId = state?.context?.machineId ?? null;
  return machineId ? `machine:${machineId}` : SERVER_LOCATION_KEY;
}

const PLATFORM_LABELS: Record<string, string> = {
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
};

export function platformLabel(machine: Pick<Machine, "platform" | "arch">): string {
  const platform = machine.platform ? (PLATFORM_LABELS[machine.platform] ?? machine.platform) : null;
  if (platform && machine.arch) return `${platform} · ${machine.arch}`;
  return platform ?? machine.arch ?? "Unknown platform";
}

export function capabilityLabels(capabilities: MachineCapabilities | null): string[] {
  if (!capabilities) return [];
  const labels: string[] = [];
  if (capabilities.docker) labels.push("Docker");
  if (capabilities.devcontainerCli) labels.push("Dev Container CLI");
  if (capabilities.runnerd) {
    labels.push(capabilities.runnerd.version ? `runnerd ${capabilities.runnerd.version}` : "runnerd");
  }
  return labels;
}

export function isInstanceAdminAccess(access: CurrentBoardAccess | undefined): boolean {
  if (!access) return false;
  return access.source === "local_implicit" || access.isInstanceAdmin;
}

/** Mirrors the server rule: owner or instance admin. The server stays authoritative. */
export function canManageMachine(machine: Machine, access: CurrentBoardAccess | undefined): boolean {
  if (!access || machine.status === "revoked") return false;
  if (isInstanceAdminAccess(access)) return true;
  return machine.ownerUserId !== null && machine.ownerUserId === access.userId;
}

/** Personal machines run only their owner's work; shared ones run everyone's. */
export function canUseMachine(machine: Machine, userId: string | null | undefined): boolean {
  if (machine.status !== "authorized") return false;
  if (machine.shared) return true;
  return Boolean(userId) && machine.ownerUserId === userId;
}

export function machineOwnershipLabel(machine: Machine, userId: string | null | undefined): string {
  if (machine.shared) return "Shared";
  if (userId && machine.ownerUserId === userId) return "Personal";
  return "Personal (another user)";
}

export interface ExecutionLocationView {
  currentKey: LocationKey;
  runActive: boolean;
  /** Changing the selection only stages a move target while a run holds the work. */
  canPersistSelection: boolean;
  canRunHere: boolean;
  canMoveHere: boolean;
}

export function executionLocationView(
  state: WorkContextState | null | undefined,
  selectedKey: LocationKey,
  options: { hasAssignee: boolean },
): ExecutionLocationView {
  const currentKey = currentLocationKey(state);
  const runActive = Boolean(state?.run);
  return {
    currentKey,
    runActive,
    canPersistSelection: !runActive,
    canRunHere: !runActive && options.hasAssignee,
    canMoveHere: runActive && options.hasAssignee && selectedKey !== currentKey,
  };
}

export function machineStatusDotClass(machine: Pick<Machine, "connected" | "status">): string {
  if (machine.status === "revoked") return agentStatusDot.error ?? agentStatusDotDefault;
  return machine.connected ? (agentStatusDot.active ?? agentStatusDotDefault) : agentStatusDotDefault;
}

export function machineStatusLabel(machine: Pick<Machine, "connected" | "status">): string {
  if (machine.status === "revoked") return "Revoked";
  return machine.connected ? "Online" : "Offline";
}
