const STORAGE_KEY = "paperclip:recent-searches";
const MAX_RECENT_SEARCHES = 5;

function isStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadRecentSearches(): string[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned: string[] = [];
    for (const value of parsed) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      cleaned.push(trimmed);
      if (cleaned.length >= MAX_RECENT_SEARCHES) break;
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function pushRecentSearch(query: string): string[] {
  if (!isStorageAvailable()) return [];
  const trimmed = query.trim();
  if (!trimmed) return loadRecentSearches();
  const existing = loadRecentSearches();
  const filtered = existing.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearRecentSearches(): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const RECENT_SEARCHES_LIMIT = MAX_RECENT_SEARCHES;
