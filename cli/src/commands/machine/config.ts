import fs from "node:fs";
import path from "node:path";
import { resolvePaperclipHomeDir } from "../../config/home.js";

export interface MachineConfig {
  serverUrl: string;
  machineId: string;
  credential?: string | null;
  workspaceRoot: string;
  name?: string;
  headers?: Record<string, string>;
}

export function resolveMachineDir(): string {
  return path.resolve(resolvePaperclipHomeDir(), "machine");
}

export function resolveMachineConfigPath(): string {
  return path.join(resolveMachineDir(), "config.json");
}

export function resolveDefaultWorkspaceRoot(): string {
  return path.join(resolveMachineDir(), "workspaces");
}

export function readMachineConfig(configPath = resolveMachineConfigPath()): MachineConfig | null {
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed = JSON.parse(raw) as Partial<MachineConfig>;
  if (typeof parsed.serverUrl !== "string" || typeof parsed.machineId !== "string") {
    throw new Error(`Invalid machine config at ${configPath}: serverUrl and machineId are required`);
  }
  return {
    serverUrl: parsed.serverUrl,
    machineId: parsed.machineId,
    credential: typeof parsed.credential === "string" ? parsed.credential : null,
    workspaceRoot: typeof parsed.workspaceRoot === "string" ? parsed.workspaceRoot : resolveDefaultWorkspaceRoot(),
    ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
    ...(parsed.headers && typeof parsed.headers === "object" ? { headers: parsed.headers } : {}),
  };
}

export function writeMachineConfig(config: MachineConfig, configPath = resolveMachineConfigPath()): void {
  const directory = path.dirname(configPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  // mkdir's mode only applies to directories it creates; an existing one keeps its permissions.
  fs.chmodSync(directory, 0o700);
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporaryPath, configPath);
  fs.chmodSync(configPath, 0o600);
}

export function clearMachineCredential(configPath = resolveMachineConfigPath()): void {
  const config = readMachineConfig(configPath);
  if (!config) return;
  writeMachineConfig({ ...config, credential: null }, configPath);
}

export function normalizeServerUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`Invalid server URL: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Server URL must use http or https: ${value}`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function parseHeaderPairs(values: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const value of values) {
    const separator = value.indexOf(":");
    if (separator <= 0) throw new Error(`Invalid header "${value}": expected "Name: value"`);
    headers[value.slice(0, separator).trim()] = value.slice(separator + 1).trim();
  }
  return headers;
}

export function resolveExtraHeaders(
  config: Pick<MachineConfig, "headers"> | null,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const headers: Record<string, string> = { ...(config?.headers ?? {}) };
  const raw = env.PAPERCLIP_MACHINE_EXTRA_HEADERS?.trim();
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("PAPERCLIP_MACHINE_EXTRA_HEADERS must be a JSON object of header names to string values");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("PAPERCLIP_MACHINE_EXTRA_HEADERS must be a JSON object of header names to string values");
    }
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value !== "string") throw new Error(`PAPERCLIP_MACHINE_EXTRA_HEADERS.${name} must be a string`);
      headers[name] = value;
    }
  }
  return headers;
}
