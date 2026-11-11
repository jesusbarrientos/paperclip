import { z } from "zod";

export const MACHINE_PROTOCOL_VERSION = 1;
export const MACHINE_CONTROL_PATH = "/api/machines/v1/connect";
export const MACHINE_HEARTBEAT_INTERVAL_MS = 15_000;
/** A machine is reported offline after this long without a heartbeat or frame. */
export const MACHINE_PRESENCE_TIMEOUT_MS = 45_000;
/** Upper bound for one output frame so a chatty process cannot exhaust a frame budget. */
export const MACHINE_EXEC_OUTPUT_CHUNK_MAX = 64 * 1024;

const capabilitiesSchema = z.object({
  docker: z.boolean(),
  devcontainerCli: z.boolean(),
  runnerd: z.object({ path: z.string(), version: z.string().nullable() }).nullable(),
  tools: z.array(z.string().max(64)).max(64),
});

export const machineDaemonMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    protocolVersion: z.number().int(),
    daemonVersion: z.string().max(64),
    platform: z.string().max(32),
    arch: z.string().max(32),
    hostname: z.string().max(255).nullable(),
    workspaceRoot: z.string().max(4096),
    capabilities: capabilitiesSchema,
    /** Exec requests the daemon still runs from a previous connection. */
    runningRequestIds: z.array(z.string()).max(1024).default([]),
  }),
  z.object({ type: z.literal("heartbeat") }),
  z.object({
    type: z.literal("exec.started"),
    requestId: z.string(),
    pid: z.number().int(),
    startedAt: z.string(),
  }),
  z.object({
    type: z.literal("exec.output"),
    requestId: z.string(),
    stream: z.enum(["stdout", "stderr"]),
    chunk: z.string().max(MACHINE_EXEC_OUTPUT_CHUNK_MAX * 2),
  }),
  z.object({
    type: z.literal("exec.exited"),
    requestId: z.string(),
    exitCode: z.number().int().nullable(),
    signal: z.string().nullable(),
    timedOut: z.boolean(),
  }),
  z.object({
    type: z.literal("exec.failed"),
    requestId: z.string(),
    error: z.string().max(4096),
  }),
  z.object({
    type: z.literal("rpc.result"),
    requestId: z.string(),
    ok: z.boolean(),
    result: z.unknown().optional(),
    error: z.string().max(4096).optional(),
  }),
]);

export type MachineDaemonMessage = z.infer<typeof machineDaemonMessageSchema>;
export type MachineDaemonHello = Extract<MachineDaemonMessage, { type: "hello" }>;

export interface MachineExecRequest {
  type: "exec";
  requestId: string;
  command: string;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
  stdin: string | null;
  timeoutMs: number | null;
  /** Work context that owns this command, so the daemon can stop it on pause. */
  contextId: string | null;
  /** Run the command inside the context's dev container when one is up. */
  container: { workspaceFolder: string } | null;
}

export type MachineServerMessage =
  | { type: "welcome"; machineId: string; heartbeatIntervalMs: number; serverTime: string }
  | MachineExecRequest
  | { type: "exec.kill"; requestId: string; signal: "SIGTERM" | "SIGKILL" }
  | { type: "rpc"; requestId: string; method: MachineRpcMethod; params: Record<string, unknown> }
  | { type: "revoked" };

export const MACHINE_RPC_METHODS = [
  "context.stop",
  "context.snapshot",
  "context.materialize",
  "devcontainer.up",
  "devcontainer.down",
] as const;
export type MachineRpcMethod = (typeof MACHINE_RPC_METHODS)[number];

/** The daemon drops its credential only on this exact error; a 401 from a proxy keeps it. */
export const MACHINE_CREDENTIAL_REJECTED_ERROR = "Machine credential is invalid or revoked";

export const MACHINE_SNAPSHOT_COMMIT_HEADER = "x-paperclip-snapshot-commit";
export const MACHINE_SNAPSHOT_SEQ_HEADER = "x-paperclip-snapshot-seq";
export const MACHINE_FENCING_TOKEN_HEADER = "x-paperclip-fencing-token";

/** `since` is the mirror's latest commit, so the daemon can send an incremental bundle. */
export interface MachineContextSnapshotParams {
  issueId: string;
  path: string;
  fencingToken: number;
  seq: number;
  since: string | null;
}

export interface MachineContextSnapshotResult {
  changed: boolean;
  commit: string;
  seq: number;
}

export interface MachineContextMaterializeParams {
  issueId: string;
  path: string;
  seq: number;
  commit: string;
}

export type MachineContextMaterializeResult =
  | { status: "applied" | "unchanged"; commit: string }
  | { status: "conflict"; commit: string; localChanges: string[] };

/**
 * Lease ids for machine-backed sandbox environments. The machine id is part
 * of the id so a lease can never be resumed on a different machine.
 */
export const MACHINE_LEASE_PREFIX = "machine://";
export const MACHINE_SANDBOX_PROVIDER = "paperclip_machine";
