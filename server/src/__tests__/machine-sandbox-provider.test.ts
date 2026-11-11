import { afterEach, describe, expect, it } from "vitest";
import type { MachineDaemonHello, MachineServerMessage } from "@paperclipai/shared";
import {
  handleExecExited,
  handleRpcResult,
  killMachineExecsForRun,
  registerMachineConnection,
  resetMachineConnectionsForTests,
} from "../services/machine-connections.js";
import { MachineSandboxProvider, runsInContainer } from "../services/machine-sandbox-provider.js";

type ExecFrame = Extract<MachineServerMessage, { type: "exec" }>;
type RpcFrame = Extract<MachineServerMessage, { type: "rpc" }>;

function fakeMachine(options: { docker: boolean; devcontainerCli: boolean; hasConfig: boolean }) {
  const frames: MachineServerMessage[] = [];
  const registration = registerMachineConnection({
    machineId: "m1",
    close: () => {},
    send: (message) => {
      frames.push(message);
      queueMicrotask(() => {
        if (message.type === "exec") {
          const isConfigCheck = message.command === "sh" && message.args.join(" ").includes("devcontainer.json");
          const exitCode = isConfigCheck && !options.hasConfig ? 1 : 0;
          handleExecExited("m1", message.requestId, { exitCode, signal: null, timedOut: false });
        } else if (message.type === "rpc") {
          handleRpcResult("m1", message.requestId, true, { outcome: "success" });
        }
      });
    },
  });
  registration.setHello({
    type: "hello",
    protocolVersion: 1,
    daemonVersion: "test",
    platform: "linux",
    arch: "x64",
    hostname: "box",
    workspaceRoot: "/w",
    capabilities: { docker: options.docker, devcontainerCli: options.devcontainerCli, runnerd: null, tools: [] },
    runningRequestIds: [],
  } as unknown as MachineDaemonHello);
  return frames;
}

const leaseInput = {
  config: { provider: "paperclip_machine", machineId: "m1", reuseLease: false },
  issueId: "11111111-1111-4111-8111-111111111111",
  heartbeatRunId: "run-1",
} as never;

describe("machine sandbox provider", () => {
  afterEach(() => resetMachineConnectionsForTests());

  it("only routes commands inside the workspace into the container", () => {
    expect(runsInContainer("/w/issues/a", "/w/issues/a")).toBe(true);
    expect(runsInContainer("/w/issues/a/api", "/w/issues/a")).toBe(true);
    expect(runsInContainer("/w/issues/ab", "/w/issues/a")).toBe(false);
    expect(runsInContainer("/tmp/stage", "/w/issues/a")).toBe(false);
    expect(runsInContainer(undefined, "/w/issues/a")).toBe(false);
  });

  it("starts the dev container when the workspace has one and the machine can run it", async () => {
    const frames = fakeMachine({ docker: true, devcontainerCli: true, hasConfig: true });
    const provider = new MachineSandboxProvider();
    const lease = await provider.acquireLease(leaseInput);
    const workspace = "/w/issues/11111111-1111-4111-8111-111111111111";
    expect(lease.metadata.container).toEqual({ workspaceFolder: workspace });
    const up = frames.find((frame): frame is RpcFrame => frame.type === "rpc");
    expect(up).toMatchObject({ method: "devcontainer.up", params: { workspaceFolder: workspace, workspaceMountTarget: workspace } });

    const config = provider.configFromLeaseMetadata(lease.metadata)!;
    await provider.execute({ config, providerLeaseId: lease.providerLeaseId, command: "claude", cwd: workspace });
    await provider.execute({ config, providerLeaseId: lease.providerLeaseId, command: "tar", cwd: "/tmp/stage" });
    const execs = frames.filter((frame): frame is ExecFrame => frame.type === "exec");
    expect(execs.find((frame) => frame.command === "claude")?.container).toEqual({ workspaceFolder: workspace });
    expect(execs.find((frame) => frame.command === "tar")?.container).toBeNull();
  });

  it("ties each command to the run that leased the machine so cancelling the run can kill it", async () => {
    const frames = fakeMachine({ docker: false, devcontainerCli: false, hasConfig: false });
    const provider = new MachineSandboxProvider();
    const lease = await provider.acquireLease(leaseInput);
    const config = provider.configFromLeaseMetadata(lease.metadata)!;
    const running = provider.execute({ config, providerLeaseId: lease.providerLeaseId, command: "claude" });
    const exec = frames.filter((frame): frame is ExecFrame => frame.type === "exec").at(-1)!;
    expect(killMachineExecsForRun("run-1")).toBe(1);
    expect(frames).toContainEqual({ type: "exec.kill", requestId: exec.requestId, signal: "SIGTERM" });
    await running;
  });

  it("runs on the host when the repository has no dev container or the machine lacks the tools", async () => {
    let frames = fakeMachine({ docker: true, devcontainerCli: true, hasConfig: false });
    expect((await new MachineSandboxProvider().acquireLease(leaseInput)).metadata.container).toBeNull();
    expect(frames.some((frame) => frame.type === "rpc")).toBe(false);

    resetMachineConnectionsForTests();
    frames = fakeMachine({ docker: false, devcontainerCli: true, hasConfig: true });
    expect((await new MachineSandboxProvider().acquireLease(leaseInput)).metadata.container).toBeNull();
    expect(frames.filter((frame) => frame.type === "exec")).toHaveLength(1);
  });
});
