// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  classifyShellRoute,
  readContextualSidebarOrigin,
  rememberContextualSidebarOrigin,
} from "./shell-navigation";

describe("shell navigation", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("classifies task detail independently from list routes", () => {
    expect(classifyShellRoute("/issues").isTaskDetail).toBe(false);
    expect(classifyShellRoute("/issues/task-1").isTaskDetail).toBe(true);
  });

  it("classifies the built-in contextual surfaces", () => {
    expect(classifyShellRoute("/organization/settings/secrets").builtInContextualSurface).toBe("settings");
    expect(classifyShellRoute("/organization/export").builtInContextualSurface).toBe("settings");
    expect(classifyShellRoute("/apps/connections").builtInContextualSurface).toBe("apps");
    expect(classifyShellRoute("/tools/runtime").builtInContextualSurface).toBe("apps");
    expect(classifyShellRoute("/agents/agent-1/instructions").builtInContextualSurface).toBe("agent");
    expect(classifyShellRoute("/agents/agent-1/runs/run-1").builtInContextualSurface).toBe("agent");
    expect(classifyShellRoute("/routines/routine-1/overview").builtInContextualSurface).toBe("routine");
    expect(classifyShellRoute("/skills").builtInContextualSurface).toBe("skills");
    expect(classifyShellRoute("/skills/studio/skill-1").builtInContextualSurface).toBe("skills");
  });

  it("keeps Agent and Routine collection routes in the global shell", () => {
    for (const pathname of [
      "/agents",
      "/agents/all",
      "/agents/active",
      "/agents/paused",
      "/agents/error",
      "/agents/builtin",
      "/agents/new",
      "/routines",
    ]) {
      expect(classifyShellRoute(pathname).builtInContextualSurface).toBeNull();
    }
  });

  it("remembers only board origins", () => {
    rememberContextualSidebarOrigin({
      surface: "settings",
      previousPathname: "/issues/task-1",
    });
    expect(readContextualSidebarOrigin({
      surface: "settings",
      fallbackTo: "/dashboard",
    })).toBe("/issues/task-1");

    rememberContextualSidebarOrigin({
      surface: "settings",
      previousPathname: "//evil.example/dashboard",
    });
    expect(readContextualSidebarOrigin({
      surface: "settings",
      fallbackTo: "/dashboard",
    })).toBe("/issues/task-1");
  });

  it("falls back when storage contains an unsafe path", () => {
    window.sessionStorage.setItem(
      "paperclip.contextualSidebar.origin:settings",
      "//evil.example/organization/settings",
    );
    expect(readContextualSidebarOrigin({
      surface: "settings",
      fallbackTo: "/dashboard",
    })).toBe("/dashboard");
  });
});
