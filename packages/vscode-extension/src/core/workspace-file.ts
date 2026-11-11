import path from "node:path";

export interface WorkspaceFolderEntry {
  path: string;
  name?: string;
}

export interface WorkspaceFile {
  folders: WorkspaceFolderEntry[];
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

export const READONLY_SETTING = "files.readonlyInclude";

/** VS Code writes `.code-workspace` files as JSONC; comments and trailing commas must not break parsing. */
export function parseJsonc(text: string): unknown {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    const next = text[i + 1];
    if (inString) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        i += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }
    if (char === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j += 1;
      if (text[j] === "}" || text[j] === "]") continue;
    }
    out += char;
  }
  return JSON.parse(out);
}

export function parseWorkspaceFile(text: string): WorkspaceFile {
  const parsed = parseJsonc(text) as Partial<WorkspaceFile> | null;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.folders)) {
    throw new Error("Not a VS Code workspace file: missing folders");
  }
  return parsed as WorkspaceFile;
}

export function serializeWorkspaceFile(file: WorkspaceFile): string {
  return `${JSON.stringify(file, null, "\t")}\n`;
}

export function createWorkspaceFile(controlFolder: string): WorkspaceFile {
  return { folders: [{ path: controlFolder, name: "Paperclip" }], settings: {} };
}

/**
 * Folder 0 is the fixed control folder. Replacing it restarts the extension
 * host, so every edit keeps it in place and only rewrites folders 1..n.
 */
export function withContextFolders(
  file: WorkspaceFile,
  controlFolder: string,
  folders: WorkspaceFolderEntry[],
): WorkspaceFile {
  const control = file.folders[0]?.path === controlFolder ? file.folders[0] : { path: controlFolder, name: "Paperclip" };
  return { ...file, folders: [control, ...folders] };
}

export function samePath(a: string, b: string) {
  return path.resolve(a) === path.resolve(b);
}

export interface FolderSwitchPlan {
  start: number;
  deleteCount: number;
  add: WorkspaceFolderEntry[];
}

/** Arguments for `workspace.updateWorkspaceFolders`, or null when the folders already match. */
export function planFolderSwitch(currentPaths: string[], next: WorkspaceFolderEntry[]): FolderSwitchPlan | null {
  const existing = currentPaths.slice(1);
  const unchanged = existing.length === next.length && existing.every((value, index) => samePath(value, next[index]!.path));
  if (unchanged) return null;
  return { start: 1, deleteCount: existing.length, add: next };
}

const GLOB_SPECIAL = /[*?{}[\]]/g;

export function toAbsoluteGlob(folder: string, platform: NodeJS.Platform = process.platform): string {
  let normalized = platform === "win32" ? folder.replace(/\\/g, "/") : folder;
  normalized = normalized.replace(/\/+$/, "");
  return `${normalized.replace(GLOB_SPECIAL, (char) => `[${char}]`)}/**`;
}

export function computeReadonlyGlobs(folders: string[], platform: NodeJS.Platform = process.platform): string[] {
  return [...new Set(folders.map((folder) => toAbsoluteGlob(folder, platform)))];
}

/**
 * Returns the next `files.readonlyInclude` value. Only globs this extension
 * added earlier are removed, so entries the user configured by hand survive
 * every lock and unlock.
 */
export function mergeReadonlyInclude(
  current: unknown,
  previouslyManaged: string[],
  nextManaged: string[],
): Record<string, boolean> | undefined {
  const result: Record<string, boolean> = {};
  if (current && typeof current === "object" && !Array.isArray(current)) {
    for (const [glob, enabled] of Object.entries(current as Record<string, unknown>)) {
      if (previouslyManaged.includes(glob)) continue;
      if (typeof enabled === "boolean") result[glob] = enabled;
    }
  }
  for (const glob of nextManaged) result[glob] = true;
  return Object.keys(result).length > 0 ? result : undefined;
}

export function withReadonlyGlobs(file: WorkspaceFile, previouslyManaged: string[], nextManaged: string[]): WorkspaceFile {
  const settings = { ...(file.settings ?? {}) };
  const merged = mergeReadonlyInclude(settings[READONLY_SETTING], previouslyManaged, nextManaged);
  if (merged) settings[READONLY_SETTING] = merged;
  else delete settings[READONLY_SETTING];
  return { ...file, settings };
}

export interface DirectoryReader {
  exists(target: string): boolean;
  isDirectory(target: string): boolean;
  list(target: string): string[];
}

/**
 * The daemon puts an issue's work under `remotePath`. That directory is
 * either one git worktree or a parent holding one worktree per repository.
 */
export function resolveContextFolders(remotePath: string | null, reader: DirectoryReader): string[] {
  if (!remotePath || !reader.isDirectory(remotePath)) return [];
  if (reader.exists(path.join(remotePath, ".git"))) return [remotePath];
  const repos = reader
    .list(remotePath)
    .filter((name) => !name.startsWith("."))
    .map((name) => path.join(remotePath, name))
    .filter((child) => reader.isDirectory(child) && reader.exists(path.join(child, ".git")))
    .sort();
  return repos.length > 0 ? repos : [remotePath];
}
