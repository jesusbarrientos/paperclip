import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { MachineCapabilities } from "@paperclipai/shared";
import { buildToolEnv } from "./exec-engine.js";

export const DETECTED_TOOLS = [
  "git",
  "node",
  "pnpm",
  "npm",
  "python3",
  "gh",
  "docker",
  "xcodebuild",
  "swift",
  "go",
  "cargo",
  "java",
] as const;

export interface CommandResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export function runTool(
  command: string,
  args: string[],
  options: { timeoutMs: number; env?: NodeJS.ProcessEnv; cwd?: string },
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: options.timeoutMs,
        env: options.env ?? buildToolEnv(process.env),
        cwd: options.cwd,
        maxBuffer: 32 * 1024 * 1024,
        encoding: "utf8",
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const code = error ? (typeof (error as { code?: unknown }).code === "number" ? (error as { code: number }).code : null) : 0;
        resolve({ ok: !error, code, stdout: String(stdout), stderr: String(stderr), ...(error ? { error: error.message } : {}) });
      },
    );
  });
}

export function findOnPath(binary: string, envPath = process.env.PATH ?? ""): string | null {
  for (const directory of envPath.split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, binary);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

export async function detectCapabilities(env: NodeJS.ProcessEnv = process.env): Promise<MachineCapabilities> {
  const envPath = env.PATH ?? "";
  const [docker, devcontainer, runnerd] = await Promise.all([
    runTool("docker", ["info", "--format", "{{.ServerVersion}}"], { timeoutMs: 5_000 }),
    runTool("devcontainer", ["--version"], { timeoutMs: 5_000 }),
    detectRunnerd(env),
  ]);
  return {
    docker: docker.ok,
    devcontainerCli: devcontainer.ok,
    runnerd,
    tools: DETECTED_TOOLS.filter((tool) => findOnPath(tool, envPath) !== null),
  };
}

async function detectRunnerd(env: NodeJS.ProcessEnv): Promise<MachineCapabilities["runnerd"]> {
  const configured = env.PAPERCLIP_RUNNERD_PATH?.trim();
  const runnerdPath = configured ? path.resolve(configured) : findOnPath("paperclip-runnerd", env.PATH ?? "");
  if (!runnerdPath) return null;
  try {
    fs.accessSync(runnerdPath, fs.constants.X_OK);
  } catch {
    return null;
  }
  const result = await runTool(runnerdPath, ["--version"], { timeoutMs: 3_000 });
  const version = result.ok ? result.stdout.trim().split("\n")[0]?.trim().slice(0, 64) || null : null;
  return { path: runnerdPath, version };
}
