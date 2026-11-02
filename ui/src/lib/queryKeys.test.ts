import { describe, expect, it } from "vitest";
import { queryKeys } from "./queryKeys";

describe("project query keys", () => {
  it("separates default and includeArchived project list caches", () => {
    expect(queryKeys.projects.list()).toEqual([
      "projects",
      "list",
      { includeArchived: false },
    ]);
    expect(queryKeys.projects.list({ includeArchived: true })).toEqual([
      "projects",
      "list",
      { includeArchived: true },
    ]);
    expect(queryKeys.projects.list()).not.toEqual(
      queryKeys.projects.list({ includeArchived: true }),
    );
    expect(queryKeys.projects.all()).toEqual(["projects", "list"]);
  });
});

describe("collection keys", () => {
  it("keep list queries apart from detail queries of the same feature", () => {
    const isPrefix = (prefix: readonly unknown[], key: readonly unknown[]) =>
      prefix.every((part, index) => key[index] === part);
    expect(isPrefix(queryKeys.issues.list(), queryKeys.issues.detail("i-1"))).toBe(false);
    expect(isPrefix(queryKeys.issues.list(), queryKeys.issues.listByProject("p-1"))).toBe(true);
    expect(isPrefix(queryKeys.agents.list(), queryKeys.agents.detail("a-1"))).toBe(false);
    expect(isPrefix(queryKeys.projects.all(), queryKeys.projects.detail("p-1"))).toBe(false);
    expect(isPrefix(queryKeys.chatEndpoints.list(), queryKeys.chatEndpoints.detail("e-1"))).toBe(false);
  });
});

describe("audit query keys", () => {
  it("separates entity-scoped activity from the unscoped feed", () => {
    const unscoped = queryKeys.audit.agentActions({ actorScope: "all" });
    const routine = queryKeys.audit.agentActions({
      actorScope: "all",
      entityType: "routine",
      entityId: "routine-1",
    });

    expect(routine).not.toEqual(unscoped);
    expect(routine).toContain("routine-1");
  });
});
