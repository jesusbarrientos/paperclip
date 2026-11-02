import { describe, expect, it } from "vitest";

import { createTestHarness } from "../src/testing.js";
import type { PaperclipPluginManifestV1 } from "../src/types.js";

const manifest = {
  id: "paperclip.test-actions",
  apiVersion: 1,
  version: "1.0.0",
  displayName: "Test Actions",
  description: "Test plugin",
  author: "Paperclip",
  categories: ["automation"],
  capabilities: [],
  entrypoints: {},
} satisfies PaperclipPluginManifestV1;

describe("createTestHarness action context", () => {
  it("passes immutable authenticated actor context", async () => {
    const harness = createTestHarness({ manifest });

    harness.ctx.actions.register("inspect", async (_params, context) => ({
      actor: context.actor,
      contextFrozen: Object.isFrozen(context),
      actorFrozen: Object.isFrozen(context.actor),
    }));

    const result = await harness.performAction<{
      actor: {
        type: string;
        userId: string | null;
        agentId: string | null;
        runId: string | null;
      };
      contextFrozen: boolean;
      actorFrozen: boolean;
    }>(
      "inspect",
      { value: true },
      {
        actor: {
          type: "user",
          userId: "board-user-1",
          runId: "run-1",
        },
      },
    );

    expect(result.actor).toEqual({
      type: "user",
      userId: "board-user-1",
      agentId: null,
      runId: "run-1"
    });
    expect(result.contextFrozen).toBe(true);
    expect(result.actorFrozen).toBe(true);
  });

  it("keeps existing one-argument action handlers compatible", async () => {
    const harness = createTestHarness({ manifest });
    harness.ctx.actions.register("legacy", async (params) => ({ ok: params.ok }));

    await expect(harness.performAction("legacy", { ok: true })).resolves.toEqual({ ok: true });
  });
});

describe("createTestHarness managed routines", () => {
  it("preserves declared activity gate settings", async () => {
    const harness = createTestHarness({
      manifest: {
        ...manifest,
        capabilities: ["routines.managed"],
        routines: [{
          routineKey: "quiet-watcher",
          title: "Quiet watcher",
          activityGatePolicy: "require_external_activity",
          activityGateScope: "project",
        }],
      },
    });

    const resolved = await harness.ctx.routines.managed.reconcile("quiet-watcher");

    expect(resolved.routine).toMatchObject({
      activityGatePolicy: "require_external_activity",
      activityGateScope: "project",
    });
  });
});

describe("createTestHarness issue interactions", () => {
  it("normalizes a canonical question form through the typed host helper", async () => {
    const harness = createTestHarness({ manifest, capabilities: ["issues.create", "issue.interactions.create"] });
    const issue = await harness.ctx.issues.create({ title: "Ask for a repository" });
    const input = {
      idempotencyKey: "canonical:repo",
      payload: { version: 1 as const, questionSet: { schema: "paperclip.question_set.v1" as const, questions: [{ id: "repo", prompt: "Repository URL?", required: true, answerMode: "text" as const }] } },
    };
    const created = await harness.ctx.issues.askUserQuestions(issue.id, input);
    expect(created.payload.questionSet).toEqual(input.payload.questionSet);
    expect(created.payload.questions).toMatchObject([{ id: "repo", options: [{ id: "paperclip_text_answer", freeText: true }] }]);
    expect(await harness.ctx.issues.askUserQuestions(issue.id, input)).toEqual(created);
  });
  it("creates request_checkbox_confirmation interactions through the typed host helper", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: ["issues.create", "issue.interactions.create"],
    });
    const issue = await harness.ctx.issues.create({
      title: "Pick files",
    });

    const interaction = await harness.ctx.issues.requestCheckboxConfirmation(
      issue.id,
      {
        idempotencyKey: "checkbox:files",
        title: "Choose files",
        payload: {
          version: 1,
          prompt: "Which files should be included?",
          options: [
            { id: "file-a", label: "File A" },
            { id: "file-b", label: "File B", description: "Secondary draft" },
          ],
          defaultSelectedOptionIds: ["file-a"],
          minSelected: 1,
          maxSelected: 2,
        },
      },
      { authorAgentId: "agent-1" },
    );

    expect(interaction).toMatchObject({
      issueId: issue.id,
      kind: "request_checkbox_confirmation",
      status: "pending",
      continuationPolicy: "wake_assignee",
      idempotencyKey: "checkbox:files",
      title: "Choose files",
      createdByAgentId: "agent-1",
      payload: {
        version: 1,
        prompt: "Which files should be included?",
        options: [
          { id: "file-a", label: "File A" },
          { id: "file-b", label: "File B", description: "Secondary draft" },
        ],
        defaultSelectedOptionIds: ["file-a"],
        minSelected: 1,
        maxSelected: 2,
      },
    });
  });
});
