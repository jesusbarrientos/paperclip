import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import {
  MACHINE_EXEC_OUTPUT_CHUNK_MAX,
  type MachineDaemonMessage,
  type MachineExecRequest,
} from "@paperclipai/shared";

export const EXEC_KILL_GRACE_MS = 5_000;

const BASE_ENV_KEYS = ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "TMPDIR", "TERM"] as const;
const DOCKER_ENV_KEYS = ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG", "DOCKER_CERT_PATH", "DOCKER_TLS_VERIFY"] as const;

/**
 * Commands get an allowlisted slice of the daemon environment. Anything else
 * the daemon inherited (API keys, tokens from the operator's shell) must not
 * reach them: their configuration comes from the server via `env`.
 */
export function buildExecEnv(
  daemonEnv: NodeJS.ProcessEnv,
  requestEnv: Record<string, string> = {},
): Record<string, string> {
  return { ...pickEnv(daemonEnv, BASE_ENV_KEYS), ...requestEnv };
}

/** Host-side env for the docker and devcontainer CLIs, which need the docker context variables. */
export function buildToolEnv(daemonEnv: NodeJS.ProcessEnv): Record<string, string> {
  return { ...pickEnv(daemonEnv, BASE_ENV_KEYS), ...pickEnv(daemonEnv, DOCKER_ENV_KEYS) };
}

function pickEnv(source: NodeJS.ProcessEnv, keys: readonly string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") env[key] = value;
  }
  return env;
}

export function splitOutputChunk(text: string, max = MACHINE_EXEC_OUTPUT_CHUNK_MAX): string[] {
  if (text.length <= max) return text.length > 0 ? [text] : [];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + max, text.length);
    // Never cut a surrogate pair in half: the server would decode a broken character.
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end -= 1;
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
}

export function buildInvocation(
  request: Pick<MachineExecRequest, "command" | "args" | "env" | "container"> & { cwd?: string | null },
  daemonEnv: NodeJS.ProcessEnv,
): { command: string; args: string[]; env: Record<string, string> } {
  if (!request.container) {
    return { command: request.command, args: request.args, env: buildExecEnv(daemonEnv, request.env) };
  }
  const remoteEnv = Object.entries(request.env).flatMap(([key, value]) => ["--remote-env", `${key}=${value}`]);
  // `devcontainer exec` always starts in the container's workspace folder; the
  // workspace is mounted at its host path, so the host cwd is valid inside too.
  const inCwd = request.cwd ? ["sh", "-c", 'cd "$0" && exec "$@"', request.cwd] : [];
  return {
    command: "devcontainer",
    args: [
      "exec",
      "--workspace-folder",
      request.container.workspaceFolder,
      ...remoteEnv,
      "--",
      ...inCwd,
      request.command,
      ...request.args,
    ],
    env: buildToolEnv(daemonEnv),
  };
}

type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export interface ExecEngineOptions {
  emit: (message: MachineDaemonMessage) => void;
  defaultCwd: string;
  daemonEnv?: NodeJS.ProcessEnv;
  killGraceMs?: number;
  log?: (line: string) => void;
  spawn?: SpawnFn;
}

interface RunningExec {
  requestId: string;
  contextId: string | null;
  child: ChildProcess;
  pid: number;
  timedOut: boolean;
  timeoutTimer: NodeJS.Timeout | null;
  escalationTimer: NodeJS.Timeout | null;
  closed: Promise<void>;
}

export class MachineExecEngine {
  private readonly running = new Map<string, RunningExec>();
  private readonly starting = new Set<string>();
  private readonly daemonEnv: NodeJS.ProcessEnv;
  private readonly killGraceMs: number;
  private readonly spawnFn: SpawnFn;
  private readonly log: (line: string) => void;

  constructor(private readonly options: ExecEngineOptions) {
    this.daemonEnv = options.daemonEnv ?? process.env;
    this.killGraceMs = options.killGraceMs ?? EXEC_KILL_GRACE_MS;
    this.spawnFn = options.spawn ?? spawn;
    this.log = options.log ?? (() => {});
  }

  runningRequestIds(): string[] {
    return [...this.running.keys(), ...this.starting];
  }

  isRunning(requestId: string): boolean {
    return this.running.has(requestId) || this.starting.has(requestId);
  }

  start(request: MachineExecRequest): void {
    const { requestId } = request;
    const fail = (error: string) => this.options.emit({ type: "exec.failed", requestId, error: error.slice(0, 4096) });

    if (this.isRunning(requestId)) {
      fail(`Request ${requestId} is already running`);
      return;
    }
    if (typeof request.command !== "string" || request.command.length === 0) {
      fail("command is required");
      return;
    }

    const cwd = request.cwd ?? this.options.defaultCwd;
    try {
      if (!fs.statSync(cwd).isDirectory()) {
        fail(`cwd is not a directory: ${cwd}`);
        return;
      }
    } catch {
      if (request.cwd) {
        fail(`cwd does not exist: ${cwd}`);
        return;
      }
      fs.mkdirSync(cwd, { recursive: true });
    }

    const invocation = buildInvocation(
      { command: request.command, args: request.args ?? [], env: request.env ?? {}, container: request.container ?? null, cwd },
      this.daemonEnv,
    );

    let child: ChildProcess;
    try {
      child = this.spawnFn(invocation.command, invocation.args, {
        cwd,
        env: invocation.env,
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
      return;
    }

    this.starting.add(requestId);
    let spawned = false;
    let resolveClosed!: () => void;
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });

    child.on("error", (error) => {
      if (spawned) return;
      this.starting.delete(requestId);
      resolveClosed();
      fail(`Failed to start ${path.basename(invocation.command)}: ${error.message}`);
    });

    child.once("spawn", () => {
      spawned = true;
      this.starting.delete(requestId);
      const pid = child.pid ?? -1;
      const run: RunningExec = {
        requestId,
        contextId: request.contextId ?? null,
        child,
        pid,
        timedOut: false,
        timeoutTimer: null,
        escalationTimer: null,
        closed,
      };
      this.running.set(requestId, run);
      this.options.emit({ type: "exec.started", requestId, pid, startedAt: new Date().toISOString() });
      this.log(`exec ${requestId} started ${path.basename(request.command)} pid=${pid}`);

      if (request.timeoutMs && request.timeoutMs > 0) {
        run.timeoutTimer = setTimeout(() => {
          run.timedOut = true;
          this.terminate(run);
        }, request.timeoutMs);
      }
    });

    child.stdin?.on("error", () => {});
    if (typeof request.stdin === "string" && request.stdin.length > 0) child.stdin?.end(request.stdin);
    else child.stdin?.end();

    this.pipeOutput(requestId, child.stdout, "stdout");
    this.pipeOutput(requestId, child.stderr, "stderr");

    child.once("close", (code, signal) => {
      if (!spawned) return;
      const run = this.running.get(requestId);
      this.running.delete(requestId);
      if (run?.timeoutTimer) clearTimeout(run.timeoutTimer);
      if (run?.escalationTimer) clearTimeout(run.escalationTimer);
      const timedOut = run?.timedOut ?? false;
      this.options.emit({
        type: "exec.exited",
        requestId,
        exitCode: typeof code === "number" ? code : null,
        signal: signal ?? null,
        timedOut,
      });
      this.log(`exec ${requestId} exited code=${code ?? "null"}${signal ? ` signal=${signal}` : ""}${timedOut ? " (timed out)" : ""}`);
      resolveClosed();
    });
  }

  kill(requestId: string, signal: NodeJS.Signals): boolean {
    const run = this.running.get(requestId);
    if (!run) return false;
    this.signalGroup(run, signal);
    return true;
  }

  stopContext(contextId: string): string[] {
    const stopped: string[] = [];
    for (const run of this.running.values()) {
      if (run.contextId !== contextId) continue;
      this.terminate(run);
      stopped.push(run.requestId);
    }
    return stopped;
  }

  async shutdown(): Promise<void> {
    const runs = [...this.running.values()];
    for (const run of runs) this.terminate(run);
    await Promise.race([
      Promise.all(runs.map((run) => run.closed)),
      new Promise((resolve) => setTimeout(resolve, this.killGraceMs + 1_000).unref()),
    ]);
  }

  private terminate(run: RunningExec): void {
    this.signalGroup(run, "SIGTERM");
    if (run.escalationTimer) return;
    run.escalationTimer = setTimeout(() => this.signalGroup(run, "SIGKILL"), this.killGraceMs);
    run.escalationTimer.unref();
  }

  private signalGroup(run: RunningExec, signal: NodeJS.Signals): void {
    if (process.platform !== "win32" && run.pid > 0) {
      try {
        process.kill(-run.pid, signal);
        return;
      } catch {}
    }
    try {
      run.child.kill(signal);
    } catch {}
  }

  private pipeOutput(requestId: string, stream: NodeJS.ReadableStream | null, name: "stdout" | "stderr"): void {
    if (!stream) return;
    const decoder = new StringDecoder("utf8");
    const emit = (text: string) => {
      for (const chunk of splitOutputChunk(text)) {
        this.options.emit({ type: "exec.output", requestId, stream: name, chunk });
      }
    };
    stream.on("data", (data: Buffer) => emit(decoder.write(data)));
    stream.on("end", () => emit(decoder.end()));
  }
}
