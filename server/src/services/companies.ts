import { and, count, eq, gte, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  organizations,
  assets,
  agents,
  agentApiKeys,
  agentRuntimeState,
  agentTaskSessions,
  agentWakeupRequests,
  issues,
  issueComments,
  projects,
  goals,
  heartbeatRuns,
  runIdentityContexts,
  heartbeatRunEvents,
  costEvents,
  financeEvents,
  issueReadStates,
  approvalComments,
  approvals,
  activityLog,
  companySecrets,
  joinRequests,
  invites,
  principalPermissionGrants,
  companyMemberships,
  companySkills,
  documents,
  routineRuns,
  routineTriggers,
  routineRevisions,
  routines,
} from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";
import { isCloudManagedInstance } from "./cloud-instance.js";
import { notifyCloudOfPrimaryCompanyLifecycleChange } from "./cloud-lifecycle-sync.js";
import {
  MAX_ISSUE_PREFIX_ATTEMPTS,
  deriveIssuePrefixBase,
  isIssuePrefixConflict,
  issuePrefixSuffixForAttempt,
  pickAvailableIssuePrefix,
  rekeyCompanyIssueIdentifiers,
} from "./issue-prefix.js";
import { environmentService } from "./environments.js";
import { heartbeatService } from "./heartbeat.js";
import { logActivity } from "./activity-log.js";
import { builtInAgentService } from "./built-in-agents.js";
import { assertCanCreateOrganization } from "./organization.js";


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface CompanyActivityActor {
  actorType: "user" | "agent" | "system" | "plugin";
  actorId: string;
  agentId?: string | null;
  runId?: string | null;
}

const SYSTEM_COMPANY_ACTOR: CompanyActivityActor = {
  actorType: "system",
  actorId: "system",
  agentId: null,
  runId: null,
};

export function companyService(db: Db) {
  const environmentsSvc = environmentService(db);
  const heartbeat = heartbeatService(db);
  const builtInAgents = builtInAgentService(db);

  type CompanyTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  async function applyArchiveCascadeInTx(tx: CompanyTx, id: string) {
    const pausedAgentRows = await tx
      .update(agents)
      .set({
        status: "paused",
        pauseReason: "company_archived",
        pausedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(notInArray(agents.status, ["paused", "terminated", "pending_approval"]))
      .returning({ id: agents.id });

    const activeRunIds = await tx
      .select({ id: heartbeatRuns.id })
      .from(heartbeatRuns)
      .where(inArray(heartbeatRuns.status, ["queued", "running"]))
      .then((rows) => rows.map((row) => row.id));

    await tx
      .update(agentWakeupRequests)
      .set({
        status: "cancelled",
        error: "Cancelled because the company was archived",
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        inArray(agentWakeupRequests.status, ["queued", "deferred_issue_execution", "claimed"]),
        isNull(agentWakeupRequests.runId),
      ));

    return { agentsPaused: pausedAgentRows.length, activeRunIds };
  }

  async function finalizeArchive(
    id: string,
    actor: CompanyActivityActor,
    cascade: { agentsPaused: number; activeRunIds: string[] },
  ) {
    for (const runId of cascade.activeRunIds) {
      await heartbeat.cancelRun(runId, "Cancelled because the company was archived");
    }

    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId ?? null,
      runId: actor.runId ?? null,
      action: "company.archived",
      entityType: "company",
      entityId: id,
      details: {
        agentsPaused: cascade.agentsPaused,
        runsCancelled: cascade.activeRunIds.length,
      },
    });
  }

  const companySelection = {
    id: organizations.id,
    name: organizations.name,
    description: organizations.description,
    status: organizations.status,
    issuePrefix: organizations.issuePrefix,
    issueCounter: organizations.issueCounter,
    budgetMonthlyCents: organizations.budgetMonthlyCents,
    spentMonthlyCents: organizations.spentMonthlyCents,
    defaultResponsibleUserId: organizations.defaultResponsibleUserId,
    requireBoardApprovalForNewAgents: organizations.requireBoardApprovalForNewAgents,
    interactionResolverGovernance: organizations.interactionResolverGovernance,
    feedbackDataSharingEnabled: organizations.feedbackDataSharingEnabled,
    feedbackDataSharingConsentAt: organizations.feedbackDataSharingConsentAt,
    feedbackDataSharingConsentByUserId: organizations.feedbackDataSharingConsentByUserId,
    feedbackDataSharingTermsVersion: organizations.feedbackDataSharingTermsVersion,
    logoAssetId: organizations.logoAssetId,
    createdAt: organizations.createdAt,
    updatedAt: organizations.updatedAt,
  };

  function enrichCompany<T extends { logoAssetId: string | null }>(company: T) {
    return {
      ...company,
      logoUrl: company.logoAssetId ? `/api/assets/${company.logoAssetId}/content` : null,
    };
  }

  function currentUtcMonthWindow(now = new Date()) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    return {
      start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)),
    };
  }

  async function getMonthlySpend(database: Pick<Db, "select"> = db) {
    const { start, end } = currentUtcMonthWindow();
    const [row] = await database
      .select({
        spentMonthlyCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::double precision`,
      })
      .from(costEvents)
      .where(
        and(
          gte(costEvents.occurredAt, start),
          lt(costEvents.occurredAt, end),
        ),
      );
    return Number(row?.spentMonthlyCents ?? 0);
  }

  async function hydrateCompanySpend<T extends { id: string; spentMonthlyCents: number }>(
    rows: T[],
    database: Pick<Db, "select"> = db,
  ) {
    if (rows.length === 0) return rows;
    const spentMonthlyCents = await getMonthlySpend(database);
    return rows.map((row) => ({ ...row, spentMonthlyCents }));
  }

  function getCompanyQuery(database: Pick<Db, "select">) {
    return database
      .select(companySelection)
      .from(organizations);
  }

  /**
   * Decides whether a rename must move the company onto a new issue prefix, and
   * returns the exact prefix pair to re-key.
   *
   * Self-hosted companies pick their prefix from the name at creation and keep
   * it, so a rename leaves the prefix alone. On a hosted/managed instance the
   * company is provisioned for the operator, so the name is the only prefix
   * source the operator ever chose — a rename re-derives it. Returns null when
   * the current prefix is already correct or when the suffix space is
   * exhausted.
   */
  async function resolveRenamedIssuePrefix(
    tx: CompanyTx,
    companyPatch: Partial<typeof organizations.$inferInsert>,
  ): Promise<{ fromPrefix: string; toPrefix: string } | null> {
    // Only patch and environment facts gate the lock. Every comparison against
    // the company's own name or prefix happens below, under the lock.
    // An explicit prefix in the patch is the caller's decision; never override it.
    if (companyPatch.issuePrefix !== undefined) return null;
    const nextName = companyPatch.name;
    if (typeof nextName !== "string" || nextName.trim().length === 0) return null;
    if (!isCloudManagedInstance()) return null;

    // Lock the company row before comparing anything against it. Two concurrent
    // updates would otherwise each decide from the row they read before either
    // committed, and both ways of getting that wrong end with a company whose
    // prefix disagrees with its own identifiers:
    //
    //   - Two renames: the second re-keys from the prefix it read, finds the
    //     identifiers the first already moved, and leaves them on the first
    //     rename's prefix while the row carries the second one's.
    //   - A rename plus a stale form that resubmits the original name: the
    //     second sees a name equal to the one it read, skips re-derivation, and
    //     restores the old name on top of the first rename's prefix.
    //
    // Reading the row under the lock makes the second transaction decide from
    // what the first actually committed. Only a managed instance takes this
    // lock, and only for an update that carries a name.
    const locked = await tx
      .select({ name: organizations.name, issuePrefix: organizations.issuePrefix })
      .from(organizations)
      .limit(1)
      .for("update")
      .then((rows) => rows[0] ?? null);
    if (!locked || nextName === locked.name) return null;

    const nextBase = deriveIssuePrefixBase(nextName);
    // A rename that keeps the same base keeps the current prefix, including
    // any disambiguating suffix it was allocated.
    if (nextBase === deriveIssuePrefixBase(locked.name)) return null;
    if (nextBase === locked.issuePrefix) return null;

    const candidate = await pickAvailableIssuePrefix(tx, nextBase);
    if (!candidate || candidate === locked.issuePrefix) return null;
    return { fromPrefix: locked.issuePrefix, toPrefix: candidate };
  }

  async function createCompanyWithUniquePrefix(data: typeof organizations.$inferInsert) {
    const base = deriveIssuePrefixBase(data.name);
    let suffix = 1;
    while (suffix <= MAX_ISSUE_PREFIX_ATTEMPTS) {
      const candidate = `${base}${issuePrefixSuffixForAttempt(suffix)}`;
      try {
        const rows = await db
          .insert(organizations)
          .values({ ...data, issuePrefix: candidate })
          .returning();
        return rows[0];
      } catch (error) {
        if (!isIssuePrefixConflict(error)) throw error;
      }
      suffix += 1;
    }
    throw new Error("Unable to allocate unique issue prefix");
  }

  return {
    list: async () => {
      const rows = await getCompanyQuery(db);
      const hydrated = await hydrateCompanySpend(rows);
      return hydrated.map((row) => enrichCompany(row));
    },

    getById: async (id: string) => {
      // A non-UUID ref would reach the uuid-typed query and throw a
      // DrizzleQueryError (HTTP 500); treat it as not-found instead.
      if (!UUID_RE.test(id)) return null;
      const row = await getCompanyQuery(db)
        .where(eq(organizations.id, id))
        .then((rows) => rows[0] ?? null);
      if (!row) return null;
      const [hydrated] = await hydrateCompanySpend([row], db);
      return enrichCompany(hydrated);
    },

    create: async (data: typeof organizations.$inferInsert) => {
      await assertCanCreateOrganization(db);
      const created = await createCompanyWithUniquePrefix(data);
      await environmentsSvc.ensureLocalEnvironment(created.id);
      await builtInAgents.autoProvisionBundledAgents();
      const row = await getCompanyQuery(db)
        .where(eq(organizations.id, created.id))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Company not found after creation");
      const [hydrated] = await hydrateCompanySpend([row], db);
      return enrichCompany(hydrated);
    },

    update: async (
      id: string,
      data: Partial<typeof organizations.$inferInsert> & { logoAssetId?: string | null },
      actor: CompanyActivityActor = SYSTEM_COMPANY_ACTOR,
    ) => {
      const result = await db.transaction(async (tx) => {
        const existing = await getCompanyQuery(tx)
          .where(eq(organizations.id, id))
          .then((rows) => rows[0] ?? null);
        if (!existing) return null;

        const { logoAssetId, ...companyPatch } = data;
        const willReactivate = existing.status !== "active" && companyPatch.status === "active";
        const willArchive = existing.status !== "archived" && companyPatch.status === "archived";

        if (logoAssetId !== undefined && logoAssetId !== null) {
          const nextLogoAsset = await tx
            .select({ id: assets.id })
            .from(assets)
            .where(eq(assets.id, logoAssetId))
            .then((rows) => rows[0] ?? null);
          if (!nextLogoAsset) throw notFound("Logo asset not found");
        }

        const renamedPrefix = await resolveRenamedIssuePrefix(tx, companyPatch);

        const updated = await tx
          .update(organizations)
          .set({
            ...companyPatch,
            ...(renamedPrefix ? { issuePrefix: renamedPrefix.toPrefix } : {}),
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (!updated) return null;

        let issuePrefixRederived: {
          previousIssuePrefix: string;
          issuePrefix: string;
          issuesRekeyed: number;
          casesRekeyed: number;
        } | null = null;
        if (renamedPrefix) {
          const rekeyed = await rekeyCompanyIssueIdentifiers(tx, {
            fromPrefix: renamedPrefix.fromPrefix,
            toPrefix: renamedPrefix.toPrefix,
          });
          issuePrefixRederived = {
            previousIssuePrefix: renamedPrefix.fromPrefix,
            issuePrefix: renamedPrefix.toPrefix,
            issuesRekeyed: rekeyed.issues,
            casesRekeyed: rekeyed.cases,
          };
        }

        let agentsRestored = 0;
        if (willReactivate) {
          const restoredRows = await tx
            .update(agents)
            .set({
              status: "idle",
              pauseReason: null,
              pausedAt: null,
              updatedAt: new Date(),
            })
            .where(and(
              eq(agents.status, "paused"),
              eq(agents.pauseReason, "company_archived"),
            ))
            .returning({ id: agents.id });
          agentsRestored = restoredRows.length;
        }

        const archiveCascade = willArchive ? await applyArchiveCascadeInTx(tx, id) : null;

        if (logoAssetId !== undefined) {
          await tx
            .update(organizations)
            .set({ logoAssetId, updatedAt: new Date() })
            .where(eq(organizations.id, id));
        }

        if (logoAssetId !== undefined && existing.logoAssetId && existing.logoAssetId !== logoAssetId) {
          await tx.delete(assets).where(eq(assets.id, existing.logoAssetId));
        }

        const [hydrated] = await hydrateCompanySpend([{
          ...updated,
          logoAssetId: logoAssetId === undefined ? existing.logoAssetId : logoAssetId,
        }], tx);

        const shouldLogReactivation = willReactivate &&
          (existing.status === "archived" || agentsRestored > 0);

        return {
          company: enrichCompany(hydrated),
          reactivated: shouldLogReactivation ? { agentsRestored } : null,
          archiveCascade,
          unarchived: willReactivate && existing.status === "archived",
          issuePrefixRederived,
        };
      });
      if (!result) return null;
      // Post-commit, fire-and-forget, and BEFORE any finalization that
      // could throw: a Cloud-pinned primary company that crossed the
      // archived boundary (either direction) rings the harness so the
      // stack itself can converge. The status transaction has already
      // committed, so a later cascade or activity-log failure must not
      // leave Cloud unaware of a company that is in fact archived.
      if (result.archiveCascade || result.unarchived) {
        void notifyCloudOfPrimaryCompanyLifecycleChange();
      }
      if (result.issuePrefixRederived) {
        await logActivity(db, {
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId ?? null,
          runId: actor.runId ?? null,
          action: "company.updated",
          entityType: "company",
          entityId: id,
          details: {
            source: "company_rename",
            reason: "issue_prefix_rederived",
            ...result.issuePrefixRederived,
          },
        });
      }
      if (result.reactivated) {
        await logActivity(db, {
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId ?? null,
          runId: actor.runId ?? null,
          action: "company.reactivated",
          entityType: "company",
          entityId: id,
          details: { agentsRestored: result.reactivated.agentsRestored },
        });
      }
      if (result.archiveCascade) {
        await finalizeArchive(id, actor, result.archiveCascade);
      }
      return result.company;
    },

    archive: async (id: string, actor: CompanyActivityActor = SYSTEM_COMPANY_ACTOR) => {
      const result = await db.transaction(async (tx) => {
        const existing = await tx
          .select({ status: organizations.status })
          .from(organizations)
          .where(eq(organizations.id, id))
          .then((rows) => rows[0] ?? null);
        if (!existing) return null;

        const wasAlreadyArchived = existing.status === "archived";

        if (!wasAlreadyArchived) {
          await tx
            .update(organizations)
            .set({ status: "archived", updatedAt: new Date() })
            .where(eq(organizations.id, id));
        }

        const cascade = wasAlreadyArchived ? null : await applyArchiveCascadeInTx(tx, id);

        const row = await getCompanyQuery(tx)
          .where(eq(organizations.id, id))
          .then((rows) => rows[0] ?? null);
        if (!row) return null;
        const [hydrated] = await hydrateCompanySpend([row], tx);
        return {
          company: enrichCompany(hydrated),
          cascade,
        };
      });
      if (!result) return null;

      // Same doorbell rule as update(): the archive is committed, so ring
      // before finalization, which can throw without undoing it.
      if (result.cascade) {
        void notifyCloudOfPrimaryCompanyLifecycleChange();
        await finalizeArchive(id, actor, result.cascade);
      }

      return result.company;
    },

    remove: (id: string) =>
      db.transaction(async (tx) => {
        // Delete from child tables in dependency order
        const companyRunIds = await tx
          .select({ id: heartbeatRuns.id })
          .from(heartbeatRuns);

        await tx.delete(heartbeatRunEvents);
        if (companyRunIds.length > 0) {
          await tx
            .delete(heartbeatRunEvents)
            .where(inArray(heartbeatRunEvents.runId, companyRunIds.map((run) => run.id)));
        }
        await tx.delete(agentTaskSessions);
        await tx.delete(activityLog);
        await tx.delete(runIdentityContexts);
        await tx.delete(heartbeatRuns);
        await tx.delete(agentWakeupRequests);
        await tx.delete(agentApiKeys);
        await tx.delete(agentRuntimeState);
        await tx.delete(issueComments);
        await tx.delete(costEvents);
        await tx.delete(financeEvents);
        await tx.delete(approvalComments);
        await tx.delete(approvals);
        await tx.delete(companySecrets);
        await tx.delete(joinRequests);
        await tx.delete(invites);
        await tx.delete(principalPermissionGrants);
        await tx.delete(companyMemberships);
        await tx.delete(companySkills);
        await tx.delete(routineRuns);
        await tx.delete(routineTriggers);
        await tx.delete(routineRevisions);
        await tx.delete(routines);
        await tx.delete(issueReadStates);
        await tx.delete(documents);
        await tx.delete(issues);
        await tx.delete(assets);
        await tx.delete(goals);
        await tx.delete(projects);
        await tx.delete(agents);
        const rows = await tx
          .delete(organizations)
          .where(eq(organizations.id, id))
          .returning();
        return rows[0] ?? null;
      }),

    stats: () =>
      Promise.all([
        db.select({ count: count() }).from(agents),
        db.select({ count: count() }).from(issues),
      ]).then(([[agentRow], [issueRow]]) => ({
        agentCount: agentRow?.count ?? 0,
        issueCount: issueRow?.count ?? 0,
      })),
  };
}
