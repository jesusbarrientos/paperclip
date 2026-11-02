import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companyMemberships,
  companySecretBindings,
  companySecrets,
  connectionGrantDelegations,
  connectionGrantMembers,
  connectionGrants,
  instanceUserRoles,
  issues,
  principalPermissionGrants,
  toolAccessAuditEvents,
  toolConnections,
  userSecretDeclarations,
} from "@paperclipai/db";
import type { PermissionKey, PrincipalType } from "@paperclipai/shared";
import { conflict } from "../errors.js";
import { assertAssignableAgent } from "./agent-assignability.js";
import { authorizationService, type AuthorizationActor, type AuthorizationResource } from "./authorization.js";
import { ensureHumanRoleDefaultGrants } from "./principal-access-compatibility.js";
import { organizationService } from "./organization.js";

type MembershipRow = typeof companyMemberships.$inferSelect;
type GrantInput = {
  permissionKey: PermissionKey;
  scope?: Record<string, unknown> | null;
};

type MemberArchiveInput = {
  reassignment?: {
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
  } | null;
};

export function accessService(db: Db) {
  const authorization = authorizationService(db);

  async function sweepMemberConnectionAccess(
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    userId: string,
    now: Date,
  ) {
    const departingAudienceRows = await tx.select({
      grantId: connectionGrantMembers.grantId,
    }).from(connectionGrantMembers).where(and(
      eq(connectionGrantMembers.subjectType, "user"),
      eq(connectionGrantMembers.subjectId, userId),
    ));
    const departingAudienceGrantIds = [...new Set(departingAudienceRows.map((row) => row.grantId))];
    const affectedAudienceRows = departingAudienceGrantIds.length === 0 ? [] : await tx.select({
      grantId: connectionGrantMembers.grantId,
      subjectId: connectionGrantMembers.subjectId,
    }).from(connectionGrantMembers).where(and(
      eq(connectionGrantMembers.subjectType, "user"),
      inArray(connectionGrantMembers.grantId, departingAudienceGrantIds),
    ));
    const activeOrganizationAudienceGrants = departingAudienceGrantIds.length === 0 ? [] : await tx.select({
      id: connectionGrants.id,
    }).from(connectionGrants).where(and(
      eq(connectionGrants.kind, "organization"),
      eq(connectionGrants.status, "active"),
      inArray(connectionGrants.id, departingAudienceGrantIds),
    ));
    const activeOrganizationAudienceGrantIds = new Set(activeOrganizationAudienceGrants.map((grant) => grant.id));
    const soleAudienceGrantIds = new Set(departingAudienceGrantIds.filter((grantId) =>
      activeOrganizationAudienceGrantIds.has(grantId)
      && affectedAudienceRows.filter((row) => row.grantId === grantId).length === 1,
    ));

    const ownedGrants = await tx.select({
      id: connectionGrants.id,
      connectionId: connectionGrants.connectionId,
      credentialSecretRefs: connectionGrants.credentialSecretRefs,
    }).from(connectionGrants).where(and(
      eq(connectionGrants.kind, "user"),
      eq(connectionGrants.subjectUserId, userId),
    ));
    const grantIds = ownedGrants.map((grant) => grant.id);
    const ownedGrantIds = new Set(grantIds);
    const affectedConnectionIds = [...new Set(ownedGrants.map((grant) => grant.connectionId))];
    const affectedConnections = new Set(affectedConnectionIds);
    // Membership removal revokes personal connection identities. It must not
    // erase unrelated user-scoped values used by agent or environment secret
    // declarations or bindings. Start with only secrets the departing user's
    // grants explicitly reference, then fail toward retention whenever another
    // consumer still names the secret or its user-secret definition.
    const referencedSecretIds = [...new Set(ownedGrants.flatMap((grant) =>
      grant.credentialSecretRefs.map((ref) => ref.secretId),
    ))];
    const ownedSecrets = referencedSecretIds.length === 0 ? [] : await tx.select({
      id: companySecrets.id,
      userSecretDefinitionId: companySecrets.userSecretDefinitionId,
    }).from(companySecrets).where(and(
      eq(companySecrets.scope, "user"),
      eq(companySecrets.ownerUserId, userId),
      inArray(companySecrets.id, referencedSecretIds),
    ));
    const ownedSecretIds = ownedSecrets.map((secret) => secret.id);
    const ownedSecretSet = new Set(ownedSecretIds);
    const retainedSecretIds = new Set<string>();
    const sharedConnectionSecretIds = new Set<string>();
    let grantMemberRefs: Array<{ grantId: string; subjectId: string }> = [];
    let existingMemberUserIds = new Set<string>();
    let grantRefs: Array<{
      id: string;
      connectionId: string;
      kind: typeof connectionGrants.$inferSelect.kind;
      status: typeof connectionGrants.$inferSelect.status;
      credentialSecretRefs: typeof connectionGrants.$inferSelect.credentialSecretRefs;
    }> = [];
    let connectionRefs: Array<{
      id: string;
      credentialRefs: typeof toolConnections.$inferSelect.credentialRefs;
      credentialSecretRefs: typeof toolConnections.$inferSelect.credentialSecretRefs;
    }> = [];
    if (ownedSecretIds.length > 0) {
      const definitionIds = ownedSecrets.flatMap((secret) =>
        secret.userSecretDefinitionId ? [secret.userSecretDefinitionId] : [],
      );
      const [
        bindingRefs,
        declarationRefs,
        allGrantRefs,
        allConnectionRefs,
        allGrantMemberRefs,
        membershipRefs,
      ] = await Promise.all([
        tx.select({
          secretId: companySecretBindings.secretId,
          targetType: companySecretBindings.targetType,
          targetId: companySecretBindings.targetId,
        }).from(companySecretBindings).where(inArray(companySecretBindings.secretId, ownedSecretIds)),
        definitionIds.length === 0 ? Promise.resolve([]) : tx.select({
          userSecretDefinitionId: userSecretDeclarations.userSecretDefinitionId,
        }).from(userSecretDeclarations).where(inArray(userSecretDeclarations.userSecretDefinitionId, definitionIds)),
        tx.select({
          id: connectionGrants.id,
          connectionId: connectionGrants.connectionId,
          kind: connectionGrants.kind,
          status: connectionGrants.status,
          credentialSecretRefs: connectionGrants.credentialSecretRefs,
        }).from(connectionGrants),
        tx.select({
          id: toolConnections.id,
          credentialRefs: toolConnections.credentialRefs,
          credentialSecretRefs: toolConnections.credentialSecretRefs,
        }).from(toolConnections),
        tx.select({
          grantId: connectionGrantMembers.grantId,
          subjectId: connectionGrantMembers.subjectId,
        }).from(connectionGrantMembers).where(eq(connectionGrantMembers.subjectType, "user")),
        tx.select({ userId: companyMemberships.principalId }).from(companyMemberships).where(and(
          eq(companyMemberships.principalType, "user"),
          ne(companyMemberships.principalId, userId),
        )),
      ]);
      grantRefs = allGrantRefs;
      connectionRefs = allConnectionRefs;
      grantMemberRefs = allGrantMemberRefs;
      existingMemberUserIds = new Set(membershipRefs.map((row) => row.userId));

      for (const binding of bindingRefs) {
        if (binding.targetType !== "tool_connection" || !affectedConnections.has(binding.targetId)) {
          retainedSecretIds.add(binding.secretId);
        }
      }
      const declaredDefinitions = new Set(declarationRefs.map((row) => row.userSecretDefinitionId));
      for (const secret of ownedSecrets) {
        if (secret.userSecretDefinitionId && declaredDefinitions.has(secret.userSecretDefinitionId)) {
          retainedSecretIds.add(secret.id);
        }
      }
      for (const grant of grantRefs) {
        if (ownedGrantIds.has(grant.id)) continue;
        const grantAudience = grantMemberRefs.filter((member) => member.grantId === grant.id);
        const remainingGrantAudience = grantAudience.filter((member) => member.subjectId !== userId);
        const hasSurvivingOrganizationAudience = grant.kind === "organization"
          && grant.status === "active"
          && (
            soleAudienceGrantIds.has(grant.id)
              ? true
              : remainingGrantAudience.length === 0
              ? existingMemberUserIds.size > 0
              : remainingGrantAudience.some((member) => existingMemberUserIds.has(member.subjectId))
          );
        for (const ref of grant.credentialSecretRefs) {
          if (!ownedSecretSet.has(ref.secretId)) continue;
          if (!affectedConnections.has(grant.connectionId)) {
            retainedSecretIds.add(ref.secretId);
          } else if (grant.kind === "user" || hasSurvivingOrganizationAudience) {
            // A connection may temporarily carry separate user grants that
            // reference the same credential, or an organization grant may
            // still have another persisted audience member. A sole named
            // audience row stays persisted instead of being widened to company
            // scope; both resolvers require current active membership, so the
            // row remains dormant until company access is restored. Pending,
            // suspended, and archived memberships are intentionally included
            // because company access can reactivate each of them later.
            retainedSecretIds.add(ref.secretId);
            sharedConnectionSecretIds.add(ref.secretId);
          }
        }
      }
      for (const connection of connectionRefs) {
        if (affectedConnections.has(connection.id)) continue;
        for (const ref of [...connection.credentialRefs, ...connection.credentialSecretRefs]) {
          if (ownedSecretSet.has(ref.secretId)) retainedSecretIds.add(ref.secretId);
        }
      }
    }
    const secretIdsToDelete = ownedSecretIds.filter((secretId) => !retainedSecretIds.has(secretId));
    const connectionSecretIdsToRemove = new Set(
      ownedSecretIds.filter((secretId) => !sharedConnectionSecretIds.has(secretId)),
    );
    const removedDelegations = grantIds.length === 0 ? [] : await tx
      .delete(connectionGrantDelegations)
      .where(inArray(connectionGrantDelegations.grantId, grantIds))
      .returning();
    if (grantIds.length > 0) {
      await tx.update(connectionGrants).set({
        status: "revoked",
        isDefault: false,
        revokedAt: now,
        revokedByUserId: null,
        revokedByAgentId: null,
        updatedAt: now,
      }).where(inArray(connectionGrants.id, grantIds));
    }
    if (ownedSecretIds.length > 0) {
      for (const grant of grantRefs) {
        if (!ownedGrantIds.has(grant.id) && !affectedConnections.has(grant.connectionId)) continue;
        const refsToRemove = ownedGrantIds.has(grant.id) ? ownedSecretSet : connectionSecretIdsToRemove;
        const credentialSecretRefs = grant.credentialSecretRefs.filter(
          (ref) => !refsToRemove.has(ref.secretId),
        );
        if (credentialSecretRefs.length !== grant.credentialSecretRefs.length) {
          await tx.update(connectionGrants).set({
            credentialSecretRefs,
            ...(ownedGrantIds.has(grant.id) || grant.status === "revoked" ? {
              status: "revoked" as const,
              isDefault: false,
            } : {
              status: "needs_reauthorization" as const,
              isDefault: false,
            }),
            updatedAt: now,
          })
            .where(eq(connectionGrants.id, grant.id));
        }
      }
      for (const connection of connectionRefs) {
        if (!affectedConnections.has(connection.id)) continue;
        const credentialRefs = connection.credentialRefs.filter(
          (ref) => !connectionSecretIdsToRemove.has(ref.secretId),
        );
        const credentialSecretRefs = connection.credentialSecretRefs.filter(
          (ref) => !connectionSecretIdsToRemove.has(ref.secretId),
        );
        if (
          credentialRefs.length !== connection.credentialRefs.length ||
          credentialSecretRefs.length !== connection.credentialSecretRefs.length
        ) {
          const hasUnaffectedActiveGrant = grantRefs.some((grant) =>
            grant.connectionId === connection.id
            && !ownedGrantIds.has(grant.id)
            && grant.status === "active"
            && grant.credentialSecretRefs.length > 0
            && grant.credentialSecretRefs.every((ref) => !connectionSecretIdsToRemove.has(ref.secretId)),
          );
          await tx.update(toolConnections).set({
            credentialRefs,
            credentialSecretRefs,
            ...(!hasUnaffectedActiveGrant ? {
              status: "draft" as const,
              enabled: false,
              healthStatus: "missing_secret" as const,
              healthMessage: "Personal credential owner no longer has company access. Reauthorize this connection.",
              lastError: "oauth_reauthorization_required",
            } : {}),
            updatedAt: now,
          })
            .where(eq(toolConnections.id, connection.id));
        }
      }
      if (affectedConnectionIds.length > 0 && connectionSecretIdsToRemove.size > 0) {
        await tx.delete(companySecretBindings).where(and(
          eq(companySecretBindings.targetType, "tool_connection"),
          inArray(companySecretBindings.targetId, affectedConnectionIds),
          inArray(companySecretBindings.secretId, [...connectionSecretIdsToRemove]),
        ));
      }
      if (secretIdsToDelete.length > 0) {
        await tx.delete(companySecrets).where(inArray(companySecrets.id, secretIdsToDelete));
      }
    }
    await tx.delete(connectionGrantMembers).where(and(
      eq(connectionGrantMembers.subjectType, "user"),
      eq(connectionGrantMembers.subjectId, userId),
      soleAudienceGrantIds.size > 0
        ? notInArray(connectionGrantMembers.grantId, [...soleAudienceGrantIds])
        : undefined,
    ));
    if (removedDelegations.length > 0) {
      const connectionByGrant = new Map(ownedGrants.map((grant) => [grant.id, grant.connectionId]));
      await tx.insert(toolAccessAuditEvents).values(removedDelegations.map((delegation) => ({
        connectionId: connectionByGrant.get(delegation.grantId) ?? null,
        actorType: "system",
        actorId: null,
        action: "connection_grant.delegation_revoked",
        outcome: "success",
        reasonCode: "membership_removed",
        details: {
          grantId: delegation.grantId,
          delegationId: delegation.id,
          agentId: delegation.agentId,
          ownerUserId: userId,
        },
      })));
    }
  }

  async function isInstanceAdmin(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;
    const row = await db
      .select({ id: instanceUserRoles.id })
      .from(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
      .then((rows) => rows[0] ?? null);
    return Boolean(row);
  }

  async function getMembership(
    principalType: PrincipalType,
    principalId: string,
  ): Promise<MembershipRow | null> {
    return db
      .select()
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.principalType, principalType),
          eq(companyMemberships.principalId, principalId),
        ),
      )
      .then((rows) => rows[0] ?? null);
  }

  async function hasPermission(
    principalType: PrincipalType,
    principalId: string,
    permissionKey: PermissionKey,
  ): Promise<boolean> {
    return authorization.decidePrincipalGrant({
      principalType,
      principalId,
      permissionKey,
      action: permissionKey,
    }).then((decision) => decision.allowed);
  }

  async function canUser(
    userId: string | null | undefined,
    permissionKey: PermissionKey,
  ): Promise<boolean> {
    return authorization.decide({
      actor: { type: "board", userId },
      action: permissionKey,
      resource: { type: "company" },
    }).then((decision) => decision.allowed);
  }

  async function decide(input: {
    actor: AuthorizationActor;
    action: Parameters<typeof authorization.decide>[0]["action"];
    resource: AuthorizationResource;
    scope?: Record<string, unknown> | null;
  }) {
    return authorization.decide(input);
  }

  async function listMembers() {
    return db
      .select()
      .from(companyMemberships)
      .orderBy(sql`${companyMemberships.createdAt} desc`);
  }

  async function getMemberById(memberId: string) {
    return db
      .select()
      .from(companyMemberships)
      .where(eq(companyMemberships.id, memberId))
      .then((rows) => rows[0] ?? null);
  }

  async function listActiveUserMemberships() {
    return db
      .select()
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.status, "active"),
        ),
      )
      .orderBy(sql`${companyMemberships.createdAt} asc`);
  }

  async function setMemberPermissions(
    memberId: string,
    grants: GrantInput[],
    grantedByUserId: string | null,
  ) {
    const member = await getMemberById(memberId);
    if (!member) return null;

    await db.transaction(async (tx) => {
      await tx
        .delete(principalPermissionGrants)
        .where(
          and(
            eq(principalPermissionGrants.principalType, member.principalType),
            eq(principalPermissionGrants.principalId, member.principalId),
          ),
        );
      if (grants.length > 0) {
        await tx.insert(principalPermissionGrants).values(
          grants.map((grant) => ({
            principalType: member.principalType,
            principalId: member.principalId,
            permissionKey: grant.permissionKey,
            scope: grant.scope ?? null,
            grantedByUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      }
    });

    return member;
  }

  async function updateMemberAndPermissions(
    memberId: string,
    data: {
      membershipRole?: string | null;
      status?: "pending" | "active" | "suspended";
      grants: GrantInput[];
    },
    grantedByUserId: string | null,
  ) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`
        select ${companyMemberships.id}
        from ${companyMemberships}
        where ${companyMemberships.principalType} = 'user'
          and ${companyMemberships.status} = 'active'
          and ${companyMemberships.membershipRole} = 'owner'
        for update
      `);

      const existing = await tx
        .select()
        .from(companyMemberships)
        .where(eq(companyMemberships.id, memberId))
        .for("update")
        .then((rows) => rows[0] ?? null);
      if (!existing) return null;

      const nextMembershipRole =
        data.membershipRole !== undefined ? data.membershipRole : existing.membershipRole;
      const nextStatus = data.status ?? existing.status;

      if (
        existing.principalType === "user" &&
        existing.status === "active" &&
        existing.membershipRole === "owner" &&
        (nextStatus !== "active" || nextMembershipRole !== "owner")
      ) {
        const activeOwnerCount = await tx
          .select({ id: companyMemberships.id })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.principalType, "user"),
              eq(companyMemberships.status, "active"),
              eq(companyMemberships.membershipRole, "owner"),
            ),
          )
          .then((rows) => rows.length);
        if (activeOwnerCount <= 1) {
          throw conflict("Cannot remove the last active owner");
        }
      }

      const now = new Date();
      if (existing.status === "active" && nextStatus !== "active" && existing.principalType === "user") {
        await sweepMemberConnectionAccess(tx, existing.principalId, now);
      }
      const updated = await tx
        .update(companyMemberships)
        .set({
          membershipRole: nextMembershipRole,
          status: nextStatus,
          updatedAt: now,
        })
        .where(eq(companyMemberships.id, existing.id))
        .returning()
        .then((rows) => rows[0] ?? existing);

      await tx
        .delete(principalPermissionGrants)
        .where(
          and(
            eq(principalPermissionGrants.principalType, existing.principalType),
            eq(principalPermissionGrants.principalId, existing.principalId),
          ),
        );
      if (data.grants.length > 0) {
        await tx.insert(principalPermissionGrants).values(
          data.grants.map((grant) => ({
            principalType: existing.principalType,
            principalId: existing.principalId,
            permissionKey: grant.permissionKey,
            scope: grant.scope ?? null,
            grantedByUserId,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      return updated;
    });
  }

  async function assertCanRemoveActiveOwner(
    principalType: PrincipalType,
    status: string,
    membershipRole: string | null,
    tx: Pick<Db, "select">,
  ) {
    if (
      principalType !== "user" ||
      status !== "active" ||
      membershipRole !== "owner"
    ) {
      return;
    }

    const activeOwnerCount = await tx
      .select({ id: companyMemberships.id })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.status, "active"),
          eq(companyMemberships.membershipRole, "owner"),
        ),
      )
      .then((rows) => rows.length);
    if (activeOwnerCount <= 1) {
      throw conflict("Cannot remove the last active owner");
    }
  }

  async function assertAssignableArchiveTarget(
    input: MemberArchiveInput["reassignment"],
    tx: Pick<Db, "select">,
  ) {
    if (!input?.assigneeAgentId && !input?.assigneeUserId) return;
    if (input.assigneeAgentId && input.assigneeUserId) {
      throw conflict("Choose either an agent or user reassignment target");
    }
    if (input.assigneeUserId) {
      const membership = await tx
        .select({ id: companyMemberships.id })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, input.assigneeUserId),
            eq(companyMemberships.status, "active"),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!membership) {
        throw conflict("Replacement user must be an active company member");
      }
      return;
    }

    await assertAssignableAgent(tx as Db, input.assigneeAgentId, { kind: "work" });
  }

  async function archiveMember(memberId: string, input: MemberArchiveInput = {}) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`
        select ${companyMemberships.id}
        from ${companyMemberships}
        where ${companyMemberships.principalType} = 'user'
          and ${companyMemberships.status} = 'active'
          and ${companyMemberships.membershipRole} = 'owner'
        for update
      `);

      const existing = await tx
        .select()
        .from(companyMemberships)
        .where(eq(companyMemberships.id, memberId))
        .for("update")
        .then((rows) => rows[0] ?? null);
      if (!existing) return null;
      if (existing.principalType !== "user") {
        throw conflict("Only human company members can be archived");
      }
      if (existing.status === "archived") {
        return { member: existing, reassignedIssueCount: 0 };
      }
      if (input.reassignment?.assigneeUserId === existing.principalId) {
        throw conflict("Replacement user cannot be the archived member");
      }

      await assertCanRemoveActiveOwner(
        existing.principalType,
        existing.status,
        existing.membershipRole,
        tx,
      );
      await assertAssignableArchiveTarget(input.reassignment, tx);

      const now = new Date();
      await sweepMemberConnectionAccess(tx, existing.principalId, now);
      const assignmentPatch = {
        assigneeAgentId: input.reassignment?.assigneeAgentId ?? null,
        assigneeUserId: input.reassignment?.assigneeUserId ?? null,
        updatedAt: now,
      };
      const assignedOpenIssueWhere = and(
        eq(issues.assigneeUserId, existing.principalId),
        sql`${issues.status} not in ('done', 'cancelled')`,
      );
      const resetInProgress = await tx
        .update(issues)
        .set({
          ...assignmentPatch,
          status: "todo",
          startedAt: null,
          checkoutRunId: null,
          executionRunId: null,
          executionLockedAt: null,
        })
        .where(and(assignedOpenIssueWhere, eq(issues.status, "in_progress")))
        .returning({ id: issues.id });
      const reassigned = await tx
        .update(issues)
        .set(assignmentPatch)
        .where(and(assignedOpenIssueWhere, ne(issues.status, "in_progress")))
        .returning({ id: issues.id });

      await tx
        .delete(principalPermissionGrants)
        .where(
          and(
            eq(principalPermissionGrants.principalType, existing.principalType),
            eq(principalPermissionGrants.principalId, existing.principalId),
          ),
        );

      const archived = await tx
        .update(companyMemberships)
        .set({
          status: "archived",
          updatedAt: now,
        })
        .where(eq(companyMemberships.id, existing.id))
        .returning()
        .then((rows) => rows[0] ?? existing);

      return {
        member: archived,
        reassignedIssueCount: resetInProgress.length + reassigned.length,
      };
    });
  }

  async function promoteInstanceAdmin(userId: string) {
    const existing = await db
      .select()
      .from(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
      .then((rows) => rows[0] ?? null);
    if (existing) return existing;
    return db
      .insert(instanceUserRoles)
      .values({
        userId,
        role: "instance_admin",
      })
      .returning()
      .then((rows) => rows[0]);
  }

  async function demoteInstanceAdmin(userId: string) {
    return db
      .delete(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  async function listUserCompanyAccess(userId: string) {
    const organizationId = await organizationService(db).findId();
    if (!organizationId) return [];
    const rows = await db
      .select()
      .from(companyMemberships)
      .where(and(eq(companyMemberships.principalType, "user"), eq(companyMemberships.principalId, userId)))
      .orderBy(sql`${companyMemberships.createdAt} desc`);
    return rows.map((row) => ({ ...row }));
  }

  async function setUserCompanyAccess(
    userId: string,
    companyIds: string[],
    options: { actorUserId?: string | null } = {},
  ) {
    const organizationId = await organizationService(db).findId();
    const grantAccess = organizationId !== null && companyIds.includes(organizationId);

    await db.transaction(async (tx) => {
      // Serialize every access removal/reactivation with personal OAuth
      // completion, which locks the same membership row before writing secrets.
      const existing = await tx
        .select()
        .from(companyMemberships)
        .where(and(eq(companyMemberships.principalType, "user"), eq(companyMemberships.principalId, userId)))
        .for("update")
        .then((rows) => rows[0] ?? null);

      if (!grantAccess) {
        if (!existing || existing.status === "archived") return;
        if (options.actorUserId && options.actorUserId === userId) {
          throw conflict("You cannot remove yourself");
        }
        if (await isInstanceAdmin(userId)) {
          throw conflict("Instance admins cannot be removed from company access");
        }
        if (existing.membershipRole === "owner" || existing.membershipRole === "admin") {
          throw conflict("Owners and admins cannot be removed from company access");
        }
        const now = new Date();
        await sweepMemberConnectionAccess(tx, existing.principalId, now);
        await tx
          .update(companyMemberships)
          .set({ status: "archived", updatedAt: now })
          .where(eq(companyMemberships.id, existing.id));
        await tx
          .delete(principalPermissionGrants)
          .where(
            and(
              eq(principalPermissionGrants.principalType, "user"),
              eq(principalPermissionGrants.principalId, userId)
            ),
          );
        return;
      }

      if (existing) {
        if (existing.status !== "active") {
          await tx
            .update(companyMemberships)
            .set({
              status: "active",
              membershipRole: existing.membershipRole ?? "operator",
              updatedAt: new Date(),
            })
            .where(eq(companyMemberships.id, existing.id));
        }
        return;
      }
      await tx.insert(companyMemberships).values({
        principalType: "user",
        principalId: userId,
        status: "active",
        membershipRole: "operator",
      });
    });

    return listUserCompanyAccess(userId);
  }

  async function ensureMembership(
    principalType: PrincipalType,
    principalId: string,
    membershipRole: string | null = "member",
    status: "pending" | "active" | "suspended" = "active",
  ) {
    const existing = await getMembership(principalType, principalId);
    if (existing) {
      if (existing.status !== status || existing.membershipRole !== membershipRole) {
        const updated = await db
          .update(companyMemberships)
          .set({ status, membershipRole, updatedAt: new Date() })
          .where(eq(companyMemberships.id, existing.id))
          .returning()
          .then((rows) => rows[0] ?? null);
        return updated ?? existing;
      }
      return existing;
    }

    return db
      .insert(companyMemberships)
      .values({
        principalType,
        principalId,
        status,
        membershipRole,
      })
      .returning()
      .then((rows) => rows[0]);
  }

  async function setPrincipalGrants(
    principalType: PrincipalType,
    principalId: string,
    grants: GrantInput[],
    grantedByUserId: string | null,
  ) {
    await db.transaction(async (tx) => {
      await tx
        .delete(principalPermissionGrants)
        .where(
          and(
            eq(principalPermissionGrants.principalType, principalType),
            eq(principalPermissionGrants.principalId, principalId),
          ),
        );
      if (grants.length === 0) return;
      await tx.insert(principalPermissionGrants).values(
        grants.map((grant) => ({
          principalType,
          principalId,
          permissionKey: grant.permissionKey,
          scope: grant.scope ?? null,
          grantedByUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    });
  }

  async function ensureRoleDefaultGrants(
    principalId: string,
    membershipRole: string | null | undefined,
    grantedByUserId: string | null,
  ) {
    return ensureHumanRoleDefaultGrants(db, {
      principalId,
      membershipRole,
      grantedByUserId,
    });
  }

  async function listPrincipalGrants(
    principalType: PrincipalType,
    principalId: string,
  ) {
    return db
      .select()
      .from(principalPermissionGrants)
      .where(
        and(
          eq(principalPermissionGrants.principalType, principalType),
          eq(principalPermissionGrants.principalId, principalId),
        ),
      )
      .orderBy(principalPermissionGrants.permissionKey);
  }

  async function setPrincipalPermission(
    principalType: PrincipalType,
    principalId: string,
    permissionKey: PermissionKey,
    enabled: boolean,
    grantedByUserId: string | null,
    scope: Record<string, unknown> | null = null,
  ) {
    if (!enabled) {
      await db
        .delete(principalPermissionGrants)
        .where(
          and(
            eq(principalPermissionGrants.principalType, principalType),
            eq(principalPermissionGrants.principalId, principalId),
            eq(principalPermissionGrants.permissionKey, permissionKey),
          ),
        );
      return;
    }

    await ensureMembership(principalType, principalId, "member", "active");

    const existing = await db
      .select()
      .from(principalPermissionGrants)
      .where(
        and(
          eq(principalPermissionGrants.principalType, principalType),
          eq(principalPermissionGrants.principalId, principalId),
          eq(principalPermissionGrants.permissionKey, permissionKey),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (existing) {
      await db
        .update(principalPermissionGrants)
        .set({
          scope,
          grantedByUserId,
          updatedAt: new Date(),
        })
        .where(eq(principalPermissionGrants.id, existing.id));
      return;
    }

    await db.insert(principalPermissionGrants).values({
      principalType,
      principalId,
      permissionKey,
      scope,
      grantedByUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async function updateMember(
    memberId: string,
    data: {
      membershipRole?: string | null;
      status?: "pending" | "active" | "suspended";
    },
  ) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`
        select ${companyMemberships.id}
        from ${companyMemberships}
        where ${companyMemberships.principalType} = 'user'
          and ${companyMemberships.status} = 'active'
          and ${companyMemberships.membershipRole} = 'owner'
        for update
      `);

      const existing = await tx
        .select()
        .from(companyMemberships)
        .where(eq(companyMemberships.id, memberId))
        .for("update")
        .then((rows) => rows[0] ?? null);
      if (!existing) return null;

      const nextMembershipRole =
        data.membershipRole !== undefined ? data.membershipRole : existing.membershipRole;
      const nextStatus = data.status ?? existing.status;

      if (
        existing.principalType === "user" &&
        existing.status === "active" &&
        existing.membershipRole === "owner" &&
        (nextStatus !== "active" || nextMembershipRole !== "owner")
      ) {
        const activeOwnerCount = await tx
          .select({ id: companyMemberships.id })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.principalType, "user"),
              eq(companyMemberships.status, "active"),
              eq(companyMemberships.membershipRole, "owner"),
            ),
          )
          .then((rows) => rows.length);
        if (activeOwnerCount <= 1) {
          throw conflict("Cannot remove the last active owner");
        }
      }

      const now = new Date();
      if (
        existing.principalType === "user" &&
        existing.status !== "suspended" &&
        nextStatus === "suspended"
      ) {
        await sweepMemberConnectionAccess(tx, existing.principalId, now);
      }

      return tx
        .update(companyMemberships)
        .set({
          membershipRole: nextMembershipRole,
          status: nextStatus,
          updatedAt: now,
        })
        .where(eq(companyMemberships.id, existing.id))
        .returning()
        .then((rows) => rows[0] ?? existing);
    });
  }

  return {
    isInstanceAdmin,
    decide,
    projectDiscoveryCandidateIds: authorization.projectDiscoveryCandidateIds,
    canUser,
    hasPermission,
    getMembership,
    getMemberById,
    ensureMembership,
    listMembers,
    listActiveUserMemberships,
    ensureRoleDefaultGrants,
    archiveMember,
    setMemberPermissions,
    updateMemberAndPermissions,
    promoteInstanceAdmin,
    demoteInstanceAdmin,
    listUserCompanyAccess,
    setUserCompanyAccess,
    setPrincipalGrants,
    listPrincipalGrants,
    setPrincipalPermission,
    updateMember,
  };
}
