import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeServerUrl } from "./api-client.js";

export interface LocalMachine {
  machineId: string;
  serverUrl: string;
  name: string | null;
  workspaceRoot: string | null;
  paired: boolean;
  configPath: string;
}

export function resolvePaperclipHome(env: NodeJS.ProcessEnv = process.env, homedir = os.homedir()): string {
  const raw = env.PAPERCLIP_HOME?.trim();
  if (!raw) return path.resolve(homedir, ".paperclip");
  if (raw === "~") return homedir;
  if (raw.startsWith("~/")) return path.resolve(homedir, raw.slice(2));
  return path.resolve(raw);
}

export function machineConfigPath(env: NodeJS.ProcessEnv = process.env, homedir = os.homedir()) {
  return path.join(resolvePaperclipHome(env, homedir), "machine", "config.json");
}

/**
 * Reads only the public fields of the daemon's pairing file. The credential
 * stays in the file: it is the daemon's secret, never the extension's.
 */
export function readLocalMachine(configPath = machineConfigPath()): LocalMachine | null {
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (typeof parsed.machineId !== "string" || typeof parsed.serverUrl !== "string") return null;
  return {
    machineId: parsed.machineId,
    serverUrl: parsed.serverUrl,
    name: typeof parsed.name === "string" ? parsed.name : null,
    workspaceRoot: typeof parsed.workspaceRoot === "string" ? parsed.workspaceRoot : null,
    paired: typeof parsed.credential === "string" && parsed.credential.length > 0,
    configPath,
  };
}

export function sameServer(a: string, b: string) {
  try {
    return normalizeServerUrl(a) === normalizeServerUrl(b);
  } catch {
    return false;
  }
}
