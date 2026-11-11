export const MACHINE_STATUSES = ["pending", "authorized", "revoked"] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export const MACHINE_PLATFORMS = ["darwin", "linux", "win32"] as const;
export type MachinePlatform = (typeof MACHINE_PLATFORMS)[number];

export interface MachineCapabilities {
  docker: boolean;
  devcontainerCli: boolean;
  runnerd: { path: string; version: string | null } | null;
  /** Tools detected on the host, informational only. Never used for routing. */
  tools: string[];
}

export interface Machine {
  id: string;
  name: string;
  ownerUserId: string | null;
  shared: boolean;
  status: MachineStatus;
  platform: string | null;
  arch: string | null;
  hostname: string | null;
  daemonVersion: string | null;
  capabilities: MachineCapabilities | null;
  workspaceRoot: string | null;
  environmentId: string | null;
  connected: boolean;
  lastSeenAt: Date | null;
  authorizedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MachinePairingStartRequest {
  name: string;
  platform: string;
  arch: string;
  hostname?: string | null;
}

export interface MachinePairingStartResponse {
  machineId: string;
  token: string;
  approvalPath: string;
  approvalUrl: string | null;
  expiresAt: string;
  suggestedPollIntervalMs: number;
}

export type MachinePairingClaimResponse =
  | { status: "pending" }
  | { status: "authorized"; machineId: string; credential: string }
  | { status: "expired" | "revoked" | "already_claimed" };

export interface MachinePairingDescription {
  machineId: string;
  name: string;
  platform: string | null;
  arch: string | null;
  hostname: string | null;
  status: MachineStatus;
  expiresAt: string | null;
  requiresSignIn: boolean;
  canApproveShared: boolean;
}

export interface ApproveMachinePairingRequest {
  token: string;
  shared?: boolean;
}

export interface UpdateMachineRequest {
  name?: string;
}

/**
 * Where one run executes. `server` keeps the instance's normal environment
 * resolution; `machine` targets a registered machine daemon.
 */
export type ExecutionLocation =
  | { kind: "server" }
  | { kind: "machine"; machineId: string };

export const WORK_CONTEXT_STATUSES = [
  "active",
  "paused",
  "handoff_pending",
  "recovery_pending",
  "closed",
] as const;
export type WorkContextStatus = (typeof WORK_CONTEXT_STATUSES)[number];

export const WORK_CONTEXT_SYNC_STATES = ["up_to_date", "syncing", "error", "conflict"] as const;
export type WorkContextSyncState = (typeof WORK_CONTEXT_SYNC_STATES)[number];

export interface WorkContext {
  id: string;
  issueId: string;
  machineId: string | null;
  status: WorkContextStatus;
  active: boolean;
  fencingToken: number;
  editLocked: boolean;
  lockRunId: string | null;
  syncState: WorkContextSyncState;
  syncError: string | null;
  lastSnapshotSeq: number;
  remotePath: string | null;
  clientSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkContextState {
  context: WorkContext | null;
  machine: Machine | null;
  run: {
    id: string;
    status: string;
    agentId: string;
    executionMachineId: string | null;
    startedAt: Date | null;
  } | null;
  pendingRuntimeRequestCount: number;
  pendingInteractionCount: number;
}

export interface SetExecutionLocationRequest {
  location: ExecutionLocation;
}

export interface HandoffWorkContextRequest {
  to: ExecutionLocation;
}
