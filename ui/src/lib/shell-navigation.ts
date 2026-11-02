export type ContextualSidebarSurface =
  | "settings"
  | "apps"
  | "agent"
  | "routine"
  | "skills"
  | `plugin:${string}`;

export interface ShellRouteClassification {
  segments: string[];
  isTaskDetail: boolean;
  builtInContextualSurface: Exclude<ContextualSidebarSurface, `plugin:${string}`> | null;
}

const CONTEXTUAL_ORIGIN_KEY_PREFIX = "paperclip.contextualSidebar.origin";

export function getPathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function classifyShellRoute(pathname: string): ShellRouteClassification {
  const segments = getPathSegments(pathname);
  const root = segments[0]?.toLowerCase();
  const isOrganizationSettings = root === "organization" && ["settings", "export", "import"].includes(
    segments[1]?.toLowerCase() ?? "",
  );
  const agentSegment = segments[1]?.toLowerCase();
  const isAgentDetail = root === "agents"
    && Boolean(agentSegment)
    && agentSegment !== "new"
    && !["all", "active", "paused", "error", "builtin"].includes(agentSegment ?? "");
  const isRoutineDetail = root === "routines" && segments.length >= 2;
  const isSkillsSurface = root === "skills";

  return {
    segments,
    isTaskDetail: (root === "issues" || root === "chats") && segments.length >= 2,
    builtInContextualSurface: isOrganizationSettings
      ? "settings"
      : root === "apps" || root === "tools"
        ? "apps"
        : isAgentDetail
          ? "agent"
          : isRoutineDetail
            ? "routine"
            : isSkillsSurface
              ? "skills"
        : null,
  };
}

function contextualOriginStorageKey(surface: ContextualSidebarSurface) {
  return `${CONTEXTUAL_ORIGIN_KEY_PREFIX}:${surface}`;
}

// Rejects protocol-relative `//host/...`, which `navigate` would treat as off-origin.
function isBoardPath(pathname: string) {
  return pathname.startsWith("/") && !pathname.startsWith("//") && getPathSegments(pathname).length > 0;
}

export function rememberContextualSidebarOrigin({
  surface,
  previousPathname,
}: {
  surface: ContextualSidebarSurface;
  previousPathname: string;
}) {
  if (typeof window === "undefined" || !isBoardPath(previousPathname)) return;

  try {
    window.sessionStorage.setItem(contextualOriginStorageKey(surface), previousPathname);
  } catch {
    // Navigation still has a deterministic fallback when storage is unavailable.
  }
}

export function readContextualSidebarOrigin({
  surface,
  fallbackTo,
}: {
  surface: ContextualSidebarSurface;
  fallbackTo: string;
}) {
  if (typeof window === "undefined") return fallbackTo;

  try {
    const stored = window.sessionStorage.getItem(contextualOriginStorageKey(surface));
    return stored && isBoardPath(stored) ? stored : fallbackTo;
  } catch {
    return fallbackTo;
  }
}
