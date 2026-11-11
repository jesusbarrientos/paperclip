import { randomUUID } from "node:crypto";
import type {
  MachineDaemonHello,
  MachineExecRequest,
  MachineRpcMethod,
  MachineServerMessage,
} from "@paperclipai/shared";

export interface MachineExecResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  pid: number | null;
  startedAt: string | null;
}

export interface MachineExecInput {
  command: string;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string>;
  stdin?: string | null;
  timeoutMs?: number | null;
  contextId?: string | null;
  container?: { workspaceFolder: string } | null;
  runId?: string | null;
  onLog?: (stream: "stdout" | "stderr", chunk: string) => Promise<void> | void;
  onSpawn?: (meta: { pid: number; startedAt: string }) => Promise<void> | void;
}

interface PendingExec {
  stdout: string;
  stderr: string;
  pid: number | null;
  startedAt: string | null;
  input: MachineExecInput;
  resolve(result: MachineExecResult): void;
  reject(error: Error): void;
  /** Disconnect grace timer; the daemon keeps children alive across short reconnects. */
  orphanTimer: NodeJS.Timeout | null;
}

interface PendingRpc {
  resolve(result: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

interface MachineConnection {
  machineId: string;
  send(message: MachineServerMessage): void;
  close(code: number, reason: string): void;
  hello: MachineDaemonHello | null;
  connectedAt: Date;
}

/** Captured output is capped so one runaway command cannot hold unbounded memory. */
const MAX_CAPTURED_OUTPUT = 8 * 1024 * 1024;
const RECONNECT_GRACE_MS = 60_000;
const EXEC_KILL_GRACE_MS = 5_000;
const DEFAULT_RPC_TIMEOUT_MS = 10 * 60_000;

export class MachineUnavailableError extends Error {
  readonly code = "machine_unavailable";
  constructor(machineId: string) {
    super(`Machine ${machineId} is not connected`);
  }
}

function appendCapped(current: string, chunk: string) {
  const next = current + chunk;
  return next.length > MAX_CAPTURED_OUTPUT ? next.slice(next.length - MAX_CAPTURED_OUTPUT) : next;
}

const connections = new Map<string, MachineConnection>();
const pendingExecs = new Map<string, { machineId: string; pending: PendingExec }>();
const pendingRpcs = new Map<string, { machineId: string; pending: PendingRpc }>();
const presenceListeners = new Set<(machineId: string, connected: boolean) => void>();

export function onMachinePresenceChange(listener: (machineId: string, connected: boolean) => void) {
  presenceListeners.add(listener);
  return () => presenceListeners.delete(listener);
}

function emitPresence(machineId: string, connected: boolean) {
  for (const listener of presenceListeners) listener(machineId, connected);
}

export function isMachineConnected(machineId: string) {
  return connections.has(machineId);
}

export function getMachineHello(machineId: string) {
  return connections.get(machineId)?.hello ?? null;
}

export function connectedMachineIds() {
  return [...connections.keys()];
}

export function registerMachineConnection(input: {
  machineId: string;
  send(message: MachineServerMessage): void;
  close(code: number, reason: string): void;
}) {
  const previous = connections.get(input.machineId);
  if (previous) previous.close(4000, "superseded");
  const connection: MachineConnection = { ...input, hello: null, connectedAt: new Date() };
  connections.set(input.machineId, connection);
  emitPresence(input.machineId, true);
  return {
    setHello(hello: MachineDaemonHello) {
      connection.hello = hello;
      const running = new Set(hello.runningRequestIds);
      for (const [requestId, entry] of pendingExecs) {
        if (entry.machineId !== input.machineId) continue;
        if (running.has(requestId)) {
          if (entry.pending.orphanTimer) clearTimeout(entry.pending.orphanTimer);
          entry.pending.orphanTimer = null;
        } else {
          failExec(requestId, new Error("machine_exec_lost: the daemon restarted and no longer runs this command"));
        }
      }
    },
    unregister() {
      if (connections.get(input.machineId) !== connection) return;
      connections.delete(input.machineId);
      emitPresence(input.machineId, false);
      for (const [requestId, entry] of pendingExecs) {
        if (entry.machineId !== input.machineId || entry.pending.orphanTimer) continue;
        entry.pending.orphanTimer = setTimeout(() => {
          failExec(requestId, new Error("machine_exec_lost: the machine did not reconnect"));
        }, RECONNECT_GRACE_MS);
      }
      for (const [requestId, entry] of pendingRpcs) {
        if (entry.machineId !== input.machineId) continue;
        clearTimeout(entry.pending.timer);
        pendingRpcs.delete(requestId);
        entry.pending.reject(new MachineUnavailableError(input.machineId));
      }
    },
  };
}

function failExec(requestId: string, error: Error) {
  const entry = pendingExecs.get(requestId);
  if (!entry) return;
  pendingExecs.delete(requestId);
  if (entry.pending.orphanTimer) clearTimeout(entry.pending.orphanTimer);
  entry.pending.reject(error);
}

export function handleExecStarted(machineId: string, requestId: string, pid: number, startedAt: string) {
  const entry = pendingExecs.get(requestId);
  if (!entry || entry.machineId !== machineId) return;
  entry.pending.pid = pid;
  entry.pending.startedAt = startedAt;
  void entry.pending.input.onSpawn?.({ pid, startedAt });
}

export function handleExecOutput(machineId: string, requestId: string, stream: "stdout" | "stderr", chunk: string) {
  const entry = pendingExecs.get(requestId);
  if (!entry || entry.machineId !== machineId) return;
  if (stream === "stdout") entry.pending.stdout = appendCapped(entry.pending.stdout, chunk);
  else entry.pending.stderr = appendCapped(entry.pending.stderr, chunk);
  void entry.pending.input.onLog?.(stream, chunk);
}

export function handleExecExited(
  machineId: string,
  requestId: string,
  exit: { exitCode: number | null; signal: string | null; timedOut: boolean },
) {
  const entry = pendingExecs.get(requestId);
  if (!entry || entry.machineId !== machineId) return;
  pendingExecs.delete(requestId);
  if (entry.pending.orphanTimer) clearTimeout(entry.pending.orphanTimer);
  entry.pending.resolve({
    ...exit,
    stdout: entry.pending.stdout,
    stderr: entry.pending.stderr,
    pid: entry.pending.pid,
    startedAt: entry.pending.startedAt,
  });
}

export function handleExecFailed(machineId: string, requestId: string, error: string) {
  const entry = pendingExecs.get(requestId);
  if (!entry || entry.machineId !== machineId) return;
  failExec(requestId, new Error(`machine_exec_failed: ${error}`));
}

export function handleRpcResult(machineId: string, requestId: string, ok: boolean, result: unknown, error?: string) {
  const entry = pendingRpcs.get(requestId);
  if (!entry || entry.machineId !== machineId) return;
  pendingRpcs.delete(requestId);
  clearTimeout(entry.pending.timer);
  if (ok) entry.pending.resolve(result);
  else entry.pending.reject(new Error(error ?? "machine_rpc_failed"));
}

export function execOnMachine(machineId: string, input: MachineExecInput): Promise<MachineExecResult> {
  const connection = connections.get(machineId);
  if (!connection) return Promise.reject(new MachineUnavailableError(machineId));
  const requestId = randomUUID();
  const request: MachineExecRequest = {
    type: "exec",
    requestId,
    command: input.command,
    args: input.args ?? [],
    cwd: input.cwd ?? null,
    env: input.env ?? {},
    stdin: input.stdin ?? null,
    timeoutMs: input.timeoutMs ?? null,
    contextId: input.contextId ?? null,
    container: input.container ?? null,
  };
  return new Promise<MachineExecResult>((resolve, reject) => {
    pendingExecs.set(requestId, {
      machineId,
      pending: { stdout: "", stderr: "", pid: null, startedAt: null, input, resolve, reject, orphanTimer: null },
    });
    try {
      connection.send(request);
    } catch (error) {
      pendingExecs.delete(requestId);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** Cancelling a run only fences the server; without this the agent keeps working on the machine. */
export function killMachineExecsForRun(runId: string, graceMs = EXEC_KILL_GRACE_MS) {
  let signalled = 0;
  for (const [requestId, entry] of pendingExecs) {
    if (entry.pending.input.runId !== runId) continue;
    const send = (signal: "SIGTERM" | "SIGKILL") => {
      try {
        connections.get(entry.machineId)?.send({ type: "exec.kill", requestId, signal });
      } catch {}
    };
    send("SIGTERM");
    signalled += 1;
    setTimeout(() => {
      if (pendingExecs.has(requestId)) send("SIGKILL");
    }, graceMs).unref();
  }
  return signalled;
}

export function callMachineRpc(
  machineId: string,
  method: MachineRpcMethod,
  params: Record<string, unknown>,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
): Promise<unknown> {
  const connection = connections.get(machineId);
  if (!connection) return Promise.reject(new MachineUnavailableError(machineId));
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRpcs.delete(requestId);
      reject(new Error(`machine_rpc_timeout: ${method}`));
    }, timeoutMs);
    pendingRpcs.set(requestId, { machineId, pending: { resolve, reject, timer } });
    connection.send({ type: "rpc", requestId, method, params });
  });
}

export function disconnectMachine(machineId: string, reason: "revoked") {
  const connection = connections.get(machineId);
  if (!connection) return;
  try {
    connection.send({ type: reason });
  } finally {
    connection.close(4001, reason);
  }
}

/** Test seam: drop every registration without notifying listeners. */
export function resetMachineConnectionsForTests() {
  connections.clear();
  for (const { pending } of pendingExecs.values()) if (pending.orphanTimer) clearTimeout(pending.orphanTimer);
  pendingExecs.clear();
  for (const { pending } of pendingRpcs.values()) clearTimeout(pending.timer);
  pendingRpcs.clear();
}
