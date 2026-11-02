import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  approvals,
  decisionArchiveNotificationOutbox,
  decisionRetention,
  decisions,
  heartbeatRuns,
  issueApprovals,
  issueRecoveryActions,
  issueThreadInteractions,
  issues,
} from "@paperclipai/db";
import type {
  AttentionArchiveManifestEntry,
  AttentionItem,
  AttentionSourceKind,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { logActivity } from "./activity-log.js";
import type { AuthorizationActor } from "./authorization.js";
import {
  canReadDecisionSource,
  type DecisionMutationActor,
} from "./decision-queues.js";

export const DEFAULT_DECISION_SHELF_DAYS = 30;
export const DEFAULT_DECISION_ARCHIVE_DAYS = 90;
const DAY_MS = 86_400_000;

export type DecisionRetentionState = typeof decisionRetention.$inferSelect;
export type ArchiveNotificationBatch = {
  agentId: string;
  items: Array<{
    sourceKind: AttentionSourceKind;
    sourceId: string;
    archiveVersion: number;
    issueId: string;
  }>;
};

function sourceKey(sourceKind: string, sourceId: string) {
  return `${sourceKind}:${sourceId}`;
}

function canonicalManifest(manifest: readonly AttentionArchiveManifestEntry[]) {
  return [...manifest].sort((left, right) => {
    return sourceKey(left.sourceKind, left.sourceId).localeCompare(sourceKey(right.sourceKind, right.sourceId));
  }).map((entry) => ({
    sourceKind: entry.sourceKind,
    sourceId: entry.sourceId,
    expectedVersion: entry.expectedVersion,
    activityAt: entry.activityAt,
    reason: entry.reason,
  }));
}

export function hashAttentionArchiveManifest(manifest: readonly AttentionArchiveManifestEntry[]) {
  return createHash("sha256").update(JSON.stringify(canonicalManifest(manifest))).digest("hex");
}

function archiveActorColumns(actor: DecisionMutationActor) {
  return {
    archivedByType: actor.actorType,
    archivedByAgentId: actor.agentId,
    archivedByUserId: actor.userId,
    archivedByRunId: actor.runId,
  };
}

async function resolveOrigin(
  db: Db,
  sourceKind: AttentionSourceKind,
  sourceId: string,
) {
  let originAgentId: string | null = null;
  let originIssueId: string | null = null;
  if (sourceKind === "approval") {
    const row = await db.select({ agentId: approvals.requestedByAgentId, issueId: issueApprovals.issueId })
      .from(approvals)
      .leftJoin(issueApprovals, eq(issueApprovals.approvalId, approvals.id))
      .where(eq(approvals.id, sourceId))
      .then((rows) => rows[0] ?? null);
    originAgentId = row?.agentId ?? null;
    originIssueId = row?.issueId ?? null;
  } else if (sourceKind === "decision") {
    const row = await db.select({ agentId: decisions.originAgentId, issueId: decisions.originIssueId })
      .from(decisions).where(eq(decisions.id, sourceId))
      .then((rows) => rows[0] ?? null);
    originAgentId = row?.agentId ?? null;
    originIssueId = row?.issueId ?? null;
  } else if (sourceKind === "issue_thread_interaction") {
    const row = await db.select({ agentId: issueThreadInteractions.createdByAgentId, issueId: issueThreadInteractions.issueId })
      .from(issueThreadInteractions)
      .where(eq(issueThreadInteractions.id, sourceId))
      .then((rows) => rows[0] ?? null);
    originAgentId = row?.agentId ?? null;
    originIssueId = row?.issueId ?? null;
  } else if (sourceKind === "failed_run") {
    const row = await db.select({ agentId: heartbeatRuns.agentId, context: heartbeatRuns.contextSnapshot })
      .from(heartbeatRuns).where(eq(heartbeatRuns.id, sourceId))
      .then((rows) => rows[0] ?? null);
    const context = row?.context && typeof row.context === "object" ? row.context as Record<string, unknown> : {};
    originAgentId = row?.agentId ?? null;
    originIssueId = typeof context.issueId === "string" ? context.issueId : typeof context.taskId === "string" ? context.taskId : null;
  } else {
    const issueId = sourceKind === "recovery_action"
      ? await db.select({ issueId: issueRecoveryActions.sourceIssueId }).from(issueRecoveryActions)
        .where(eq(issueRecoveryActions.id, sourceId))
        .then((rows) => rows[0]?.issueId ?? null)
      : (["productivity_review", "blocker_attention", "review"] as string[]).includes(sourceKind) ? sourceId : null;
    if (issueId) {
      const row = await db.select({ agentId: issues.createdByAgentId, issueId: issues.id }).from(issues)
        .where(eq(issues.id, issueId))
        .then((rows) => rows[0] ?? null);
      originAgentId = row?.agentId ?? null;
      originIssueId = row?.issueId ?? null;
    }
  }
  if (!originAgentId || !originIssueId) return null;
  const activeAgent = await db.select({ id: agents.id }).from(agents)
    .where(and(eq(agents.id, originAgentId), eq(agents.status, "active")))
    .then((rows) => rows[0] ?? null);
  return activeAgent ? { originAgentId, originIssueId } : null;
}

export function decisionRetentionService(
  db: Db,
  options: { notifyOriginAgent?: (batch: ArchiveNotificationBatch) => Promise<unknown> } = {},
) {
  async function syncItems(items: readonly AttentionItem[]) {
    if (items.length === 0) return new Map<string, DecisionRetentionState>();
    const unique = [...new Map(items.map((item) => [itemSourceKey(item), item])).values()];
    await db.insert(decisionRetention).values(unique.map((item) => ({
      sourceKind: item.sourceKind,
      sourceId: item.subject.id,
      sourceActivityAt: new Date(item.activityAt),
    }))).onConflictDoNothing({
      target: [decisionRetention.sourceKind, decisionRetention.sourceId],
    });
    let rows = await db.select().from(decisionRetention).where(inArray(decisionRetention.sourceId, unique.map((item) => item.subject.id)));
    const byKey = new Map(rows.map((row) => [sourceKey(row.sourceKind, row.sourceId), row]));
    for (const item of unique) {
      const key = itemSourceKey(item);
      const row = byKey.get(key);
      const activityAt = new Date(item.activityAt);
      if (!row || row.sourceActivityAt.getTime() === activityAt.getTime()) continue;
      const updated = await db.update(decisionRetention).set({
        sourceActivityAt: activityAt,
        version: sql`${decisionRetention.version} + 1`,
        updatedAt: new Date(),
      }).where(and(
        eq(decisionRetention.id, row.id),
        ne(decisionRetention.sourceActivityAt, activityAt),
      )).returning().then((values) => values[0] ?? null);
      if (updated) byKey.set(key, updated);
    }
    rows = [...byKey.values()];
    return new Map(rows.map((row) => [sourceKey(row.sourceKind, row.sourceId), row]));
  }

  function itemSourceKey(item: AttentionItem) {
    return sourceKey(item.sourceKind, item.subject.id);
  }

  async function getState(sourceKind: AttentionSourceKind, sourceId: string) {
    return db.select().from(decisionRetention).where(and(
      eq(decisionRetention.sourceKind, sourceKind),
      eq(decisionRetention.sourceId, sourceId),
    )).then((rows) => rows[0] ?? null);
  }

  async function setKeep(input: {
    sourceKind: AttentionSourceKind;
    sourceId: string;
    keep: boolean;
    authActor: AuthorizationActor;
    actor: DecisionMutationActor;
  }) {
    if (!(await canReadDecisionSource(db, input.authActor, input.sourceKind, input.sourceId))) {
      throw notFound("Attention source not found");
    }
    const updated = await db.update(decisionRetention).set({
      keep: input.keep,
      version: sql`${decisionRetention.version} + 1`,
      updatedAt: new Date(),
    }).where(and(
      eq(decisionRetention.sourceKind, input.sourceKind),
      eq(decisionRetention.sourceId, input.sourceId),
    )).returning().then((rows) => rows[0] ?? null);
    if (!updated) throw notFound("Attention source not found");
    await logActivity(db, {
      actorType: input.actor.actorType,
      actorId: input.actor.actorId,
      agentId: input.actor.agentId,
      runId: input.actor.runId,
      agentApiKeyId: input.actor.agentApiKeyId,
      responsibleUserIdOverride: input.actor.responsibleUserId,
      action: "decision_retention.keep_updated",
      entityType: "attention_source",
      entityId: input.sourceId,
      details: { sourceKind: input.sourceKind, keep: input.keep },
    });
    return updated;
  }

  async function changeArchived(input: {
    sourceKind: AttentionSourceKind;
    sourceId: string;
    archived: boolean;
    authActor: AuthorizationActor;
    actor: DecisionMutationActor;
  }) {
    if (!(await canReadDecisionSource(db, input.authActor, input.sourceKind, input.sourceId))) {
      throw notFound("Attention source not found");
    }
    const now = new Date();
    const updated = await db.update(decisionRetention).set(input.archived ? {
      archivedAt: now,
      archivedReason: "manual",
      ...archiveActorColumns(input.actor),
      archiveVersion: sql`${decisionRetention.archiveVersion} + 1`,
      version: sql`${decisionRetention.version} + 1`,
      updatedAt: now,
    } : {
      archivedAt: null,
      archivedReason: null,
      archivedByType: null,
      archivedByAgentId: null,
      archivedByUserId: null,
      archivedByRunId: null,
      version: sql`${decisionRetention.version} + 1`,
      updatedAt: now,
    }).where(and(
      eq(decisionRetention.sourceKind, input.sourceKind),
      eq(decisionRetention.sourceId, input.sourceId),
      input.archived ? isNull(decisionRetention.archivedAt) : isNotNull(decisionRetention.archivedAt),
    )).returning().then((rows) => rows[0] ?? null);
    if (!updated) {
      const current = await getState(input.sourceKind, input.sourceId);
      if (!current) throw notFound("Attention source not found");
      return current;
    }
    await logActivity(db, {
      actorType: input.actor.actorType,
      actorId: input.actor.actorId,
      agentId: input.actor.agentId,
      runId: input.actor.runId,
      agentApiKeyId: input.actor.agentApiKeyId,
      responsibleUserIdOverride: input.actor.responsibleUserId,
      action: input.archived ? "decision_retention.archived" : "decision_retention.revived",
      entityType: "attention_source",
      entityId: input.sourceId,
      details: { sourceKind: input.sourceKind },
    });
    return updated;
  }

  async function archiveReviewedManifest(input: {
    manifest: AttentionArchiveManifestEntry[];
    originActor: AuthorizationActor;
    decidingActor: AuthorizationActor;
    decidedByUserId: string;
  }) {
    const keys = input.manifest.map((entry) => sourceKey(entry.sourceKind, entry.sourceId));
    if (new Set(keys).size !== keys.length || input.manifest.some((entry) => false)) {
      throw unprocessable("Archive manifest must contain one exact company-scoped set");
    }
    return db.transaction(async (tx) => {
      const txDb = tx as unknown as Db;
      for (const entry of input.manifest) {
        const kind = entry.sourceKind as AttentionSourceKind;
        if (!(await canReadDecisionSource(txDb, input.originActor, kind, entry.sourceId))
          || !(await canReadDecisionSource(txDb, input.decidingActor, kind, entry.sourceId))) {
          throw conflict("archive_proposal_authority_changed", { code: "archive_proposal_authority_changed" });
        }
        await txDb.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`decision-retention:${entry.sourceKind}:${entry.sourceId}`}, 0))`);
        const state = await txDb.select().from(decisionRetention).where(and(
          eq(decisionRetention.sourceKind, entry.sourceKind),
          eq(decisionRetention.sourceId, entry.sourceId),
        )).then((rows) => rows[0] ?? null);
        if (!state || state.version !== entry.expectedVersion || state.sourceActivityAt.toISOString() !== entry.activityAt || state.archivedAt) {
          throw conflict("archive_proposal_stale", { code: "archive_proposal_stale" });
        }
      }
      const now = new Date();
      for (const entry of input.manifest) {
        const archived = await txDb.update(decisionRetention).set({
          archivedAt: now,
          archivedReason: "accepted_proposal",
          archivedByType: "user",
          archivedByAgentId: null,
          archivedByUserId: input.decidedByUserId,
          archivedByRunId: null,
          archiveVersion: sql`${decisionRetention.archiveVersion} + 1`,
          version: sql`${decisionRetention.version} + 1`,
          updatedAt: now,
        }).where(and(
          eq(decisionRetention.sourceKind, entry.sourceKind),
          eq(decisionRetention.sourceId, entry.sourceId),
          eq(decisionRetention.version, entry.expectedVersion),
          isNull(decisionRetention.archivedAt),
        )).returning({ id: decisionRetention.id });
        if (archived.length !== 1) {
          throw conflict("archive_proposal_stale", { code: "archive_proposal_stale" });
        }
        await logActivity(txDb, {
          actorType: "system",
          actorId: "decision-archive-proposal",
          responsibleUserIdOverride: input.decidedByUserId,
          action: "decision_retention.archived",
          entityType: "attention_source",
          entityId: entry.sourceId,
          details: { sourceKind: entry.sourceKind, reason: "accepted_proposal" },
        });
      }
      return { archived: input.manifest.length };
    });
  }

  async function autoArchive(input: { items: AttentionItem[]; now?: Date }) {
    const now = input.now ?? new Date();
    const cutoff = new Date(now.getTime() - DEFAULT_DECISION_ARCHIVE_DAYS * DAY_MS);
    const candidates = input.items.filter((item) => new Date(item.activityAt) <= cutoff && !item.keep && !item.archivedAt);
    let archived = 0;
    await db.transaction(async (tx) => {
      const txDb = tx as unknown as Db;
      for (const item of candidates) {
        const updated = await txDb.update(decisionRetention).set({
          archivedAt: now,
          archivedReason: "idle_ttl",
          archivedByType: "system",
          archivedByAgentId: null,
          archivedByUserId: null,
          archivedByRunId: null,
          archiveVersion: sql`${decisionRetention.archiveVersion} + 1`,
          version: sql`${decisionRetention.version} + 1`,
          updatedAt: now,
        }).where(and(
          eq(decisionRetention.sourceKind, item.sourceKind),
          eq(decisionRetention.sourceId, item.subject.id),
          eq(decisionRetention.version, item.retentionVersion),
          eq(decisionRetention.keep, false),
          isNull(decisionRetention.archivedAt),
          lte(decisionRetention.sourceActivityAt, cutoff),
        )).returning().then((rows) => rows[0] ?? null);
        if (!updated) continue;
        archived += 1;
        const origin = await resolveOrigin(txDb, item.sourceKind, item.subject.id);
        if (origin) {
          await txDb.insert(decisionArchiveNotificationOutbox).values({
            sourceKind: item.sourceKind,
            sourceId: item.subject.id,
            archiveVersion: updated.archiveVersion,
            originAgentId: origin.originAgentId,
            originIssueId: origin.originIssueId,
          }).onConflictDoNothing();
        }
        await logActivity(txDb, {
          actorType: "system",
          actorId: "decision-retention-sweeper",
          action: "decision_retention.auto_archived",
          entityType: "attention_source",
          entityId: item.subject.id,
          details: { sourceKind: item.sourceKind, archiveVersion: updated.archiveVersion },
        });
      }
    });
    return archived;
  }

  async function deliverNotifications(limit = 500) {
    if (!options.notifyOriginAgent) return { notifiedAgents: 0, delivered: 0 };
    const claimAt = new Date();
    const staleClaimAt = new Date(claimAt.getTime() - 5 * 60_000);
    await db.update(decisionArchiveNotificationOutbox).set({ status: "pending", updatedAt: claimAt })
      .where(and(
        eq(decisionArchiveNotificationOutbox.status, "delivering"),
        or(isNull(decisionArchiveNotificationOutbox.lastAttemptAt), lte(decisionArchiveNotificationOutbox.lastAttemptAt, staleClaimAt)),
      ));
    const rows = await db.transaction(async (tx) => {
      const pendingIds = await tx.select({ id: decisionArchiveNotificationOutbox.id })
        .from(decisionArchiveNotificationOutbox)
        .where(eq(decisionArchiveNotificationOutbox.status, "pending"))
        .orderBy(asc(decisionArchiveNotificationOutbox.createdAt), asc(decisionArchiveNotificationOutbox.id))
        .limit(limit)
        .then((values) => values.map((value) => value.id));
      if (pendingIds.length === 0) return [];
      return tx.update(decisionArchiveNotificationOutbox).set({
        status: "delivering",
        lastAttemptAt: claimAt,
        attemptCount: sql`${decisionArchiveNotificationOutbox.attemptCount} + 1`,
        updatedAt: claimAt,
      }).where(and(
        inArray(decisionArchiveNotificationOutbox.id, pendingIds),
        eq(decisionArchiveNotificationOutbox.status, "pending"),
      )).returning();
    });
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.originAgentId;
      const grouped = groups.get(key) ?? [];
      grouped.push(row);
      groups.set(key, grouped);
    }
    let notifiedAgents = 0;
    let delivered = 0;
    for (const grouped of groups.values()) {
      const first = grouped[0]!;
      try {
        await options.notifyOriginAgent({
          agentId: first.originAgentId,
          items: grouped.map((row) => ({
            sourceKind: row.sourceKind as AttentionSourceKind,
            sourceId: row.sourceId,
            archiveVersion: row.archiveVersion,
            issueId: row.originIssueId,
          })),
        });
        const deliveredAt = new Date();
        await db.update(decisionArchiveNotificationOutbox).set({
          status: "delivered",
          deliveredAt,
          lastAttemptAt: deliveredAt,
          updatedAt: deliveredAt,
        }).where(and(
          inArray(decisionArchiveNotificationOutbox.id, grouped.map((row) => row.id)),
          eq(decisionArchiveNotificationOutbox.status, "delivering"),
        ));
        notifiedAgents += 1;
        delivered += grouped.length;
      } catch {
        await db.update(decisionArchiveNotificationOutbox).set({
          status: "pending",
          lastAttemptAt: new Date(),
          updatedAt: new Date(),
        }).where(and(
          inArray(decisionArchiveNotificationOutbox.id, grouped.map((row) => row.id)),
          eq(decisionArchiveNotificationOutbox.status, "delivering"),
        ));
      }
    }
    return { notifiedAgents, delivered };
  }

  return {
    syncItems,
    getState,
    setKeep,
    archive: (input: Omit<Parameters<typeof changeArchived>[0], "archived">) => changeArchived({ ...input, archived: true }),
    revive: (input: Omit<Parameters<typeof changeArchived>[0], "archived">) => changeArchived({ ...input, archived: false }),
    archiveReviewedManifest,
    autoArchive,
    deliverNotifications,
  };
}
