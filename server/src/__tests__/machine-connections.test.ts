import { afterEach, describe, expect, it, vi } from "vitest";
import type { MachineDaemonHello, MachineServerMessage } from "@paperclipai/shared";
import {
  callMachineRpc,
  execOnMachine,
  handleExecExited,
  handleExecOutput,
  handleExecStarted,
  handleRpcResult,
  isMachineConnected,
  killMachineExecsForRun,
  MachineUnavailableError,
  registerMachineConnection,
  resetMachineConnectionsForTests,
} from "../services/machine-connections.js";

function connect(machineId = "m1") {
  const sent: MachineServerMessage[] = [];
  const close = vi.fn();
  const registration = registerMachineConnection({ machineId, send: (message) => sent.push(message), close });
  return { sent, close, registration };
}

function hello(runningRequestIds: string[]): MachineDaemonHello {
  return {
    type: "hello",
    protocolVersion: 1,
    daemonVersion: "test",
    platform: "darwin",
    arch: "arm64",
    hostname: "mac",
    workspaceRoot: "/w",
    capabilities: { docker: false, devcontainerCli: false, runnerd: null, tools: [] },
    runningRequestIds,
  } as unknown as MachineDaemonHello;
}

describe("machine connections", () => {
  afterEach(() => {
    resetMachineConnectionsForTests();
    vi.useRealTimers();
  });

  it("rejects work for a machine that is not connected", async () => {
    await expect(execOnMachine("missing", { command: "true" })).rejects.toBeInstanceOf(MachineUnavailableError);
  });

  it("collects output and resolves when the daemon reports the exit", async () => {
    const { sent } = connect();
    const onLog = vi.fn();
    const result = execOnMachine("m1", { command: "echo", args: ["hi"], onLog });
    const request = sent[0] as Extract<MachineServerMessage, { type: "exec" }>;
    expect(request).toMatchObject({ type: "exec", command: "echo", args: ["hi"] });
    handleExecStarted("m1", request.requestId, 42, "2026-11-03T00:00:00Z");
    handleExecOutput("m1", request.requestId, "stdout", "hi\n");
    handleExecOutput("other", request.requestId, "stdout", "spoofed");
    handleExecExited("m1", request.requestId, { exitCode: 0, signal: null, timedOut: false });
    await expect(result).resolves.toMatchObject({ exitCode: 0, stdout: "hi\n", pid: 42 });
    expect(onLog).toHaveBeenCalledWith("stdout", "hi\n");
  });

  it("keeps a running command across a reconnect that still reports it", async () => {
    vi.useFakeTimers();
    const first = connect();
    const result = execOnMachine("m1", { command: "sleep" });
    const { requestId } = first.sent[0] as Extract<MachineServerMessage, { type: "exec" }>;
    first.registration.unregister();
    expect(isMachineConnected("m1")).toBe(false);
    const second = connect();
    second.registration.setHello(hello([requestId]));
    vi.advanceTimersByTime(120_000);
    handleExecExited("m1", requestId, { exitCode: 0, signal: null, timedOut: false });
    await expect(result).resolves.toMatchObject({ exitCode: 0 });
  });

  it("kills only the cancelled run's commands and escalates when they ignore SIGTERM", async () => {
    vi.useFakeTimers();
    const { sent } = connect();
    const cancelled = execOnMachine("m1", { command: "claude", runId: "run-1" });
    void execOnMachine("m1", { command: "claude", runId: "run-2" });
    const [target, other] = sent.map((message) => (message as Extract<MachineServerMessage, { type: "exec" }>).requestId);

    expect(killMachineExecsForRun("run-1", 5_000)).toBe(1);
    expect(sent.slice(2)).toEqual([{ type: "exec.kill", requestId: target, signal: "SIGTERM" }]);
    vi.advanceTimersByTime(5_000);
    expect(sent.slice(3)).toEqual([{ type: "exec.kill", requestId: target, signal: "SIGKILL" }]);
    expect(sent.some((message) => message.type === "exec.kill" && message.requestId === other)).toBe(false);

    handleExecExited("m1", target!, { exitCode: null, signal: "SIGKILL", timedOut: false });
    await expect(cancelled).resolves.toMatchObject({ signal: "SIGKILL" });
  });

  it("does not escalate once the command exits after SIGTERM", () => {
    vi.useFakeTimers();
    const { sent } = connect();
    void execOnMachine("m1", { command: "claude", runId: "run-1" });
    const { requestId } = sent[0] as Extract<MachineServerMessage, { type: "exec" }>;
    killMachineExecsForRun("run-1", 5_000);
    handleExecExited("m1", requestId, { exitCode: null, signal: "SIGTERM", timedOut: false });
    vi.advanceTimersByTime(5_000);
    expect(sent.filter((message) => message.type === "exec.kill")).toHaveLength(1);
  });

  it("fails a command the daemon no longer runs after reconnecting", async () => {
    const first = connect();
    const result = execOnMachine("m1", { command: "sleep" });
    first.registration.unregister();
    connect().registration.setHello(hello([]));
    await expect(result).rejects.toThrow(/machine_exec_lost/);
  });

  it("fails a command when the machine does not come back within the grace period", async () => {
    vi.useFakeTimers();
    const first = connect();
    const result = execOnMachine("m1", { command: "sleep" });
    const assertion = expect(result).rejects.toThrow(/did not reconnect/);
    first.registration.unregister();
    vi.advanceTimersByTime(60_001);
    await assertion;
  });

  it("closes the previous socket when the same machine connects twice", () => {
    const first = connect();
    connect();
    expect(first.close).toHaveBeenCalledWith(4000, "superseded");
    first.registration.unregister();
    expect(isMachineConnected("m1")).toBe(true);
  });

  it("resolves and rejects RPCs, and rejects pending ones on disconnect", async () => {
    const { sent, registration } = connect();
    const ok = callMachineRpc("m1", "context.stop", { contextId: "c1" });
    const okRequest = sent[0] as Extract<MachineServerMessage, { type: "rpc" }>;
    handleRpcResult("m1", okRequest.requestId, true, { stopped: 1 });
    await expect(ok).resolves.toEqual({ stopped: 1 });

    const pending = callMachineRpc("m1", "devcontainer.up", {});
    registration.unregister();
    await expect(pending).rejects.toBeInstanceOf(MachineUnavailableError);
  });
});
