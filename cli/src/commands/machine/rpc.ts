import fs from "node:fs";
import path from "node:path";
import type { MachineDaemonMessage } from "@paperclipai/shared";
import type { MachineExecEngine } from "./exec-engine.js";
import { runTool, type CommandResult } from "./host.js";
import { materializeContext, snapshotContext, type SyncDeps } from "./sync.js";

type RpcResult = Extract<MachineDaemonMessage, { type: "rpc.result" }>;

export interface RpcDeps {
  engine: Pick<MachineExecEngine, "stopContext">;
  runTool?: typeof runTool;
  sync?: SyncDeps;
}

const DEVCONTAINER_UP_TIMEOUT_MS = 30 * 60 * 1_000;
const DOCKER_TIMEOUT_MS = 60_000;

export async function handleRpc(
  request: { requestId: string; method: string; params: Record<string, unknown> | undefined },
  deps: RpcDeps,
): Promise<RpcResult> {
  const { requestId } = request;
  const params = request.params ?? {};
  const ok = (result: unknown): RpcResult => ({ type: "rpc.result", requestId, ok: true, result });
  const fail = (error: string): RpcResult => ({ type: "rpc.result", requestId, ok: false, error: error.slice(0, 4096) });
  const run = deps.runTool ?? runTool;

  try {
    switch (request.method) {
      case "context.stop": {
        const contextId = params.contextId;
        if (typeof contextId !== "string" || !contextId) return fail("contextId is required");
        return ok({ stopped: deps.engine.stopContext(contextId) });
      }
      case "context.snapshot": {
        if (!deps.sync) return fail("This daemon cannot sync work contexts");
        return ok(await snapshotContext({
          issueId: requireString(params.issueId, "issueId"),
          path: requireAbsolutePath(params.path, "path"),
          fencingToken: requireInteger(params.fencingToken, "fencingToken"),
          seq: requireInteger(params.seq, "seq"),
          since: typeof params.since === "string" && params.since ? params.since : null,
        }, deps.sync));
      }
      case "context.materialize": {
        if (!deps.sync) return fail("This daemon cannot sync work contexts");
        return ok(await materializeContext({
          issueId: requireString(params.issueId, "issueId"),
          path: requireAbsolutePath(params.path, "path"),
          seq: requireInteger(params.seq, "seq"),
          commit: requireString(params.commit, "commit"),
        }, deps.sync));
      }
      case "devcontainer.up": {
        const workspaceFolder = requireAbsolutePath(params.workspaceFolder, "workspaceFolder");
        const mountTarget = params.workspaceMountTarget == null
          ? null
          : requireAbsolutePath(params.workspaceMountTarget, "workspaceMountTarget");
        return await devcontainerUp(workspaceFolder, mountTarget, run, ok, fail);
      }
      case "devcontainer.down": {
        const workspaceFolder = requireAbsolutePath(params.workspaceFolder, "workspaceFolder");
        const list = await run(
          "docker",
          ["ps", "-aq", "--filter", `label=devcontainer.local_folder=${workspaceFolder}`],
          { timeoutMs: DOCKER_TIMEOUT_MS },
        );
        if (!list.ok) return fail(`docker ps failed: ${describeFailure(list)}`);
        const ids = list.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
        if (ids.length > 0) {
          const removed = await run("docker", ["rm", "-f", ...ids], { timeoutMs: DOCKER_TIMEOUT_MS });
          if (!removed.ok) return fail(`docker rm failed: ${describeFailure(removed)}`);
        }
        return ok({ removed: ids });
      }
      default:
        return fail(`Unknown method: ${request.method}`);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

async function devcontainerUp(
  workspaceFolder: string,
  mountTarget: string | null,
  run: typeof runTool,
  ok: (result: unknown) => RpcResult,
  fail: (error: string) => RpcResult,
): Promise<RpcResult> {
  const args = ["up", "--workspace-folder", workspaceFolder];
  let overridePath: string | null = null;
  if (mountTarget) {
    overridePath = writeMountOverride(workspaceFolder, mountTarget);
    args.push("--mount-workspace-git-root", "false", "--override-config", overridePath);
  }
  try {
    const result = await run("devcontainer", args, { timeoutMs: DEVCONTAINER_UP_TIMEOUT_MS });
    const parsed = parseLastJsonLine(result.stdout);
    if (parsed && typeof parsed === "object" && (parsed as { outcome?: unknown }).outcome === "success") {
      return ok(parsed);
    }
    const message = parsed && typeof parsed === "object"
      ? String((parsed as { message?: unknown }).message ?? (parsed as { description?: unknown }).description ?? JSON.stringify(parsed))
      : describeFailure(result);
    return fail(`devcontainer up failed: ${message}`);
  } finally {
    if (overridePath) fs.rmSync(overridePath, { force: true });
  }
}

/**
 * `--override-config` replaces the project's devcontainer.json instead of
 * merging into it, so the override is the project's config plus the mount.
 * It is written next to the original because relative paths inside it
 * (Dockerfile, compose files) resolve against the config file's directory.
 */
function writeMountOverride(workspaceFolder: string, mountTarget: string): string {
  if (workspaceFolder.includes(",") || mountTarget.includes(",")) {
    throw new Error("Workspace paths containing commas cannot be expressed as a devcontainer mount");
  }
  const configPath = findDevcontainerConfig(workspaceFolder);
  if (!configPath) throw new Error(`No devcontainer.json found in ${workspaceFolder}`);
  const config = parseJsonc(fs.readFileSync(configPath, "utf8"));
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`${configPath} is not a JSON object`);
  }
  const override = {
    ...(config as Record<string, unknown>),
    workspaceMount: `source=${workspaceFolder},target=${mountTarget},type=bind`,
    workspaceFolder: mountTarget,
  };
  const overridePath = path.join(path.dirname(configPath), `.paperclip-override-${process.pid}-${Date.now()}.devcontainer.json`);
  fs.writeFileSync(overridePath, JSON.stringify(override, null, 2), { mode: 0o600 });
  return overridePath;
}

export function findDevcontainerConfig(workspaceFolder: string): string | null {
  for (const candidate of [
    path.join(workspaceFolder, ".devcontainer", "devcontainer.json"),
    path.join(workspaceFolder, ".devcontainer.json"),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function parseJsonc(text: string): unknown {
  let output = "";
  let inString = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    const next = text[index + 1];
    if (inString) {
      output += char;
      if (char === "\\") {
        output += next ?? "";
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
    } else if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      output += "\n";
    } else if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index += 1;
    } else {
      output += char;
    }
  }
  return JSON.parse(stripTrailingCommas(output));
}

function stripTrailingCommas(text: string): string {
  let output = "";
  let inString = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      output += char;
      if (char === "\\") {
        output += text[index + 1] ?? "";
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') inString = true;
    if (char === ",") {
      const rest = text.slice(index + 1).trimStart();
      if (rest.startsWith("}") || rest.startsWith("]")) continue;
    }
    output += char;
  }
  return output;
}

function parseLastJsonLine(stdout: string): unknown {
  const lines = stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line);
    } catch {}
  }
  return null;
}

function requireAbsolutePath(value: unknown, name: string): string {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  return path.resolve(value);
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${name} is required`);
  return value;
}

function requireInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function describeFailure(result: CommandResult): string {
  return (result.stderr.trim() || result.error || `exit ${result.code}`).slice(-2_000);
}
