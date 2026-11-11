import path from "node:path";
import type { EnvironmentProbeResult, MachineCapabilities, SandboxEnvironmentConfig } from "@paperclipai/shared";
import { MACHINE_LEASE_PREFIX, MACHINE_SANDBOX_PROVIDER } from "@paperclipai/shared";
import {
  callMachineRpc,
  execOnMachine,
  getMachineHello,
  isMachineConnected,
  MachineUnavailableError,
} from "./machine-connections.js";
import type {
  AcquireSandboxLeaseInput,
  DestroySandboxLeaseInput,
  ReleaseSandboxLeaseInput,
  ResumeSandboxLeaseInput,
  SandboxExecuteInput,
  SandboxExecuteResult,
  SandboxLeaseHandle,
  SandboxProvider,
  SandboxProviderValidationResult,
} from "./sandbox-provider-runtime.js";

function machineIdFromConfig(config: SandboxEnvironmentConfig): string {
  const machineId = (config as Record<string, unknown>).machineId;
  if (typeof machineId !== "string" || machineId.length === 0) {
    throw new Error("Machine environment config is missing machineId");
  }
  return machineId;
}

function machineIdFromLeaseId(providerLeaseId: string | null): string | null {
  if (!providerLeaseId?.startsWith(MACHINE_LEASE_PREFIX)) return null;
  return providerLeaseId.slice(MACHINE_LEASE_PREFIX.length).split("/")[0] || null;
}

function runIdFromLeaseId(providerLeaseId: string | null): string | null {
  if (!providerLeaseId?.startsWith(MACHINE_LEASE_PREFIX)) return null;
  return providerLeaseId.slice(MACHINE_LEASE_PREFIX.length).split("/")[1] || null;
}

/**
 * The workspace is keyed by issue, not by run, so the checkout survives between
 * runs and the developer can keep it open in an editor on that machine.
 */
export function machineContextPath(workspaceRoot: string, input: { issueId: string | null; heartbeatRunId: string }) {
  return input.issueId
    ? path.posix.join(workspaceRoot, "issues", input.issueId)
    : path.posix.join(workspaceRoot, "runs", input.heartbeatRunId);
}

const DEVCONTAINER_UP_TIMEOUT_MS = 30 * 60_000;

/** Commands inside the issue workspace run in its dev container; staging and bootstrap elsewhere stay on the host. */
export function runsInContainer(cwd: string | null | undefined, workspaceFolder: string) {
  if (!cwd) return false;
  const relative = path.posix.relative(workspaceFolder, path.posix.normalize(cwd));
  return relative === "" || (!relative.startsWith("..") && !path.posix.isAbsolute(relative));
}

async function hasDevcontainerConfig(machineId: string, folder: string) {
  const check = await execOnMachine(machineId, {
    command: "sh",
    args: ["-c", 'test -f "$0/.devcontainer/devcontainer.json" || test -f "$0/.devcontainer.json"', folder],
    timeoutMs: 30_000,
  });
  return check.exitCode === 0;
}

/** The workspace is mounted at its host path so every path the server sends is valid inside the container too. */
async function prepareContainer(
  machineId: string,
  remoteCwd: string,
  capabilities: Pick<MachineCapabilities, "docker" | "devcontainerCli"> | null,
) {
  if (!capabilities?.docker || !capabilities.devcontainerCli) return null;
  if (!(await hasDevcontainerConfig(machineId, remoteCwd))) return null;
  await callMachineRpc(
    machineId,
    "devcontainer.up",
    { workspaceFolder: remoteCwd, workspaceMountTarget: remoteCwd },
    DEVCONTAINER_UP_TIMEOUT_MS,
  );
  return { workspaceFolder: remoteCwd };
}

export class MachineSandboxProvider implements SandboxProvider {
  readonly provider = MACHINE_SANDBOX_PROVIDER;
  readonly supportsReusableLeases = false;

  async validateConfig(config: SandboxEnvironmentConfig): Promise<SandboxProviderValidationResult> {
    machineIdFromConfig(config);
    return { ok: true, summary: "Machine environment config is valid." };
  }

  async probe(config: SandboxEnvironmentConfig): Promise<EnvironmentProbeResult> {
    const machineId = machineIdFromConfig(config);
    const connected = isMachineConnected(machineId);
    return {
      ok: connected,
      driver: "sandbox",
      summary: connected ? "Machine is connected." : "Machine is not connected.",
      details: { provider: this.provider, machineId },
    };
  }

  async acquireLease(input: AcquireSandboxLeaseInput): Promise<SandboxLeaseHandle> {
    const machineId = machineIdFromConfig(input.config);
    const hello = getMachineHello(machineId);
    if (!hello) throw new MachineUnavailableError(machineId);
    const remoteCwd = machineContextPath(hello.workspaceRoot, input);
    const prepared = await execOnMachine(machineId, {
      command: "mkdir",
      args: ["-p", remoteCwd],
      timeoutMs: 30_000,
    });
    if (prepared.exitCode !== 0) {
      throw new Error(`machine_workspace_prepare_failed: ${prepared.stderr.trim() || `exit ${prepared.exitCode}`}`);
    }
    const container = await prepareContainer(machineId, remoteCwd, hello.capabilities ?? null);
    return {
      providerLeaseId: `${MACHINE_LEASE_PREFIX}${machineId}/${input.heartbeatRunId}`,
      metadata: {
        provider: this.provider,
        machineId,
        remoteCwd,
        platform: hello.platform,
        arch: hello.arch,
        reuseLease: false,
        container,
      },
    };
  }

  async resumeLease(_input: ResumeSandboxLeaseInput): Promise<SandboxLeaseHandle | null> {
    return null;
  }

  async releaseLease(_input: ReleaseSandboxLeaseInput): Promise<void> {
    return;
  }

  async destroyLease(_input: DestroySandboxLeaseInput): Promise<void> {
    return;
  }

  matchesReusableLease(): boolean {
    return false;
  }

  configFromLeaseMetadata(metadata: Record<string, unknown>): SandboxEnvironmentConfig | null {
    if (metadata.provider !== this.provider || typeof metadata.machineId !== "string") return null;
    const container = metadata.container as { workspaceFolder?: unknown } | null | undefined;
    return {
      provider: this.provider,
      machineId: metadata.machineId,
      reuseLease: false,
      ...(typeof container?.workspaceFolder === "string" ? { container: { workspaceFolder: container.workspaceFolder } } : {}),
    };
  }

  async execute(input: SandboxExecuteInput): Promise<SandboxExecuteResult> {
    const machineId = machineIdFromLeaseId(input.providerLeaseId) ?? machineIdFromConfig(input.config);
    const container = (input.config as { container?: { workspaceFolder: string } }).container ?? null;
    const result = await execOnMachine(machineId, {
      container: container && runsInContainer(input.cwd, container.workspaceFolder) ? container : null,
      command: input.command,
      args: input.args,
      cwd: input.cwd ?? null,
      env: input.env,
      stdin: input.stdin ?? null,
      timeoutMs: input.timeoutMs ?? null,
      runId: runIdFromLeaseId(input.providerLeaseId),
      onLog: input.onLog,
    });
    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      ...(result.timedOut ? { timedOut: true } : {}),
    };
  }
}
