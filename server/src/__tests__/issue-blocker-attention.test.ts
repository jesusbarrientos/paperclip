import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  agentWakeupRequests,
  approvals,
  companies,
  createDb,
  heartbeatRuns,
  issueApprovals,
  issueRelations,
  issueThreadInteractions,
  issues,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { issueService } from "../services/issues.js";
import { buildIssueGraphLivenessIncidentKey } from "../services/recovery/origins.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres issue blocker attention tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("issue blocker attention", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof issueService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-issue-blocker-attention-");
    db = createDb(tempDb.connectionString);
    svc = issueService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(issueThreadInteractions);
    await db.delete(issueApprovals);
    await db.delete(approvals);
    await db.delete(activityLog);
    await db.delete(heartbeatRuns);
    await db.delete(agentWakeupRequests);
    await db.delete(issueRelations);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function createCompany(prefix = "PBA") {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const pausedAgentId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: `Company ${prefix}`,
      issuePrefix: prefix,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values([
      {
        id: agentId,
        name: `${prefix} Agent`,
        role: "engineer",
        status: "idle",
      },
      {
        id: pausedAgentId,
        name: `${prefix} Paused`,
        role: "engineer",
        status: "paused",
      },
    ]);
    return { agentId, pausedAgentId };
  }

  async function insertIssue(input: {
    id?: string;
    identifier: string;
    title: string;
    status: string;
    parentId?: string | null;
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
    originKind?: string | null;
    originId?: string | null;
    originFingerprint?: string | null;
    executionState?: Record<string, unknown> | null;
    description?: string | null;
  }) {
    const id = input.id ?? randomUUID();
    await db.insert(issues).values({
      id,
      identifier: input.identifier,
      title: input.title,
      status: input.status,
      priority: "medium",
      parentId: input.parentId ?? null,
      assigneeAgentId: input.assigneeAgentId ?? null,
      assigneeUserId: input.assigneeUserId ?? null,
      originKind: input.originKind ?? "manual",
      originId: input.originId ?? null,
      originFingerprint: input.originFingerprint ?? "default",
      executionState: input.executionState ?? null,
      description: input.description ?? null,
    });
    return id;
  }

  async function block(input: { blockerIssueId: string; blockedIssueId: string }) {
    await db.insert(issueRelations).values({
      issueId: input.blockerIssueId,
      relatedIssueId: input.blockedIssueId,
      type: "blocks",
    });
  }

  async function activeRun(input: {
    agentId: string;
    issueId: string;
    status?: string;
    current?: boolean;
    scheduledRetryAt?: Date;
  }) {
    const runId = randomUUID();
    await db.insert(heartbeatRuns).values({
      id: runId,
      agentId: input.agentId,
      status: input.status ?? "running",
      contextSnapshot: { issueId: input.issueId },
      scheduledRetryAt: input.scheduledRetryAt,
    });
    if (input.current !== false) {
      await db.update(issues).set({ executionRunId: runId }).where(eq(issues.id, input.issueId));
    }
    return runId;
  }

  it("classifies a blocked parent as covered when its child has a running execution path", async () => {
    const { agentId } = await createCompany("PBC");
    const parentId = await insertIssue({ identifier: "PBC-1", title: "Parent", status: "blocked" });
    const childId = await insertIssue({
      identifier: "PBC-2",
      title: "Running child",
      status: "todo",
      parentId,
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: childId, blockedIssueId: parentId });
    await activeRun({ agentId, issueId: childId });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "covered",
      reason: "active_child",
      unresolvedBlockerCount: 1,
      coveredBlockerCount: 1,
      attentionBlockerCount: 0,
      sampleBlockerIdentifier: "PBC-2",
    });
  });

  it("classifies an assigned backlog blocker leaf without a waiting path as attention-needed", async () => {
    const { agentId } = await createCompany("PBB");
    const parentId = await insertIssue({ identifier: "PBB-1", title: "Parent", status: "blocked" });
    const blockerId = await insertIssue({
      identifier: "PBB-2",
      title: "Parked assigned blocker",
      status: "backlog",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: blockerId, blockedIssueId: parentId });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "needs_attention",
      reason: "attention_required",
      unresolvedBlockerCount: 1,
      coveredBlockerCount: 0,
      stalledBlockerCount: 0,
      attentionBlockerCount: 1,
      sampleBlockerIdentifier: "PBB-2",
    });
  });

  it("treats a human-owned backlog blocker as a covered waiting path", async () => {
    const {} = await createCompany("PBU");
    const parentId = await insertIssue({ identifier: "PBU-1", title: "Parent", status: "blocked" });
    const blockerId = await insertIssue({
      identifier: "PBU-2",
      title: "Human-owned parked blocker",
      status: "backlog",
      assigneeUserId: "board-user-1",
    });
    await block({ blockerIssueId: blockerId, blockedIssueId: parentId });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "covered",
      reason: "active_dependency",
      unresolvedBlockerCount: 1,
      coveredBlockerCount: 1,
      attentionBlockerCount: 0,
      sampleBlockerIdentifier: "PBU-2",
    });
  });

  it("keeps mixed blockers attention-required when any path lacks active work", async () => {
    const { agentId } = await createCompany("PBM");
    const parentId = await insertIssue({ identifier: "PBM-1", title: "Parent", status: "blocked" });
    const activeChildId = await insertIssue({
      identifier: "PBM-2",
      title: "Running child",
      status: "todo",
      parentId,
      assigneeAgentId: agentId,
    });
    const idleBlockerId = await insertIssue({
      identifier: "PBM-3",
      title: "Idle blocker",
      status: "todo",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: activeChildId, blockedIssueId: parentId });
    await block({ blockerIssueId: idleBlockerId, blockedIssueId: parentId });
    await activeRun({ agentId, issueId: activeChildId });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "needs_attention",
      reason: "attention_required",
      unresolvedBlockerCount: 2,
      coveredBlockerCount: 1,
      attentionBlockerCount: 1,
      sampleBlockerIdentifier: "PBM-3",
    });
  });

  it("ignores cancelled direct children when counting unresolved blocker attention", async () => {
    const { agentId } = await createCompany("PBD");
    const parentId = await insertIssue({ identifier: "PBD-1", title: "Parent", status: "blocked" });
    const activeBlockerOneId = await insertIssue({
      identifier: "PBD-2",
      title: "Running dependency one",
      status: "todo",
      assigneeAgentId: agentId,
    });
    const activeBlockerTwoId = await insertIssue({
      identifier: "PBD-3",
      title: "Running dependency two",
      status: "todo",
      assigneeAgentId: agentId,
    });
    await insertIssue({
      identifier: "PBD-4",
      title: "Cancelled child",
      status: "cancelled",
      parentId,
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: activeBlockerOneId, blockedIssueId: parentId });
    await block({ blockerIssueId: activeBlockerTwoId, blockedIssueId: parentId });
    await activeRun({ agentId, issueId: activeBlockerOneId });
    await activeRun({ agentId, issueId: activeBlockerTwoId });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "covered",
      reason: "active_dependency",
      unresolvedBlockerCount: 2,
      coveredBlockerCount: 2,
      stalledBlockerCount: 0,
      attentionBlockerCount: 0,
    });
    expect(parent?.blockerAttention?.sampleBlockerIdentifier).not.toBe("PBD-4");
  });

  it("covers recursive blocker chains when the downstream leaf has active work", async () => {
    const { agentId } = await createCompany("PBR");
    const parentId = await insertIssue({ identifier: "PBR-1", title: "Parent", status: "blocked" });
    const blockerId = await insertIssue({ identifier: "PBR-2", title: "Blocked dependency", status: "blocked" });
    const leafId = await insertIssue({
      identifier: "PBR-3",
      title: "Running leaf",
      status: "todo",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: blockerId, blockedIssueId: parentId });
    await block({ blockerIssueId: leafId, blockedIssueId: blockerId });
    await activeRun({ agentId, issueId: leafId });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "covered",
      reason: "active_dependency",
      unresolvedBlockerCount: 1,
      coveredBlockerCount: 1,
      attentionBlockerCount: 0,
      sampleBlockerIdentifier: "PBR-3",
    });
  });

  it("does not cover a blocker from a stale run the issue no longer owns", async () => {
    const { agentId } = await createCompany("PBX");
    const parentId = await insertIssue({ identifier: "PBX-1", title: "Parent", status: "blocked" });
    const blockerId = await insertIssue({
      identifier: "PBX-2",
      title: "Previously running blocker",
      status: "blocked",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: blockerId, blockedIssueId: parentId });
    await activeRun({ agentId, issueId: blockerId, current: false });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "needs_attention",
      reason: "attention_required",
      unresolvedBlockerCount: 1,
      coveredBlockerCount: 0,
      attentionBlockerCount: 1,
      sampleBlockerIdentifier: "PBX-2",
    });
  });

  it("flags a chain whose leaf is in_review without an action path as stalled", async () => {
    const { agentId } = await createCompany("PBV");
    const parentId = await insertIssue({ identifier: "PBV-1", title: "Parent", status: "blocked" });
    const reviewLeafId = await insertIssue({
      identifier: "PBV-2",
      title: "Stalled review leaf",
      status: "in_review",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: reviewLeafId, blockedIssueId: parentId });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "stalled",
      reason: "stalled_review",
      unresolvedBlockerCount: 1,
      coveredBlockerCount: 0,
      stalledBlockerCount: 1,
      attentionBlockerCount: 0,
      sampleBlockerIdentifier: "PBV-2",
      sampleStalledBlockerIdentifier: "PBV-2",
    });
  });

  it("does not flag an in_review leaf as stalled when an active run is still progressing it", async () => {
    const { agentId } = await createCompany("PBW");
    const parentId = await insertIssue({ identifier: "PBW-1", title: "Parent", status: "blocked" });
    const reviewLeafId = await insertIssue({
      identifier: "PBW-2",
      title: "Active review leaf",
      status: "in_review",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: reviewLeafId, blockedIssueId: parentId });
    await activeRun({ agentId, issueId: reviewLeafId });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "covered",
      stalledBlockerCount: 0,
    });
  });

  it("flags a deep chain whose leaf is stalled in_review through multiple layers", async () => {
    const { agentId } = await createCompany("PBZ");
    const rootId = await insertIssue({ identifier: "PBZ-1", title: "Root", status: "blocked" });
    const midId = await insertIssue({ identifier: "PBZ-2", title: "Mid blocker", status: "blocked" });
    const leafId = await insertIssue({
      identifier: "PBZ-3",
      title: "Stalled leaf",
      status: "in_review",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: midId, blockedIssueId: rootId });
    await block({ blockerIssueId: leafId, blockedIssueId: midId });

    const root = (await svc.list({ status: "blocked" })).find((issue) => issue.id === rootId);

    expect(root?.blockerAttention).toMatchObject({
      state: "stalled",
      reason: "stalled_review",
      stalledBlockerCount: 1,
      sampleStalledBlockerIdentifier: "PBZ-3",
    });
  });

  it("returns the direct path and link details when an intermediate blocker is selected", async () => {
    const { agentId } = await createCompany("PBI");
    const rootId = await insertIssue({ identifier: "PBI-1", title: "Root", status: "blocked" });
    const directId = await insertIssue({
      identifier: "PBI-2",
      title: "Direct blocker",
      status: "blocked",
    });
    const intermediateId = await insertIssue({
      identifier: "PBI-3",
      title: "Stalled intermediate review",
      status: "in_review",
      assigneeAgentId: agentId,
    });
    const leafId = await insertIssue({
      identifier: "PBI-4",
      title: "Downstream leaf",
      status: "todo",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: directId, blockedIssueId: rootId });
    await block({ blockerIssueId: intermediateId, blockedIssueId: directId });
    await block({ blockerIssueId: leafId, blockedIssueId: intermediateId });

    const root = (await svc.list({ status: "blocked" })).find((issue) => issue.id === rootId);

    expect(root?.blockerAttention).toMatchObject({
      state: "stalled",
      directBlockerIssueId: directId,
      terminalBlockerIssueId: intermediateId,
      terminalBlocker: {
        id: intermediateId,
        identifier: "PBI-3",
        title: "Stalled intermediate review",
      },
    });
  });

  it("prefers needs_attention over stalled when the chain also has a hard attention case", async () => {
    const { agentId } = await createCompany("PBQ");
    const parentId = await insertIssue({ identifier: "PBQ-1", title: "Parent", status: "blocked" });
    const reviewLeafId = await insertIssue({
      identifier: "PBQ-2",
      title: "Stalled review leaf",
      status: "in_review",
      assigneeAgentId: agentId,
    });
    const cancelledLeafId = await insertIssue({
      identifier: "PBQ-3",
      title: "Cancelled blocker",
      status: "cancelled",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: reviewLeafId, blockedIssueId: parentId });
    await block({ blockerIssueId: cancelledLeafId, blockedIssueId: parentId });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "needs_attention",
      reason: "attention_required",
      coveredBlockerCount: 0,
      stalledBlockerCount: 1,
      attentionBlockerCount: 1,
      sampleStalledBlockerIdentifier: "PBQ-2",
    });
  });

  it("treats open liveness escalation blockers as covered waiting paths", async () => {
    const { agentId } = await createCompany("PBL");
    const parentId = await insertIssue({ identifier: "PBL-1", title: "Parent", status: "blocked" });
    const cancelledLeafId = await insertIssue({
      identifier: "PBL-2",
      title: "Cancelled blocker",
      status: "cancelled",
      assigneeAgentId: agentId,
    });
    const incidentKey = [
      "harness_liveness",
      parentId,
      "blocked_by_cancelled_issue",
      cancelledLeafId,
    ].join(":");
    const escalationId = await insertIssue({
      identifier: "PBL-3",
      title: "Liveness escalation",
      status: "todo",
      assigneeAgentId: agentId,
      originKind: "harness_liveness_escalation",
      originId: incidentKey,
      originFingerprint: [
        "harness_liveness_leaf",
        "blocked_by_cancelled_issue",
        cancelledLeafId,
      ].join(":"),
    });
    await block({ blockerIssueId: cancelledLeafId, blockedIssueId: parentId });
    await block({ blockerIssueId: escalationId, blockedIssueId: parentId });

    const parent = (await svc.list({ status: "blocked,todo" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "covered",
      reason: "active_dependency",
      unresolvedBlockerCount: 2,
      coveredBlockerCount: 2,
      attentionBlockerCount: 0,
    });
  });

  it("does not treat cancelled liveness escalation issues as covered waiting paths", async () => {
    const { agentId } = await createCompany("PBLX");
    const parentId = await insertIssue({ identifier: "PBLX-1", title: "Parent", status: "blocked" });
    const cancelledLeafId = await insertIssue({
      identifier: "PBLX-2",
      title: "Cancelled blocker",
      status: "cancelled",
      assigneeAgentId: agentId,
    });
    await insertIssue({
      identifier: "PBLX-3",
      title: "Cancelled liveness escalation",
      status: "cancelled",
      assigneeAgentId: agentId,
      originKind: "harness_liveness_escalation",
      originId: [
        "harness_liveness",
        parentId,
        "blocked_by_cancelled_issue",
        cancelledLeafId,
      ].join(":"),
    });
    await block({ blockerIssueId: cancelledLeafId, blockedIssueId: parentId });

    const parent = (await svc.list({ attention: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockedInboxAttention).toMatchObject({
      state: "needs_attention",
      reason: "blocked_by_cancelled_issue",
      leafIssue: { id: cancelledLeafId, identifier: "PBLX-2" },
    });
  });

  it("does not treat an expired scheduled retry as actively covered work", async () => {
    const pinnedNow = new Date("2026-08-20T12:00:00.000Z");
    const expiredRetryAt = new Date(pinnedNow.getTime() - 60_000);
    const { agentId } = await createCompany("PBY");
    const parentId = await insertIssue({ identifier: "PBY-1", title: "Parent", status: "blocked" });
    const blockerId = await insertIssue({
      identifier: "PBY-2",
      title: "Retrying blocker",
      status: "blocked",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: blockerId, blockedIssueId: parentId });
    await activeRun({
      agentId,
      issueId: blockerId,
      status: "scheduled_retry",
      scheduledRetryAt: expiredRetryAt,
    });

    const parent = (await svc.list({ status: "blocked" })).find((issue) => issue.id === parentId);

    expect(parent?.blockerAttention).toMatchObject({
      state: "needs_attention",
      reason: "attention_required",
      unresolvedBlockerCount: 1,
      coveredBlockerCount: 0,
      attentionBlockerCount: 1,
      sampleBlockerIdentifier: "PBY-2",
    });
  });

  it("returns blocked inbox attention for an unassigned blocker leaf and supports count/search", async () => {
    const {} = await createCompany("BIA");
    const parentId = await insertIssue({ identifier: "BIA-1", title: "Blocked source", status: "blocked" });
    const blockerId = await insertIssue({
      identifier: "BIA-2",
      title: "Unassigned leaf",
      status: "todo",
    });
    await block({ blockerIssueId: blockerId, blockedIssueId: parentId });

    const rows = await svc.list({ attention: "blocked", q: "BIA-2" });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(parentId);
    expect(rows[0]?.blockedBy).toEqual([
      expect.objectContaining({ id: blockerId, identifier: "BIA-2" }),
    ]);
    expect(rows[0]?.blockedInboxAttention).toMatchObject({
      kind: "blocked",
      state: "needs_attention",
      reason: "blocked_by_unassigned_issue",
      severity: "critical",
      owner: { type: "unknown", agentId: null, userId: null },
      action: { label: "Assign blocker" },
      leafIssue: { id: blockerId, identifier: "BIA-2" },
      redaction: { secretFieldsOmitted: true },
    });
    await expect(svc.count({ attention: "blocked" })).resolves.toBe(1);
  });

  it("surfaces cancelled-blocker attention on an assigned todo source", async () => {
    const { agentId } = await createCompany("BICX");
    const sourceId = await insertIssue({
      identifier: "BICX-1",
      title: "Dispatch-suppressed source",
      status: "todo",
      assigneeAgentId: agentId,
    });
    const blockerId = await insertIssue({
      identifier: "BICX-2",
      title: "Cancelled dependency",
      status: "cancelled",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: blockerId, blockedIssueId: sourceId });

    const rows = await svc.list({ attention: "blocked" });
    const source = rows.find((issue) => issue.id === sourceId);

    expect(source?.blockedInboxAttention).toMatchObject({
      kind: "blocked",
      state: "needs_attention",
      reason: "blocked_by_cancelled_issue",
      owner: { type: "agent", agentId },
      action: { label: "Replace blocker" },
      leafIssue: { id: blockerId, identifier: "BICX-2" },
    });
  });

  it("redacts external wait details from blocked inbox payloads and search", async () => {
    const {} = await createCompany("BIX");
    const owner = "Private Vendor Security Team";
    const action = "Send the confidential access token for customer Alpha";
    const issueId = await insertIssue({
      identifier: "BIX-1",
      title: "Blocked on vendor",
      status: "blocked",
      description: [
        "Public context stays visible.",
        `external owner: ${owner}`,
        `external action: ${action}`,
        "Continue after the vendor confirms receipt.",
      ].join("\n"),
    });

    const rows = await svc.list({ attention: "blocked" });
    const issue = rows.find((row) => row.id === issueId);

    expect(issue?.description).toContain("Public context stays visible.");
    expect(issue?.description).toContain("Continue after the vendor confirms receipt.");
    expect(issue?.description).not.toContain(owner);
    expect(issue?.description).not.toContain(action);
    expect(issue?.blockedInboxAttention).toMatchObject({
      state: "external_wait",
      reason: "external_owner_action",
      owner: { type: "external", label: null },
      action: { label: "External owner action", detail: null },
      redaction: { externalDetailsRedacted: true, secretFieldsOmitted: true },
    });
    expect(JSON.stringify(issue?.blockedInboxAttention)).not.toContain(owner);
    expect(JSON.stringify(issue?.blockedInboxAttention)).not.toContain(action);

    await expect(svc.list({ attention: "blocked", q: owner })).resolves.toEqual([]);
    await expect(svc.count({ attention: "blocked", q: action })).resolves.toBe(0);
    await expect(svc.count({ attention: "blocked", q: "Public context" })).resolves.toBe(1);
  });

  it("excludes healthy active blockers from blocked inbox attention", async () => {
    const { agentId } = await createCompany("BIB");
    const parentId = await insertIssue({ identifier: "BIB-1", title: "Blocked source", status: "blocked" });
    const blockerId = await insertIssue({
      identifier: "BIB-2",
      title: "Running leaf",
      status: "todo",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: blockerId, blockedIssueId: parentId });
    await activeRun({ agentId, issueId: blockerId });

    expect(await svc.list({ attention: "blocked" })).toEqual([]);
  });

  it("classifies assigned backlog and invalid review leaves for blocked inbox attention", async () => {
    const { agentId, pausedAgentId } = await createCompany("BIC");
    const backlogParentId = await insertIssue({ identifier: "BIC-1", title: "Blocked by parked work", status: "blocked" });
    const backlogLeafId = await insertIssue({
      identifier: "BIC-2",
      title: "Parked blocker",
      status: "backlog",
      assigneeAgentId: agentId,
    });
    await block({ blockerIssueId: backlogLeafId, blockedIssueId: backlogParentId });

    const reviewId = await insertIssue({
      identifier: "BIC-3",
      title: "Invalid review",
      status: "in_review",
      assigneeAgentId: agentId,
      executionState: {
        status: "pending",
        currentStageId: null,
        currentStageIndex: null,
        currentStageType: "review",
        currentParticipant: { type: "agent", agentId: pausedAgentId },
        returnAssignee: null,
        reviewRequest: null,
        completedStageIds: [],
        lastDecisionId: null,
        lastDecisionOutcome: null,
      },
    });

    const rows = await svc.list({ attention: "blocked" });
    const byId = new Map(rows.map((row) => [row.id, row]));

    expect(byId.get(backlogParentId)?.blockedInboxAttention).toMatchObject({
      reason: "blocked_by_assigned_backlog_issue",
      severity: "high",
      owner: { type: "agent", agentId },
      leafIssue: { id: backlogLeafId },
    });
    expect(byId.get(reviewId)?.blockedInboxAttention).toMatchObject({
      reason: "invalid_review_participant",
      severity: "critical",
      action: { label: "Repair review participant" },
    });
  });

  it("classifies recovery issues and missing successful-run dispositions", async () => {
    const { agentId } = await createCompany("BID");
    const sourceId = await insertIssue({ identifier: "BID-1", title: "Stopped source", status: "blocked" });
    const leafId = await insertIssue({ identifier: "BID-2", title: "Stopped leaf", status: "todo" });
    const recoveryId = await insertIssue({
      identifier: "BID-3",
      title: "Recovery issue",
      status: "todo",
      assigneeAgentId: agentId,
      originKind: "harness_liveness_escalation",
      originId: buildIssueGraphLivenessIncidentKey({
        issueId: sourceId,
        state: "blocked_by_unassigned_issue",
        blockerIssueId: leafId,
      }),
    });
    const handoffId = await insertIssue({
      identifier: "BID-4",
      title: "Needs disposition",
      status: "in_progress",
      assigneeAgentId: agentId,
    });
    await db.insert(activityLog).values({
      actorType: "system",
      actorId: "system",
      action: "issue.successful_run_handoff_required",
      entityType: "issue",
      entityId: handoffId,
      agentId,
      details: { sourceRunId: randomUUID(), detectedProgressSummary: "Progress was made" },
    });

    const rows = await svc.list({ attention: "blocked" });
    const byId = new Map(rows.map((row) => [row.id, row]));

    expect(byId.get(recoveryId)?.blockedInboxAttention).toMatchObject({
      state: "recovery_open",
      reason: "open_recovery_issue",
      sourceIssue: { id: sourceId },
      leafIssue: { id: leafId },
      recoveryIssue: { id: recoveryId },
    });
    expect(byId.get(handoffId)?.blockedInboxAttention).toMatchObject({
      state: "missing_disposition",
      reason: "missing_successful_run_disposition",
      owner: { type: "agent", agentId },
      action: { label: "Choose disposition" },
    });

    const handoffRunId = await activeRun({ agentId, issueId: handoffId, current: false });
    const liveRows = await svc.list({ attention: "blocked" });
    expect(liveRows.some((row) => row.id === handoffId)).toBe(false);

    await db.update(heartbeatRuns).set({ status: "succeeded" }).where(eq(heartbeatRuns.id, handoffRunId));
    const stoppedRows = await svc.list({ attention: "blocked" });
    expect(stoppedRows.find((row) => row.id === handoffId)?.blockedInboxAttention).toMatchObject({
      state: "missing_disposition",
      reason: "missing_successful_run_disposition",
    });

    const scheduledRetryRunId = randomUUID();
    await db.insert(heartbeatRuns).values({
      id: scheduledRetryRunId,
      agentId,
      status: "scheduled_retry",
      contextSnapshot: { taskId: handoffId },
      scheduledRetryAt: new Date(Date.now() + 60_000),
      scheduledRetryAttempt: 1,
    });
    const scheduledRows = await svc.list({ attention: "blocked" });
    expect(scheduledRows.some((row) => row.id === handoffId)).toBe(false);

    await db.update(heartbeatRuns).set({ status: "succeeded" }).where(eq(heartbeatRuns.id, scheduledRetryRunId));
    const exhaustedRows = await svc.list({ attention: "blocked" });
    expect(exhaustedRows.find((row) => row.id === handoffId)?.blockedInboxAttention).toMatchObject({
      state: "missing_disposition",
      reason: "missing_successful_run_disposition",
    });

    await db.insert(activityLog).values({
      actorType: "system",
      actorId: "system",
      action: "issue.successful_run_handoff_escalated",
      entityType: "issue",
      entityId: handoffId,
      agentId,
      details: { sourceRunId: randomUUID() },
    });
    const escalatedRows = await svc.list({ attention: "blocked" });
    expect(escalatedRows.find((row) => row.id === handoffId)?.blockedInboxAttention).toMatchObject({
      state: "missing_disposition",
      reason: "missing_successful_run_disposition",
    });

    const escalatedLiveRunId = await activeRun({ agentId, issueId: handoffId, current: false });
    const escalatedLiveRows = await svc.list({ attention: "blocked" });
    expect(escalatedLiveRows.some((row) => row.id === handoffId)).toBe(false);

    await db.update(heartbeatRuns).set({ status: "succeeded" }).where(eq(heartbeatRuns.id, escalatedLiveRunId));
    const escalatedStoppedRows = await svc.list({ attention: "blocked" });
    expect(escalatedStoppedRows.find((row) => row.id === handoffId)?.blockedInboxAttention).toMatchObject({
      state: "missing_disposition",
      reason: "missing_successful_run_disposition",
    });
  });

  it("applies assigneeAgentId='null' as an IS NULL filter on the blocked-inbox path", async () => {
    const { agentId } = await createCompany("BAN");
    const unassignedParentId = await insertIssue({
      identifier: "BAN-1",
      title: "Unassigned blocked parent",
      status: "blocked",
    });
    const unassignedLeafId = await insertIssue({
      identifier: "BAN-2",
      title: "Unassigned leaf",
      status: "todo",
    });
    await block({ blockerIssueId: unassignedLeafId, blockedIssueId: unassignedParentId });

    const assignedParentId = await insertIssue({
      identifier: "BAN-3",
      title: "Assigned blocked parent",
      status: "blocked",
      assigneeAgentId: agentId,
    });
    const assignedLeafId = await insertIssue({
      identifier: "BAN-4",
      title: "Unassigned leaf for assigned parent",
      status: "todo",
    });
    await block({ blockerIssueId: assignedLeafId, blockedIssueId: assignedParentId });

    const rows = await svc.list({ attention: "blocked", assigneeAgentId: "null" });
    expect(rows.map((row) => row.id)).toEqual([unassignedParentId]);

    await expect(svc.count({ attention: "blocked", assigneeAgentId: "null" })).resolves.toBe(1);
  });

  it("applies a UUID assigneeAgentId filter on the blocked-inbox path", async () => {
    const { agentId } = await createCompany("BAU");
    const unassignedParentId = await insertIssue({
      identifier: "BAU-1",
      title: "Unassigned blocked parent",
      status: "blocked",
    });
    const unassignedLeafId = await insertIssue({
      identifier: "BAU-2",
      title: "Unassigned leaf",
      status: "todo",
    });
    await block({ blockerIssueId: unassignedLeafId, blockedIssueId: unassignedParentId });

    const assignedParentId = await insertIssue({
      identifier: "BAU-3",
      title: "Assigned blocked parent",
      status: "blocked",
      assigneeAgentId: agentId,
    });
    const assignedLeafId = await insertIssue({
      identifier: "BAU-4",
      title: "Unassigned leaf for assigned parent",
      status: "todo",
    });
    await block({ blockerIssueId: assignedLeafId, blockedIssueId: assignedParentId });

    const rows = await svc.list({ attention: "blocked", assigneeAgentId: agentId });
    expect(rows.map((row) => row.id)).toEqual([assignedParentId]);

    await expect(svc.count({ attention: "blocked", assigneeAgentId: agentId })).resolves.toBe(1);
  });

  it("rejects malformed assigneeAgentId filter values on the blocked-inbox path", async () => {
    const {} = await createCompany("BAM");
    await expect(
      svc.list({ attention: "blocked", assigneeAgentId: "not-a-uuid" }),
    ).rejects.toThrow(/assigneeAgentId/i);
    await expect(
      svc.count({ attention: "blocked", assigneeAgentId: "not-a-uuid" }),
    ).rejects.toThrow(/assigneeAgentId/i);
  });
});
