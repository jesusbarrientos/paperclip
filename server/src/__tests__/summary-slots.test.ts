import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  activityLog,
  agents,
  organizations,
  createDb,
  documentRevisions,
  documents,
  executionWorkspaces,
  heartbeatRuns,
  issues,
  projectWorkspaces,
  projects,
  summarySlots,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { summarySlotService } from "../services/summary-slots.ts";
import { withBuiltInAgentMarker } from "../services/built-in-agent-metadata.ts";
import { issueService } from "../services/issues.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function issuePrefix(id: string) {
  return `T${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres summary-slot tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("summary slot service", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-summary-slots-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(summarySlots);
    await db.delete(documentRevisions);
    await db.delete(documents);
    await db.delete(issues);
    await db.delete(heartbeatRuns);
    await db.delete(executionWorkspaces);
    await db.delete(projectWorkspaces);
    await db.delete(projects);
    await db.delete(activityLog);
    await db.delete(agents);
    await db.delete(organizations);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompany() {
    const companyId = randomUUID();
    await db.insert(organizations).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: issuePrefix(companyId),
      defaultResponsibleUserId: "responsible-user",
    });
    return companyId;
  }

  async function seedProject() {
    const projectId = randomUUID();
    await db.insert(projects).values({ id: projectId, name: "Paperclip App" });
    return projectId;
  }

  async function seedProjectWorkspace(projectId: string) {
    const projectWorkspaceId = randomUUID();
    await db.insert(projectWorkspaces).values({
      id: projectWorkspaceId,
      projectId,
      name: "Primary workspace",
    });
    return projectWorkspaceId;
  }

  async function seedExecutionWorkspace(
    projectId: string,
    projectWorkspaceId: string | null = null,
  ) {
    const executionWorkspaceId = randomUUID();
    await db.insert(executionWorkspaces).values({
      id: executionWorkspaceId,
      projectId,
      projectWorkspaceId,
      mode: "isolated_workspace",
      strategyType: "git_worktree",
      name: `Execution workspace ${executionWorkspaceId}`,
    });
    return executionWorkspaceId;
  }

  async function seedSummarizer(ready = true) {
    const agentId = randomUUID();
    await db.insert(agents).values({
      id: agentId,
      name: "Summarizer",
      role: "general",
      status: "idle",
      adapterType: "codex_local",
      adapterConfig: ready ? { model: "gpt-5.4" } : {},
      metadata: withBuiltInAgentMarker(null, { key: "summarizer", featureKeys: ["summarizer"] }),
    });
    return agentId;
  }

  async function seedPlainAgent() {
    const agentId = randomUUID();
    await db.insert(agents).values({
      id: agentId,
      name: "Coder",
      role: "engineer",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: { model: "gpt-5.4" },
    });
    return agentId;
  }

  async function seedRun(agentId: string) {
    const runId = randomUUID();
    await db.insert(heartbeatRuns).values({ id: runId, agentId, status: "running" });
    return runId;
  }

  function projectSelector(projectId: string) {
    return { scopeKind: "project", slotKey: "header", scopeId: projectId };
  }

  function executionWorkspaceSelector(executionWorkspaceId: string) {
    return {
      scopeKind: "execution_workspace",
      slotKey: "header",
      scopeId: executionWorkspaceId,
    };
  }

  describe("reads and target visibility", () => {
    it("returns an empty slot state before any generation", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const svc = summarySlotService(db);
      const result = await svc.getSlot(projectSelector(projectId));
      expect(result).toEqual({ slot: null, document: null, generatingIssue: null });
    });

    it("rejects targets that do not exist", async () => {
      const companyId = await seedCompany();
      const svc = summarySlotService(db);
      await expect(svc.getSlot(projectSelector(randomUUID()))).rejects.toMatchObject({
        status: 404,
      });
    });

    it("rejects a workspaces_overview selector that carries a scopeId", async () => {
      const companyId = await seedCompany();
      const svc = summarySlotService(db);
      await expect(
        svc.getSlot({ scopeKind: "workspaces_overview", slotKey: "header", scopeId: randomUUID() }),
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  describe("generate", () => {
    it("fails when the Summarizer built-in is not configured", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const svc = summarySlotService(db);
      await expect(
        svc.generate(projectSelector(projectId), { userId: "board-user" }),
      ).rejects.toMatchObject({ status: 422, details: { code: "summarizer_not_configured" } });
    });

    it("creates a summarizer task, links it, and marks the slot generating", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const otherProjectId = await seedProject();
      const summarizerAgentId = await seedSummarizer();
      const svc = summarySlotService(db);

      await db.insert(issues).values([
        {
          projectId,
          identifier: `${issuePrefix(companyId)}-101`,
          issueNumber: 101,
          title: "Waiting on board approval",
          status: "blocked",
          priority: "high",
        },
        {
          projectId,
          identifier: `${issuePrefix(companyId)}-102`,
          issueNumber: 102,
          title: "Implement summary cards",
          status: "in_progress",
          priority: "medium",
        },
        {
          projectId,
          identifier: `${issuePrefix(companyId)}-103`,
          issueNumber: 103,
          title: "Ship the previous summary",
          status: "done",
          priority: "low",
        },
        {
          projectId: otherProjectId,
          identifier: `${issuePrefix(companyId)}-104`,
          issueNumber: 104,
          title: "Other project issue",
          status: "blocked",
          priority: "critical",
        },
      ]);

      const result = await svc.generate(projectSelector(projectId), { userId: "board-user" });

      expect(result.alreadyGenerating).toBe(false);
      expect(result.slot.status).toBe("generating");
      expect(result.slot.generatingIssueId).toBe(result.generatingIssue.id);

      const issueRow = await db
        .select()
        .from(issues)
        .where(eq(issues.id, result.generatingIssue.id))
        .then((rows) => rows[0]!);
      expect(issueRow.assigneeAgentId).toBe(summarizerAgentId);
      expect(issueRow.title).toMatch(/^Summarize project on \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
      expect(issueRow.hiddenAt).toBeInstanceOf(Date);
      expect(issueRow.description).toContain(
        '"generationIssueId": "' + result.generatingIssue.id + '"',
      );
      expect(issueRow.description).toContain("Call `/summarize-status`");
      expect(issueRow.description).not.toContain("Follow the Summarizer skill");
      expect(issueRow.description).toContain(
        `GET /api/summary-slots/project/header?scopeId=${projectId}`,
      );
      expect(issueRow.description).not.toContain(
        "do not call the revisions or issues-list endpoints",
      );
      expect(issueRow.description).toContain(
        `PUT /api/summary-slots/project/header`,
      );
      expect(issueRow.description).toContain(
        "opens with the 1–3 specific, concrete, actionable items",
      );
      expect(issueRow.description).toContain("unblock this work");
      expect(issueRow.description).toContain(
        "read whatever issues you need to understand the state",
      );
      expect(issueRow.description).toContain(
        "a reader who has not memorized issue ids or threads",
      );
      expect(issueRow.description).toContain(
        "a trailing list of issue links or any link dump",
      );
      expect(issueRow.description).toContain("Not a task list");
      expect(issueRow.description).toContain(
        "first plain-text `STATUS:` line immediately",
      );
      expect(issueRow.description).toContain("sentinel-wrapped summary draft");
      expect(issueRow.description).toContain("## Prebuilt scope snapshot");
      expect(issueRow.description).toContain("### Blocked");
      expect(issueRow.description).toContain("Waiting on board approval");
      expect(issueRow.description).toContain("### In progress");
      expect(issueRow.description).toContain("Implement summary cards");
      expect(issueRow.description).toContain("### Recently done");
      expect(issueRow.description).toContain("Ship the previous summary");
      expect(issueRow.description).toContain("](/issues/");
      expect(issueRow.description).not.toContain("Other project issue");
    });

    it("keeps summaries and snapshots isolated between execution workspaces", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const projectWorkspaceId = await seedProjectWorkspace(projectId);
      const firstExecutionWorkspaceId = await seedExecutionWorkspace(projectId, projectWorkspaceId);
      const secondExecutionWorkspaceId = await seedExecutionWorkspace(projectId, projectWorkspaceId);
      await seedSummarizer();
      const svc = summarySlotService(db);

      await db.insert(issues).values([
        {
          projectId,
          projectWorkspaceId,
          executionWorkspaceId: firstExecutionWorkspaceId,
          identifier: `${issuePrefix(companyId)}-201`,
          issueNumber: 201,
          title: "First workspace task",
          status: "in_progress",
          priority: "medium",
        },
        {
          projectId,
          projectWorkspaceId,
          executionWorkspaceId: secondExecutionWorkspaceId,
          identifier: `${issuePrefix(companyId)}-202`,
          issueNumber: 202,
          title: "Second workspace task",
          status: "blocked",
          priority: "high",
        },
      ]);

      const firstSelector = executionWorkspaceSelector(firstExecutionWorkspaceId);
      const secondSelector = executionWorkspaceSelector(secondExecutionWorkspaceId);
      const generated = await svc.generate(firstSelector, { userId: "board-user" });

      expect(generated.slot).toMatchObject({
        scopeKind: "execution_workspace",
        scopeId: firstExecutionWorkspaceId,
        status: "generating",
      });
      const generationIssue = await db
        .select()
        .from(issues)
        .where(eq(issues.id, generated.generatingIssue.id))
        .then((rows) => rows[0]!);
      expect(generationIssue.description).toContain("First workspace task");
      expect(generationIssue.description).not.toContain("Second workspace task");
      expect(generationIssue.description).toContain('"scopeKind": "execution_workspace"');
      expect(generationIssue.description).toContain(`"scopeId": "${firstExecutionWorkspaceId}"`);
      await expect(svc.getSlot(secondSelector)).resolves.toEqual({
        slot: null,
        document: null,
        generatingIssue: null,
      });
    });

    it("dedupes concurrent generate clicks without creating an orphan task", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      await seedSummarizer();
      const svc = summarySlotService(db);

      const [first, second] = await Promise.all([
        svc.generate(projectSelector(projectId), { userId: "board-user" }),
        svc.generate(projectSelector(projectId), { userId: "board-user" }),
      ]);

      expect(second.generatingIssue.id).toBe(first.generatingIssue.id);
      expect([first.alreadyGenerating, second.alreadyGenerating].sort()).toEqual([false, true]);

      const issueRows = await db.select().from(issues);
      expect(issueRows).toHaveLength(1);
    });

    it("creates a fresh task once the previous generation task is terminal", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      await seedSummarizer();
      const svc = summarySlotService(db);

      const first = await svc.generate(projectSelector(projectId), { userId: "board-user" });
      await issueService(db).update(first.generatingIssue.id, { status: "done" });

      const failed = await svc.getSlot(projectSelector(projectId));
      expect(failed.slot).toMatchObject({
        status: "failed",
        generatingIssueId: first.generatingIssue.id,
        failureReason: expect.stringContaining("finished without writing a summary"),
      });

      const second = await svc.generate(projectSelector(projectId), { userId: "board-user" });
      expect(second.alreadyGenerating).toBe(false);
      expect(second.generatingIssue.id).not.toBe(first.generatingIssue.id);
      expect(second.slot).toMatchObject({
        status: "generating",
        failureReason: null,
        generatingIssueId: second.generatingIssue.id,
      });

      const issueRows = await db.select().from(issues);
      expect(issueRows).toHaveLength(2);
    });

    it("marks the slot failed when its generation task is cancelled without a write", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      await seedSummarizer();
      const svc = summarySlotService(db);

      const generated = await svc.generate(projectSelector(projectId), { userId: "board-user" });
      await issueService(db).update(generated.generatingIssue.id, { status: "cancelled" });

      const result = await svc.getSlot(projectSelector(projectId));
      expect(result.slot).toMatchObject({
        status: "failed",
        generatingIssueId: generated.generatingIssue.id,
        failureReason: expect.stringContaining("was cancelled before writing a summary"),
      });
    });
  });

  describe("summarizer writes", () => {
    async function startGeneration(projectId: string, summarizerAgentId: string) {
      const svc = summarySlotService(db);
      const generated = await svc.generate(projectSelector(projectId), { userId: "board-user" });
      const runId = await seedRun(summarizerAgentId);
      // Simulate the summarizer run checking out its linked generation task.
      await db.update(issues).set({ checkoutRunId: runId }).where(eq(issues.id, generated.generatingIssue.id));
      return { svc, generationIssueId: generated.generatingIssue.id, runId };
    }

    it("writes a board-readable revision, preserves the previous revision, and clears the generating state", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const summarizerAgentId = await seedSummarizer();
      const { svc, generationIssueId, runId } = await startGeneration(projectId, summarizerAgentId);

      const initial = await svc.write(
        {
          ...projectSelector(projectId),
          markdown:
            "Quiet scope — nothing is in flight and nothing is waiting on you. First summary for this scope.\n\n**Next:** nothing needs a decision from you right now; the next thing worth watching is the first issue landing here.",
          model: "cheap-model",
          generationIssueId,
        },
        { agentId: summarizerAgentId, runId },
      );

      const nextGeneration = await svc.generate(projectSelector(projectId), {
        userId: "board-user",
      });
      const nextRunId = await seedRun(summarizerAgentId);
      await db
        .update(issues)
        .set({ checkoutRunId: nextRunId })
        .where(eq(issues.id, nextGeneration.generatingIssue.id));
      const written = await svc.write(
        {
          ...projectSelector(projectId),
          markdown:
            "**Decide:**\n- The change is done and the review is sitting with you — [T-123](/T/issues/T-123). **I suggest:** approve it, the tests are green.\n\nNothing else moved since last time.",
          baseRevisionId: initial.revision.id,
          generationIssueId: nextGeneration.generatingIssue.id,
          model: "cheap-model",
        },
        { agentId: summarizerAgentId, runId: nextRunId },
      );

      expect(written.revision.revisionNumber).toBe(2);
      expect(written.document.body).toMatch(/^\*\*Decide:\*\*[\s\S]*\*\*I suggest:\*\*/m);
      expect(written.document.body).not.toMatch(/^Issues: /m);
      expect(written.slot.status).toBe("idle");
      expect(written.slot.generatingIssueId).toBeNull();
      expect(written.slot.documentId).toBe(written.document.id);
      expect(written.slot.lastGeneratedByAgentId).toBe(summarizerAgentId);
      expect(written.slot.lastModel).toBe("cheap-model");

      const revisions = await svc.listRevisions(projectSelector(projectId));
      expect(revisions.revisions).toHaveLength(2);
      expect(revisions.revisions[0]!.id).toBe(written.revision.id);
      expect(revisions.revisions[1]!.id).toBe(initial.revision.id);
      expect(revisions.revisions[1]!.body).toContain("First summary for this scope.");
    });

    it("returns only the 20 most recent summary revisions", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const summarizerAgentId = await seedSummarizer();
      const { svc, generationIssueId, runId } = await startGeneration(projectId, summarizerAgentId);
      const written = await svc.write(
        { ...projectSelector(projectId), markdown: "# Summary v1", generationIssueId },
        { agentId: summarizerAgentId, runId },
      );

      await db.insert(documentRevisions).values(
        Array.from({ length: 24 }, (_, index) => ({
          documentId: written.document.id,
          revisionNumber: index + 2,
          body: `# Summary v${index + 2}`,
        })),
      );

      const revisions = await svc.listRevisions(projectSelector(projectId));
      expect(revisions.revisions).toHaveLength(20);
      expect(revisions.revisions[0]!.revisionNumber).toBe(25);
      expect(revisions.revisions.at(-1)!.revisionNumber).toBe(6);
    });

    it("appends further revisions and enforces optimistic baseRevisionId", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const summarizerAgentId = await seedSummarizer();
      const { svc, generationIssueId, runId } = await startGeneration(projectId, summarizerAgentId);

      const first = await svc.write(
        { ...projectSelector(projectId), markdown: "# Summary v1", generationIssueId },
        { agentId: summarizerAgentId, runId },
      );

      // A stale baseRevisionId must be rejected.
      const second = await summarySlotService(db).generate(projectSelector(projectId), {
        userId: "board-user",
      });
      const runId2 = await seedRun(summarizerAgentId);
      await db.update(issues).set({ checkoutRunId: runId2 }).where(eq(issues.id, second.generatingIssue.id));

      await expect(
        svc.write(
          {
            ...projectSelector(projectId),
            markdown: "# Summary v2",
            baseRevisionId: randomUUID(),
            generationIssueId: second.generatingIssue.id,
          },
          { agentId: summarizerAgentId, runId: runId2 },
        ),
      ).rejects.toMatchObject({ status: 409 });

      const ok = await svc.write(
        {
          ...projectSelector(projectId),
          markdown: "# Summary v2",
          baseRevisionId: first.revision.id,
          generationIssueId: second.generatingIssue.id,
        },
        { agentId: summarizerAgentId, runId: runId2 },
      );
      expect(ok.revision.revisionNumber).toBe(2);
    });

    it("rejects writes from a non-Summarizer agent", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const summarizerAgentId = await seedSummarizer();
      const plainAgentId = await seedPlainAgent();
      const { svc, runId } = await startGeneration(projectId, summarizerAgentId);

      await expect(
        svc.write(
          { ...projectSelector(projectId), markdown: "# Sneaky" },
          { agentId: plainAgentId, runId },
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("rejects Summarizer writes that do not run from the linked generation task", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const summarizerAgentId = await seedSummarizer();
      const { generationIssueId } = await startGeneration(projectId, summarizerAgentId);
      const svc = summarySlotService(db);

      await expect(
        svc.write(
          { ...projectSelector(projectId), markdown: "# Wrong run", generationIssueId },
          { agentId: summarizerAgentId, runId: randomUUID() },
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("rejects using one generation task to write a different slot", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const otherProjectId = await seedProject();
      const summarizerAgentId = await seedSummarizer();
      const { svc, generationIssueId, runId } = await startGeneration(projectId, summarizerAgentId);

      await expect(
        svc.write(
          { ...projectSelector(otherProjectId), markdown: "# Wrong slot", generationIssueId },
          { agentId: summarizerAgentId, runId },
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("rejects writes when there is no active generation", async () => {
      const companyId = await seedCompany();
      const projectId = await seedProject();
      const summarizerAgentId = await seedSummarizer();
      const svc = summarySlotService(db);

      await expect(
        svc.write(
          { ...projectSelector(projectId), markdown: "# No generation" },
          { agentId: summarizerAgentId, runId: randomUUID() },
        ),
      ).rejects.toMatchObject({ status: 403 });
    });
  });
});
