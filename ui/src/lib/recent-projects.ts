import {
  readRecentSelectionIds,
  trackRecentSelectionId,
} from "./recent-selections";

const STORAGE_KEY = "paperclip:recent-projects";
const LAST_PROJECT_STORAGE_KEY = `${STORAGE_KEY}:last`;

export function getRecentProjectIds(): string[] {
  return readRecentSelectionIds(STORAGE_KEY);
}

/** Undefined means no history; an empty string remembers an explicit No project. */
export function getLastProjectId(): string | undefined {
  try {
    return localStorage.getItem(LAST_PROJECT_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function trackRecentProject(projectId: string): void {
  trackRecentSelectionId(STORAGE_KEY, projectId);
  try {
    localStorage.setItem(LAST_PROJECT_STORAGE_KEY, projectId);
  } catch {
    // Selection remains usable when browser storage is unavailable.
  }
}
