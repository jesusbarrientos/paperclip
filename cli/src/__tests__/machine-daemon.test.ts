import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MACHINE_EXEC_OUTPUT_CHUNK_MAX,
  machineDaemonMessageSchema,
  type MachineDaemonMessage,
  type MachineExecRequest,
} from "@paperclipai/shared";
import { reconnectDelayMs, RECONNECT_MAX_DELAY_MS } from "../commands/machine/backoff.js";
import {
  readMachineConfig,
  resolveExtraHeaders,
  writeMachineConfig,
  clearMachineCredential,
} from "../commands/machine/config.js";
import { controlUrl } from "../commands/machine/daemon.js";
import {
  buildExecEnv,
  buildInvocation,
  MachineExecEngine,
  splitOutputChunk,
} from "../commands/machine/exec-engine.js";
import { MachineOutbox } from "../commands/machine/outbox.js";
import { PairingError, waitForPairingClaim } from "../commands/machine/pairing.js";
import { handleRpc, parseJsonc } from "../commands/machine/rpc.js";
import { renderMachineLaunchdPlist, renderMachineSystemdUnit } from "../commands/machine/service.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-machine-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function execRequest(overrides: Partial<MachineExecRequest>): MachineExecRequest {
  return {
    type: "exec",
    requestId: "req-1",
    command: "sh",
    args: [],
    cwd: null,
    env: {},
    stdin: null,
    timeoutMs: null,
    contextId: null,
    container: null,
    ...overrides,
  };
}

function createEngine(daemonEnv: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: os.homedir() }) {
  const frames: MachineDaemonMessage[] = [];
  const waiters = new Map<string, (frame: MachineDaemonMessage) => void>();
  const engine = new MachineExecEngine({
    emit: (frame) => {
      expect(machineDaemonMessageSchema.safeParse(frame).success).toBe(true);
      frames.push(frame);
      if ((frame.type === "exec.exited" || frame.type === "exec.failed") && waiters.has(frame.requestId)) {
        waiters.get(frame.requestId)!(frame);
      }
    },
    defaultCwd: temporaryDirectory(),
    daemonEnv,
    killGraceMs: 300,
  });
  const run = (request: MachineExecRequest) =>
    new Promise<MachineDaemonMessage>((resolve) => {
      waiters.set(request.requestId, resolve);
      engine.start(request);
    });
  const output = (requestId: string, stream: "stdout" | "stderr" = "stdout") =>
    frames
      .filter((frame): frame is Extract<MachineDaemonMessage, { type: "exec.output" }> =>
        frame.type === "exec.output" && frame.requestId === requestId && frame.stream === stream)
      .map((frame) => frame.chunk)
      .join("");
  return { engine, frames, run, output };
}

describe("machine exec env", () => {
  it("passes only allowlisted daemon variables and lets the request win", () => {
    const env = buildExecEnv(
      { PATH: "/usr/bin", HOME: "/home/me", LANG: "C", ANTHROPIC_API_KEY: "secret", PAPERCLIP_TOKEN: "x" },
      { LANG: "en_US.UTF-8", FOO: "bar" },
    );
    expect(env).toEqual({ PATH: "/usr/bin", HOME: "/home/me", LANG: "en_US.UTF-8", FOO: "bar" });
  });

  it("wraps container commands in devcontainer exec with remote env", () => {
    const invocation = buildInvocation(
      { command: "pnpm", args: ["test"], env: { CI: "1" }, container: { workspaceFolder: "/w/repo" } },
      { PATH: "/usr/bin", DOCKER_HOST: "unix:///tmp/docker.sock", ANTHROPIC_API_KEY: "secret" },
    );
    expect(invocation.command).toBe("devcontainer");
    expect(invocation.args).toEqual([
      "exec", "--workspace-folder", "/w/repo", "--remote-env", "CI=1", "--", "pnpm", "test",
    ]);
    expect(invocation.env).toEqual({ PATH: "/usr/bin", DOCKER_HOST: "unix:///tmp/docker.sock" });
  });

  it("runs container commands in the requested cwd", () => {
    const invocation = buildInvocation(
      { command: "pnpm", args: ["test"], env: {}, container: { workspaceFolder: "/w/repo" }, cwd: "/w/repo/api" },
      { PATH: "/usr/bin" },
    );
    expect(invocation.args).toEqual([
      "exec", "--workspace-folder", "/w/repo", "--", "sh", "-c", 'cd "$0" && exec "$@"', "/w/repo/api", "pnpm", "test",
    ]);
  });
});

describe("machine exec engine", () => {
  it("does not leak daemon secrets into commands", async () => {
    const { run, output } = createEngine({ PATH: process.env.PATH, ANTHROPIC_API_KEY: "leaked" });
    const exited = await run(execRequest({
      args: ["-c", 'printf "%s|%s" "${ANTHROPIC_API_KEY:-none}" "$FOO"'],
      env: { FOO: "from-server" },
    }));
    expect(exited).toMatchObject({ type: "exec.exited", exitCode: 0, timedOut: false });
    expect(output("req-1")).toBe("none|from-server");
  });

  it("writes stdin, emits started before output, and exits exactly once", async () => {
    const { run, output, frames } = createEngine();
    await run(execRequest({ command: "cat", stdin: "hello stdin" }));
    expect(output("req-1")).toBe("hello stdin");
    const types = frames.map((frame) => frame.type);
    expect(types[0]).toBe("exec.started");
    expect(types.filter((type) => type === "exec.exited")).toHaveLength(1);
    expect(types.at(-1)).toBe("exec.exited");
  });

  it("splits large output into bounded chunks", async () => {
    const { run, output, frames } = createEngine();
    const size = MACHINE_EXEC_OUTPUT_CHUNK_MAX * 3 + 17;
    await run(execRequest({ command: process.execPath, args: ["-e", `process.stdout.write("é".repeat(${size}))`] }));
    const chunks = frames.filter((frame) => frame.type === "exec.output");
    expect(chunks.length).toBeGreaterThan(3);
    for (const frame of chunks) expect(frame.chunk.length).toBeLessThanOrEqual(MACHINE_EXEC_OUTPUT_CHUNK_MAX);
    expect(output("req-1")).toBe("é".repeat(size));
  });

  it("does not split surrogate pairs", () => {
    const chunks = splitOutputChunk(`a${"😀".repeat(5)}`, 4);
    expect(chunks.join("")).toBe(`a${"😀".repeat(5)}`);
    for (const chunk of chunks) expect(chunk).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it("terminates the process group on timeout and reports timedOut", async () => {
    const { run } = createEngine();
    const exited = await run(execRequest({ args: ["-c", "sleep 30 & wait"], timeoutMs: 200 }));
    expect(exited).toMatchObject({ type: "exec.exited", timedOut: true, signal: "SIGTERM" });
  });

  it("escalates to SIGKILL when the group ignores SIGTERM", async () => {
    const { run } = createEngine();
    const exited = await run(execRequest({ args: ["-c", "trap '' TERM; sleep 30 & wait; sleep 30"], timeoutMs: 100 }));
    expect(exited).toMatchObject({ type: "exec.exited", timedOut: true, signal: "SIGKILL" });
  });

  it("kills a running exec on request", async () => {
    const { engine, run } = createEngine();
    const pending = run(execRequest({ command: "sleep", args: ["30"] }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(engine.runningRequestIds()).toEqual(["req-1"]);
    expect(engine.kill("req-1", "SIGKILL")).toBe(true);
    expect(await pending).toMatchObject({ type: "exec.exited", signal: "SIGKILL", timedOut: false });
    expect(engine.runningRequestIds()).toEqual([]);
  });

  it("stops every exec of a context", async () => {
    const { engine, run } = createEngine();
    const first = run(execRequest({ requestId: "a", command: "sleep", args: ["30"], contextId: "ctx" }));
    const second = run(execRequest({ requestId: "b", command: "sleep", args: ["30"], contextId: "other" }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    const result = await handleRpc({ requestId: "r", method: "context.stop", params: { contextId: "ctx" } }, { engine });
    expect(result).toEqual({ type: "rpc.result", requestId: "r", ok: true, result: { stopped: ["a"] } });
    expect(await first).toMatchObject({ signal: "SIGTERM" });
    expect(engine.runningRequestIds()).toEqual(["b"]);
    engine.kill("b", "SIGKILL");
    await second;
  });

  it("fails when cwd does not exist or the command is missing", async () => {
    const { run } = createEngine();
    expect(await run(execRequest({ requestId: "cwd", cwd: "/definitely/not/here" })))
      .toMatchObject({ type: "exec.failed", requestId: "cwd" });
    expect(await run(execRequest({ requestId: "cmd", command: "paperclip-no-such-binary" })))
      .toMatchObject({ type: "exec.failed", requestId: "cmd" });
  });
});

describe("machine rpc", () => {
  it("rejects unknown methods", async () => {
    const result = await handleRpc({ requestId: "r", method: "nope", params: {} }, { engine: { stopContext: () => [] } });
    expect(result).toMatchObject({ ok: false, error: "Unknown method: nope" });
  });

  it("removes dev containers labelled with the workspace folder", async () => {
    const calls: string[][] = [];
    const result = await handleRpc(
      { requestId: "r", method: "devcontainer.down", params: { workspaceFolder: "/w/repo" } },
      {
        engine: { stopContext: () => [] },
        runTool: async (command, args) => {
          calls.push([command, ...args]);
          return { ok: true, code: 0, stdout: args[0] === "ps" ? "abc\ndef\n" : "", stderr: "" };
        },
      },
    );
    expect(result).toMatchObject({ ok: true, result: { removed: ["abc", "def"] } });
    expect(calls).toEqual([
      ["docker", "ps", "-aq", "--filter", "label=devcontainer.local_folder=/w/repo"],
      ["docker", "rm", "-f", "abc", "def"],
    ]);
  });

  it("brings a dev container up with a mount override built from the project config", async () => {
    const workspace = temporaryDirectory();
    fs.mkdirSync(path.join(workspace, ".devcontainer"));
    fs.writeFileSync(
      path.join(workspace, ".devcontainer", "devcontainer.json"),
      '{\n  // comment\n  "image": "node:24",\n  "build": { "dockerfile": "Dockerfile", },\n}\n',
    );
    let override: Record<string, unknown> | null = null;
    const result = await handleRpc(
      { requestId: "r", method: "devcontainer.up", params: { workspaceFolder: workspace, workspaceMountTarget: "/srv/ws" } },
      {
        engine: { stopContext: () => [] },
        runTool: async (_command, args) => {
          const overridePath = args[args.indexOf("--override-config") + 1]!;
          override = JSON.parse(fs.readFileSync(overridePath, "utf8"));
          expect(args).toContain("--mount-workspace-git-root");
          return { ok: true, code: 0, stdout: 'log line\n{"outcome":"success","containerId":"c1"}\n', stderr: "" };
        },
      },
    );
    expect(result).toMatchObject({ ok: true, result: { outcome: "success", containerId: "c1" } });
    expect(override).toMatchObject({
      image: "node:24",
      build: { dockerfile: "Dockerfile" },
      workspaceFolder: "/srv/ws",
      workspaceMount: `source=${workspace},target=/srv/ws,type=bind`,
    });
    expect(fs.readdirSync(path.join(workspace, ".devcontainer"))).toEqual(["devcontainer.json"]);
  });

  it("parses JSONC without touching comment-like text in strings", () => {
    expect(parseJsonc('{"url": "http://x//y", /* c */ "list": [1, 2,],}')).toEqual({ url: "http://x//y", list: [1, 2] });
  });
});

describe("machine reconnect backoff", () => {
  it("doubles from 1s and caps at 30s with jitter in the upper half", () => {
    expect([0, 1, 2, 3, 4, 5, 10].map((attempt) => reconnectDelayMs(attempt, () => 1))).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000,
    ]);
    expect(reconnectDelayMs(0, () => 0)).toBe(500);
    expect(reconnectDelayMs(20, () => 0)).toBe(RECONNECT_MAX_DELAY_MS / 2);
  });
});

describe("machine outbox", () => {
  it("drops the oldest output chunks first and keeps lifecycle frames", () => {
    const outbox = new MachineOutbox(400);
    outbox.push({ type: "exec.started", requestId: "a", pid: 1, startedAt: "t" });
    for (let index = 0; index < 10; index += 1) {
      outbox.push({ type: "exec.output", requestId: "a", stream: "stdout", chunk: `chunk-${index}-${"x".repeat(20)}` });
    }
    outbox.push({ type: "exec.exited", requestId: "a", exitCode: 0, signal: null, timedOut: false });
    expect(outbox.bytes).toBeLessThanOrEqual(400);
    const { messages, droppedChunks } = outbox.drain();
    expect(droppedChunks).toBeGreaterThan(0);
    expect(messages[0]!.type).toBe("exec.started");
    expect(messages.at(-1)!.type).toBe("exec.exited");
    const chunks = messages.filter((message) => message.type === "exec.output").map((message) => message.chunk);
    expect(chunks.at(-1)).toContain("chunk-9-");
    expect(chunks.some((chunk) => chunk.includes("chunk-0-"))).toBe(false);
  });
});

describe("machine pairing", () => {
  const pairing = {
    machineId: "m-1",
    token: "token-0123456789abcdef",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    suggestedPollIntervalMs: 2_000,
  };

  function mockFetch(responses: Array<{ status: number; body: unknown } | Error>) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetch = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error("unexpected fetch");
      if (next instanceof Error) throw next;
      return new Response(JSON.stringify(next.body), { status: next.status });
    };
    return { fetch, calls };
  }

  it("polls at the suggested interval until authorized", async () => {
    const sleeps: number[] = [];
    const { fetch, calls } = mockFetch([
      { status: 200, body: { status: "pending" } },
      new Error("ECONNRESET"),
      { status: 503, body: {} },
      { status: 200, body: { status: "authorized", machineId: "m-1", credential: "cred" } },
    ]);
    const result = await waitForPairingClaim("https://pc.example", pairing, {
      fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      headers: { "x-proxy": "1" },
    });
    expect(result).toEqual({ machineId: "m-1", credential: "cred" });
    expect(sleeps).toEqual([2_000, 2_000, 2_000, 2_000]);
    expect(calls[0]!.url).toBe("https://pc.example/api/machines/pairings/m-1/claim");
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ token: pairing.token });
    expect((calls[0]!.init!.headers as Record<string, string>)["x-proxy"]).toBe("1");
  });

  it.each(["expired", "revoked", "already_claimed"] as const)("stops on %s", async (status) => {
    const { fetch } = mockFetch([{ status: 200, body: { status } }]);
    await expect(waitForPairingClaim("https://pc.example", pairing, { fetch, sleep: async () => {} }))
      .rejects.toMatchObject({ reason: status });
  });

  it("stops polling once the pairing expires locally", async () => {
    let now = Date.parse(pairing.expiresAt) - 3_000;
    const { fetch, calls } = mockFetch([
      { status: 200, body: { status: "pending" } },
      { status: 200, body: { status: "pending" } },
    ]);
    const promise = waitForPairingClaim("https://pc.example", pairing, {
      fetch,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });
    await expect(promise).rejects.toBeInstanceOf(PairingError);
    expect(calls).toHaveLength(2);
  });
});

describe("machine config", () => {
  it("stores the credential with private permissions and can clear it", () => {
    const directory = temporaryDirectory();
    const configPath = path.join(directory, "machine", "config.json");
    writeMachineConfig({ serverUrl: "https://pc.example", machineId: "m-1", credential: "cred", workspaceRoot: "/w" }, configPath);
    expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.dirname(configPath)).mode & 0o777).toBe(0o700);
    clearMachineCredential(configPath);
    expect(readMachineConfig(configPath)).toMatchObject({ machineId: "m-1", credential: null });
  });

  it("merges extra headers from config and env", () => {
    expect(resolveExtraHeaders({ headers: { a: "1" } }, { PAPERCLIP_MACHINE_EXTRA_HEADERS: '{"b":"2","a":"3"}' }))
      .toEqual({ a: "3", b: "2" });
    expect(() => resolveExtraHeaders(null, { PAPERCLIP_MACHINE_EXTRA_HEADERS: "[1]" })).toThrow();
  });

  it("derives the control URL from the server URL", () => {
    expect(controlUrl("https://pc.example/base")).toBe("wss://pc.example/base/api/machines/v1/connect");
    expect(controlUrl("http://localhost:3100")).toBe("ws://localhost:3100/api/machines/v1/connect");
  });
});

describe("machine service definitions", () => {
  const input = {
    programArguments: ["/home/a b/.local/bin/paperclipai", "machine", "run"],
    paperclipHome: "/home/a b/.paperclip",
    pathEnv: "/usr/local/bin:/usr/bin",
    logPath: "/home/a b/.paperclip/machine/daemon.log",
  };

  it("renders a launchd agent", () => {
    const plist = renderMachineLaunchdPlist(input);
    expect(plist).toContain("<string>ai.paperclip.machine</string>");
    expect(plist).toContain("<string>/home/a b/.local/bin/paperclipai</string><string>machine</string><string>run</string>");
  });

  it("renders a systemd user unit that does not restart after revocation", () => {
    const unit = renderMachineSystemdUnit(input);
    expect(unit).toContain('ExecStart="/home/a b/.local/bin/paperclipai" "machine" "run"');
    expect(unit).toContain("RestartPreventExitStatus=2");
  });
});
