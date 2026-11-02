import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  createDb,
  documents,
  issueComments,
  issueDocuments,
  issueLabels,
  issues,
  labels,
  projects,
} from "@paperclipai/db";
import { companySearchQuerySchema, COMPANY_SEARCH_MAX_QUERY_LENGTH } from "@paperclipai/shared";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import {
  COMPANY_SEARCH_BRANCH_FETCH_LIMIT,
  companySearchBranchFetchLimit,
  companySearchService,
} from "../services/company-search.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres company search tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describe("company search query validation", () => {
  it("truncates long text queries but rejects invalid filters, sort, and pagination", () => {
    const parsed = companySearchQuerySchema.parse({
      q: "x".repeat(COMPANY_SEARCH_MAX_QUERY_LENGTH + 50),
      limit: "50",
      offset: "200",
      scope: "all",
      status: "todo,blocked",
      priority: ["critical", "low"],
      sort: "priority",
      updatedWithin: "7d",
    });

    expect(parsed.q).toHaveLength(COMPANY_SEARCH_MAX_QUERY_LENGTH);
    expect(parsed.status).toEqual(["todo", "blocked"]);
    expect(parsed.priority).toEqual(["critical", "low"]);
    expect(parsed.sort).toBe("priority");
    expect(parsed.updatedWithin).toBe("7d");
    expect(() => companySearchQuerySchema.parse({ q: "needle", limit: "500" })).toThrow();
    expect(() => companySearchQuerySchema.parse({ q: "needle", offset: "9000" })).toThrow();
    expect(() => companySearchQuerySchema.parse({ q: "needle", scope: "not-a-scope" })).toThrow();
    expect(() => companySearchQuerySchema.parse({ q: "needle", status: "not-a-status" })).toThrow();
    expect(() => companySearchQuerySchema.parse({ q: "needle", priority: "urgent" })).toThrow();
    expect(() => companySearchQuerySchema.parse({ q: "needle", sort: "oldest" })).toThrow();
    expect(() => companySearchQuerySchema.parse({ q: "needle", updatedWithin: "forever" })).toThrow();
    expect(() => companySearchQuerySchema.parse({ q: "needle", projectId: "not-a-uuid" })).toThrow();
  });

  it("includes offset in the internal per-branch fetch window", () => {
    const lowOffset = companySearchQuerySchema.parse({ q: "needle", limit: "50", offset: "0" });
    const highOffset = companySearchQuerySchema.parse({ q: "needle", limit: "50", offset: "200" });

    expect(companySearchBranchFetchLimit(lowOffset.limit, lowOffset.offset)).toBe(51);
    expect(companySearchBranchFetchLimit(highOffset.limit, highOffset.offset)).toBe(COMPANY_SEARCH_BRANCH_FETCH_LIMIT);
  });
});

describeEmbeddedPostgres("companySearchService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof companySearchService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-company-search-");
    db = createDb(tempDb.connectionString);
    svc = companySearchService(db);
    await db.execute(sql.raw("CREATE EXTENSION IF NOT EXISTS pg_trgm"));
  }, 20_000);

  afterEach(async () => {
    await db.delete(issueDocuments);
    await db.delete(documents);
    await db.delete(issueComments);
    await db.delete(issueLabels);
    await db.delete(issues);
    await db.delete(labels);
    await db.delete(projects);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function createCompany(name = "Paperclip") {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name,
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    return companyId;
  }

  async function createIssue(values: Partial<typeof issues.$inferInsert> = {}) {
    const id = values.id ?? randomUUID();
    await db.insert(issues).values({
      id,
      title: values.title ?? "Search target",
      description: values.description ?? null,
      status: values.status ?? "todo",
      priority: values.priority ?? "medium",
      identifier: values.identifier ?? null,
      hiddenAt: values.hiddenAt ?? null,
      ...values,
    });
    return id;
  }

  async function createAgent(values: Partial<typeof agents.$inferInsert> = {}) {
    const id = values.id ?? randomUUID();
    await db.insert(agents).values({
      id,
      name: values.name ?? "Search agent",
      role: values.role ?? "engineer",
      title: values.title ?? null,
      capabilities: values.capabilities ?? null,
      ...values,
    });
    return id;
  }

  async function createProject(values: Partial<typeof projects.$inferInsert> = {}) {
    const id = values.id ?? randomUUID();
    await db.insert(projects).values({
      id,
      name: values.name ?? "Search project",
      description: values.description ?? null,
      ...values,
    });
    return id;
  }

  async function createLabel(values: Partial<typeof labels.$inferInsert> = {}) {
    const id = values.id ?? randomUUID();
    await db.insert(labels).values({
      id,
      name: values.name ?? "Search label",
      color: values.color ?? "blue",
      ...values,
    });
    return id;
  }

  it("keeps exact entity names ahead of speculative task typos and rejects empty quotes", async () => {
    const companyId = await createCompany();
    const agentId = await createAgent({ name: "Mibile" });
    const projectId = await createProject({ name: "Mibile" });
    const taskId = await createIssue({ title: "Mobile navigation" });
    const result = await svc.search(companySearchQuerySchema.parse({ q: "mibile" }));
    const ids = result.results.map((row) => row.id);
    expect(ids).toContain(taskId);
    expect(ids.indexOf(agentId)).toBeLessThan(ids.indexOf(taskId));
    expect(ids.indexOf(projectId)).toBeLessThan(ids.indexOf(taskId));
    expect((await svc.search(companySearchQuerySchema.parse({ q: '""' }))).results).toEqual([]);
  });

  it("ranks exact issue identifiers before weaker title matches", async () => {
    const companyId = await createCompany();
    const exactId = await createIssue({
      identifier: "TST-42",
      title: "Backend endpoint",
    });
    await createIssue({
      identifier: "TST-43",
      title: "TST-42 mentioned in title only",
    });

    const result = await svc.search(companySearchQuerySchema.parse({ q: "TST-42" }));

    expect(result.results[0]?.id).toBe(exactId);
    expect(result.results[0]?.matchedFields).toContain("identifier");
  });

  it("ranks phrase before reordered title words and rejects partial matches", async () => {
    const companyId = await createCompany();
    const base = new Date("2026-01-01T00:00:00.000Z").getTime();
    const partialTokenId = await createIssue({
      identifier: "TST-50",
      title: "Alpha-only deployment",
      updatedAt: new Date(base + 3_000),
    });
    const allTokenId = await createIssue({
      identifier: "TST-51",
      title: "Alpha rollout beta",
      updatedAt: new Date(base + 2_000),
    });
    const phraseId = await createIssue({
      identifier: "TST-52",
      title: "Alpha beta deployment",
      updatedAt: new Date(base + 1_000),
    });

    const result = await svc.search(companySearchQuerySchema.parse({ q: "alpha beta", scope: "issues" }));

    expect(result.results.map((row) => row.id)).toEqual([phraseId, allTokenId]);
    expect(result.results.map((row) => row.id)).not.toContain(partialTokenId);
  });

  it("matches multiple tokens across the same issue thread and returns comment snippets", async () => {
    const companyId = await createCompany();
    const issueId = await createIssue({
      identifier: "TST-7",
      title: "Checkout semantics",
      description: "Atomic ownership is enforced here.",
    });
    const commentId = randomUUID();
    await db.insert(issueComments).values({
      id: commentId,
      issueId,
      body: "The ranking snippet should explain why this thread matched.",
    });

    const result = await svc.search(companySearchQuerySchema.parse({ q: "checkout snippet" }));
    const match = result.results.find((item) => item.id === issueId);

    expect(match).toBeTruthy();
    expect(match?.matchedFields).toEqual(expect.arrayContaining(["title", "comment"]));
    expect(match?.href).toContain(`#comment-${commentId}`);
    expect(match?.snippets.some((snippet) => snippet.field === "comment" && /snippet/i.test(snippet.text))).toBe(true);
    expect(match?.snippets.find((snippet) => snippet.field === "comment")?.highlights.length).toBeGreaterThan(0);
    expect(result.countsByType.comment).toBe(1);
  });

  it("searches issue documents and returns document metadata for snippets", async () => {
    const companyId = await createCompany();
    const issueId = await createIssue({
      identifier: "TST-8",
      title: "Adapter manager",
    });
    const documentId = randomUUID();
    await db.insert(documents).values({
      id: documentId,
      title: "Hermes Parser Plan",
      latestBody: "The external adapter parser should be discovered from the plugin package.",
      format: "markdown",
    });
    await db.insert(issueDocuments).values({
      issueId,
      documentId,
      key: "plan",
    });

    const result = await svc.search(companySearchQuerySchema.parse({ q: "Hermes parser", scope: "documents" }));

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.id).toBe(issueId);
    expect(result.results[0]?.matchedFields).toContain("document");
    expect(result.results[0]?.href).toContain("#document-plan");
    expect(result.results[0]?.snippet).toMatch(/parser/i);
    expect(result.results[0]?.snippets[0]).toMatchObject({ field: "document", label: "Hermes Parser Plan" });
    expect(result.results[0]?.snippets[0]?.highlights.length).toBeGreaterThan(0);
    expect(result.countsByType.document).toBe(1);
  });

  it("searches artifact projections through the artifacts scope", async () => {
    const companyId = await createCompany();
    const agentId = await createAgent({ name: "Artifact Writer" });
    const issueId = await createIssue({
      identifier: "TST-88",
      title: "Produce artifact",
    });
    const documentId = randomUUID();
    await db.insert(documents).values({
      id: documentId,
      title: "Launch Artifact Brief",
      latestBody: "The searchable artifact body mentions a comet-tail preview.",
      format: "markdown",
      createdByAgentId: agentId,
    });
    await db.insert(issueDocuments).values({
      issueId,
      documentId,
      key: "brief",
    });

    const result = await svc.search(companySearchQuerySchema.parse({ q: "comet-tail", scope: "artifacts" }));

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      type: "artifact",
      title: "Launch Artifact Brief",
      href: expect.stringContaining("#document-brief"),
      artifact: expect.objectContaining({
        mediaKind: "document",
        issueIdentifier: "TST-88",
      }),
    });
    expect(result.results[0]?.snippet).toMatch(/comet tail/i);
    expect(result.countsByType).toEqual({ issue: 0, comment: 0, document: 0, artifact: 1, agent: 0, project: 0 });
  });

  it("does not pass high-offset search fetch windows through to artifact query validation", async () => {
    const companyId = await createCompany();

    const result = await svc.search(companySearchQuerySchema.parse({
      q: "artifact",
      scope: "artifacts",
      limit: "50",
      offset: "75",
    }));

    expect(result.results).toEqual([]);
    expect(result.countsByType.artifact).toBe(0);
  });

  it("applies issue filters before sorting and pagination", async () => {
    const companyId = await createCompany();
    const agentId = await createAgent({ name: "Needle engineer" });
    const projectId = await createProject({ name: "Needle project" });
    const labelId = await createLabel({ name: "Needle label" });
    const base = new Date("2026-01-01T00:00:00.000Z").getTime();
    const newestMatch = await createIssue({
      identifier: "TST-30",
      title: "Needle newest",
      status: "todo",
      priority: "high",
      assigneeAgentId: agentId,
      projectId,
      updatedAt: new Date(base + 3_000),
    });
    const olderMatch = await createIssue({
      identifier: "TST-31",
      title: "Needle older",
      status: "todo",
      priority: "high",
      assigneeAgentId: agentId,
      projectId,
      updatedAt: new Date(base + 2_000),
    });
    const statusDecoy = await createIssue({
      identifier: "TST-32",
      title: "Needle done",
      status: "done",
      priority: "high",
      assigneeAgentId: agentId,
      projectId,
      updatedAt: new Date(base + 4_000),
    });
    await db.insert(issueLabels).values([
      { issueId: newestMatch, labelId },
      { issueId: olderMatch, labelId },
      { issueId: statusDecoy, labelId },
    ]);

    const result = await svc.search(companySearchQuerySchema.parse({
      q: "needle",
      status: "todo",
      priority: "high",
      assigneeAgentId: agentId,
      projectId,
      labelId,
      updatedAfter: new Date(base + 1_000).toISOString(),
      sort: "updated",
      limit: "1",
      offset: "1",
    }));

    expect(result.results.map((row) => row.id)).toEqual([olderMatch]);
    expect(result.countsByType.issue).toBe(2);
    expect(result.countsByType.agent).toBe(0);
    expect(result.countsByType.project).toBe(0);
    expect(result.filterOptionCounts.status.todo).toBe(2);
    expect(result.filterOptionCounts.status.done).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("returns issue rows for filter-only searches", async () => {
    const companyId = await createCompany();
    const agentId = await createAgent({ name: "Filter owner" });
    const matchingIssue = await createIssue({
      identifier: "TST-34",
      title: "Filtered task",
      status: "todo",
      assigneeAgentId: agentId,
    });
    await createIssue({
      identifier: "TST-35",
      title: "Filtered decoy",
      status: "done",
      assigneeAgentId: agentId,
    });
    await createAgent({ name: "Todo" });
    await createProject({ name: "Todo" });

    const result = await svc.search(companySearchQuerySchema.parse({
      q: "",
      status: "todo",
      assigneeAgentId: agentId,
    }));

    expect(result.results.map((row) => row.id)).toEqual([matchingIssue]);
    expect(result.countsByType.issue).toBe(1);
    expect(result.countsByType.agent).toBe(0);
    expect(result.countsByType.project).toBe(0);
    expect(result.results[0]?.snippets).toEqual([]);
  });

  it("returns zero-result loosen data and suppresses agent/project rows while issue filters are active", async () => {
    const companyId = await createCompany();
    await createAgent({ name: "Needle agent", capabilities: "Needle capabilities" });
    await createProject({ name: "Needle project", description: "Needle roadmap" });

    const result = await svc.search(companySearchQuerySchema.parse({ q: "needle", status: "todo" }));

    expect(result.results).toEqual([]);
    expect(result.countsByType.agent).toBe(0);
    expect(result.countsByType.project).toBe(0);
    expect(result.zeroResults).toMatchObject({
      unfilteredTotal: 2,
      loosenSuggestions: [
        { filter: "status", values: ["todo"], resultCount: 2, additionalCount: 2 },
      ],
    });
  });

  it("does not leak hidden issue-backed artifacts", async () => {
    const companyId = await createCompany();
    const agentId = await createAgent({ name: "Artifact Writer" });
    const visibleIssueId = await createIssue({
      identifier: "TST-33",
      title: "Visible artifact holder",
    });
    const hiddenIssueId = await createIssue({
      identifier: "TST-34",
      title: "Hidden artifact holder",
      hiddenAt: new Date(),
    });
    const visibleDocumentId = randomUUID();
    const hiddenDocumentId = randomUUID();
    await db.insert(documents).values([
      {
        id: visibleDocumentId,
        title: "Visible Artifact",
        latestBody: "Searchable artifact body",
        format: "markdown",
        createdByAgentId: agentId,
      },
      {
        id: hiddenDocumentId,
        title: "Hidden Artifact",
        latestBody: "Searchable artifact body",
        format: "markdown",
        createdByAgentId: agentId,
      },
    ]);
    await db.insert(issueDocuments).values([
      { issueId: visibleIssueId, documentId: visibleDocumentId, key: "visible" },
      { issueId: hiddenIssueId, documentId: hiddenDocumentId, key: "hidden" },
    ]);

    const result = await svc.search(companySearchQuerySchema.parse({ q: "artifact", scope: "artifacts" }));

    expect(result.results.map((row) => row.artifact?.issueId)).toEqual([visibleIssueId]);
    expect(result.countsByType.artifact).toBe(1);
  });

  it("excludes hidden and harness issues", async () => {
    await createCompany("Visible Co");
    const visibleId = await createIssue({
      identifier: "VIS-1",
      title: "Visible needle",
    });
    await createIssue({
      identifier: "HID-1",
      title: "Hidden needle",
      hiddenAt: new Date(),
    });
    await createIssue({
      identifier: "HAR-1",
      title: "Harness needle",
      harnessKind: "skill_test",
    });

    const result = await svc.search(companySearchQuerySchema.parse({ q: "needle" }));

    expect(result.results.map((item) => item.id)).toEqual([visibleId]);
  });

  it("treats bare SQL wildcard characters as literals instead of match-all queries", async () => {
    const companyId = await createCompany();
    const issueId = await createIssue({
      identifier: "TST-20",
      title: "Plain issue target",
      description: "Plain issue description",
    });
    await db.insert(issueComments).values({
      issueId,
      body: "Plain comment body",
    });
    const documentId = randomUUID();
    await db.insert(documents).values({
      id: documentId,
      title: "Plain document",
      latestBody: "Plain document body",
      format: "markdown",
    });
    await db.insert(issueDocuments).values({
      issueId,
      documentId,
      key: "plain",
    });
    await createAgent({
      name: "Plain Agent",
      role: "engineer",
      capabilities: "Plain agent capabilities",
    });
    await createProject({
      name: "Plain Project",
      description: "Plain project description",
    });

    for (const q of ["%", "_", "\\"]) {
      const result = await svc.search(companySearchQuerySchema.parse({ q }));
      expect(result.results, `q=${q}`).toEqual([]);
    }
  });

  it("matches percent characters literally across issue, comment, document, agent, and project results", async () => {
    const companyId = await createCompany();
    const issueMatchId = await createIssue({
      identifier: "TST-21",
      title: "Release 100% checklist",
    });
    const issueDecoyId = await createIssue({
      identifier: "TST-22",
      title: "Release 1000 checklist",
    });
    const commentMatchId = await createIssue({
      identifier: "TST-23",
      title: "Comment literal holder",
    });
    const commentDecoyId = await createIssue({
      identifier: "TST-24",
      title: "Comment decoy holder",
    });
    await db.insert(issueComments).values([
      {
        issueId: commentMatchId,
        body: "QA is 100% confident in this result.",
      },
      {
        issueId: commentDecoyId,
        body: "QA is 1000 confident in this result.",
      },
    ]);
    const documentMatchIssueId = await createIssue({
      identifier: "TST-25",
      title: "Document literal holder",
    });
    const documentDecoyIssueId = await createIssue({
      identifier: "TST-26",
      title: "Document decoy holder",
    });
    const documentMatchId = randomUUID();
    const documentDecoyId = randomUUID();
    await db.insert(documents).values([
      {
        id: documentMatchId,
        title: "Literal rollout",
        latestBody: "Ship 100% complete adapter support.",
        format: "markdown",
      },
      {
        id: documentDecoyId,
        title: "Decoy rollout",
        latestBody: "Ship 1000 complete adapter support.",
        format: "markdown",
      },
    ]);
    await db.insert(issueDocuments).values([
      {
        issueId: documentMatchIssueId,
        documentId: documentMatchId,
        key: "literal",
      },
      {
        issueId: documentDecoyIssueId,
        documentId: documentDecoyId,
        key: "decoy",
      },
    ]);
    const agentMatchId = await createAgent({
      name: "100% Specialist",
      role: "engineer",
    });
    const agentDecoyId = await createAgent({
      name: "1000 Specialist",
      role: "engineer",
    });
    const projectMatchId = await createProject({
      name: "100% Launch Plan",
    });
    const projectDecoyId = await createProject({
      name: "1000 Launch Plan",
    });

    const result = await svc.search(companySearchQuerySchema.parse({ q: "100%" }));
    const ids = result.results.map((row) => row.id);

    expect(ids).toEqual(expect.arrayContaining([
      issueMatchId,
      commentMatchId,
      documentMatchIssueId,
      agentMatchId,
      projectMatchId,
    ]));
    expect(ids).not.toEqual(expect.arrayContaining([
      issueDecoyId,
      commentDecoyId,
      documentDecoyIssueId,
      agentDecoyId,
      projectDecoyId,
    ]));
  });

  it("applies offset after merging cross-type result ranking", async () => {
    const companyId = await createCompany();
    const base = new Date("2026-01-01T00:00:00.000Z").getTime();
    const agentIds = await Promise.all([
      createAgent({ name: "Needle agent 1", updatedAt: new Date(base + 6_000) }),
      createAgent({ name: "Needle agent 2", updatedAt: new Date(base + 5_000) }),
      createAgent({ name: "Needle agent 3", updatedAt: new Date(base + 4_000) }),
    ]);
    const projectIds = await Promise.all([
      createProject({ name: "Needle project 1", updatedAt: new Date(base + 3_000) }),
      createProject({ name: "Needle project 2", updatedAt: new Date(base + 2_000) }),
      createProject({ name: "Needle project 3", updatedAt: new Date(base + 1_000) }),
    ]);

    const result = await svc.search(companySearchQuerySchema.parse({ q: "needle", limit: "2", offset: "2" }));

    expect(result.results.map((row) => row.id)).toEqual([agentIds[2], projectIds[0]]);
    expect(result.countsByType).toEqual({ issue: 0, comment: 0, document: 0, artifact: 0, agent: 3, project: 3 });
    expect(result.hasMore).toBe(true);
  });

  it("escapes underscore and backslash characters in issue phrase and token patterns", async () => {
    const companyId = await createCompany();
    const literalId = await createIssue({
      identifier: "TST-27",
      title: "Literal foo_bar path c:\\tmp",
    });
    const decoyId = await createIssue({
      identifier: "TST-28",
      title: "Decoy fooXbar path c:tmp",
    });

    for (const q of ["foo_bar", "c:\\tmp"]) {
      const result = await svc.search(companySearchQuerySchema.parse({ q, scope: "issues" }));
      const ids = result.results.map((row) => row.id);
      expect(ids, `q=${q}`).toContain(literalId);
      expect(ids, `q=${q}`).not.toContain(decoyId);
    }
  });

  it("does not interpret short UI terms as the middle of unrelated words", async () => {
    const companyId = await createCompany();
    const target = await createIssue({ title: "Improve mobile UI" });
    await createIssue({ title: "Build billing reports" });
    const result = await svc.search(companySearchQuerySchema.parse({ q: "UI" }));
    expect(result.results.map((row) => row.id)).toEqual([target]);
  });

  it("keeps typo fallback inside the requested filters", async () => {
    const companyId = await createCompany();
    await createIssue({ title: "Mibile API", status: "done" });
    const target = await createIssue({ title: "Mobile API", status: "todo" });
    const result = await svc.search(companySearchQuerySchema.parse({ q: "mibile api", status: "todo" }));
    expect(result.results.map((row) => row.id)).toEqual([target]);
  });

  it("keeps exact title hits on the task and chooses the most complete context evidence", async () => {
    const companyId = await createCompany();
    const task = await createIssue({ title: "Aurora callback" });
    await db.insert(issueComments).values({ issueId: task, body: "Aurora callback is mentioned here too." });
    const exact = await svc.search(companySearchQuerySchema.parse({ q: "Aurora callback" }));
    expect(exact.results[0]?.href).not.toContain("#comment-");

    const holder = await createIssue({ title: "Connection investigation" });
    await db.insert(issueComments).values({ issueId: holder, body: "Aurora was discussed.", updatedAt: new Date("2026-06-01") });
    const strongest = randomUUID();
    await db.insert(issueComments).values({ id: strongest, issueId: holder,
      body: "Aurora loses the callback state.", updatedAt: new Date("2026-01-01") });
    const result = await svc.search(companySearchQuerySchema.parse({ q: "aurora state callback" }));
    expect(result.results[0]?.href).toContain(`#comment-${strongest}`);
    expect(result.results[0]?.snippet).toContain("state");
  });

  it.each(["comment", "document"] as const)("preserves %s evidence when title and identifier both match", async (source) => {
    const companyId = await createCompany();
    const task = await createIssue({
      identifier: "CTX-123", title: "CTX callback investigation", description: "CTX callback details",
    });
    const sourceId = randomUUID();
    if (source === "comment") {
      await db.insert(issueComments).values({ id: sourceId, issueId: task, body: "The missing signal is quasar." });
    } else {
      await db.insert(documents).values({ id: sourceId, title: "Investigation plan", latestBody: "The missing signal is quasar.", format: "markdown" });
      await db.insert(issueDocuments).values({ issueId: task, documentId: sourceId, key: "plan" });
    }

    const result = await svc.search(companySearchQuerySchema.parse({ q: "CTX quasar" }));
    const match = result.results.find((row) => row.id === task)!;
    expect(match.matchedFields).toEqual(expect.arrayContaining(["identifier", "title", source]));
    expect(match.score).toBeGreaterThanOrEqual(2000);
    expect(match.score).toBeLessThan(3000);
    expect(match.snippets).toHaveLength(2);
    expect(match.snippets[0]).toMatchObject({ field: source, text: expect.stringContaining("quasar") });
    expect(match.snippet).toContain("quasar");
    expect(match.href).toContain(source === "comment" ? `#comment-${sourceId}` : "#document-plan");
  });

  it("reflects edits, deleted comments and document updates immediately", async () => {
    const companyId = await createCompany();
    const task = await createIssue({ title: "Old uniquequartz title" });
    const find = () => svc.search(companySearchQuerySchema.parse({ q: '"uniquequartz"' }));
    expect((await find()).results.map((row) => row.id)).toEqual([task]);
    await db.update(issues).set({ title: "New title" }).where(sql`${issues.id} = ${task}`);
    expect((await find()).results).toEqual([]);
    const comment = randomUUID();
    await db.insert(issueComments).values({ id: comment, issueId: task, body: "uniquequartz" });
    expect((await find()).results.map((row) => row.id)).toEqual([task]);
    await db.update(issueComments).set({ deletedAt: new Date() }).where(sql`${issueComments.id} = ${comment}`);
    expect((await find()).results).toEqual([]);
    const doc = randomUUID();
    await db.insert(documents).values({ id: doc, title: "Findings", latestBody: "uniquequartz", format: "markdown" });
    await db.insert(issueDocuments).values({ issueId: task, documentId: doc, key: "plan" });
    expect((await find()).results.map((row) => row.id)).toEqual([task]);
    await db.update(documents).set({ latestBody: "Updated findings" }).where(sql`${documents.id} = ${doc}`);
    expect((await find()).results).toEqual([]);
  });

  it("uses pg_trgm for conservative fuzzy title matches", async () => {
    const companyId = await createCompany();
    const issueId = await createIssue({
      identifier: "TST-9",
      title: "Onboarding wizard polish",
    });

    const result = await svc.search(companySearchQuerySchema.parse({ q: "onbordng wizard" }));

    expect(result.results[0]?.id).toBe(issueId);
    expect(result.results[0]?.matchedFields).toContain("title");
  });

  it("matches transposition typos against multi-word titles", async () => {
    const companyId = await createCompany();
    const searchIssueId = await createIssue({
      identifier: "TST-10",
      title: "Improve search performance",
    });
    const mobileIssueId = await createIssue({
      identifier: "TST-11",
      title: "Polish mobile navigation",
    });
    const otherIssueId = await createIssue({
      identifier: "TST-12",
      title: "Refactor billing reports",
    });

    const transpositionCases: Array<{ query: string; expectedId: string; rejected: string }> = [
      { query: "serach", expectedId: searchIssueId, rejected: otherIssueId },
      { query: "mibile", expectedId: mobileIssueId, rejected: otherIssueId },
      { query: "mobail", expectedId: mobileIssueId, rejected: otherIssueId },
    ];

    for (const { query, expectedId, rejected } of transpositionCases) {
      const result = await svc.search(companySearchQuerySchema.parse({ q: query }));
      const ids = result.results.map((row) => row.id);
      expect(ids, `query=${query}`).toContain(expectedId);
      expect(ids, `query=${query} should not match unrelated issue`).not.toContain(rejected);
    }
  });
});
