import { randomUUID } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { aiConnectionPools, aiConnectionRouterCursors, aiConnectionTaskPins, companySecrets, connectionGrants, instanceSettings, plugins, toolApplications, toolConnections, toolConnectionInstalls, type Db } from "@paperclipai/db";
import { aiConnectionRouterAppDefinition, aiConnectionRouterSlug, aiConnectionPoolConfigSchema, isAiConnectionCompatible, type AiConnectionPool, type AiConnectionPoolMember, type AiConnectionRouterRequest, type AiConnectionRouterSelection, type AiConnectionPoolSaveInput, type AiConnectionUsage } from "@paperclipai/shared";
import { isCodexLocalKnownModel, codexLocalReasoningEffortsForModel } from "@paperclipai/adapter-codex-local";
import { models as claudeModels, claudeLocalReasoningEffortsForModel } from "@paperclipai/adapter-claude-local";
import { models as grokModels, grokLocalReasoningEffortsForModel } from "@paperclipai/adapter-grok-local";
import { aiConnectionService } from "./ai-connections.js";
import { instanceSettingsService } from "./instance-settings.js";
import { logActivity } from "./activity-log.js";
import { organizationService } from "./organization.js";
import { forbidden, notFound, conflict, unprocessable } from "../errors.js";
import type { PluginWorkerManager } from "./plugin-worker-manager.js";
import { resolvePaperclipRunnerProviderProfile, resolvePaperclipRunnerNativeProviderInput } from "./native-runtime/provider-profile.js";

const usageCache = new Map<string, { expires: number; value: AiConnectionUsage }>();
const usageInFlight = new Map<string, Promise<AiConnectionUsage | undefined>>();
const routedRuntimeKeys = new Set(["provider", "acpxAgent", "model", "modelReasoningEffort", "reasoningEffort", "effort", "variant"]);
export function applyAiConnectionRouterTaskSettings(config: Record<string, unknown>, selection: AiConnectionRouterSelection) {
  return { ...Object.fromEntries(Object.entries(config).filter(([key]) => !routedRuntimeKeys.has(key))), ...selection.runtimeConfig };
}
export class AiConnectionPoolExhausted extends Error {
  readonly code = "ai_connection_pool_exhausted";
  constructor(readonly retryAt: string, readonly poolId: string) { super("All eligible pool accounts are over their usage limit. Waiting for usage to reset."); }
}

/** Routing can override provider/model only, never environment, permissions, or instructions. */
export function poolMemberRuntimeConfig(member: AiConnectionPoolMember, adapterType: string, overrides: Record<string, unknown> = {}) {
  const notes: string[] = [];
  const provider = member.binding.provider;
  const profile = member.profile;
  const expected = provider === "openai" ? profile.provider === "codex"
    : provider === "anthropic" ? profile.provider === "acpx" && profile.acpxAgent === "claude"
    : provider === "xai" ? profile.provider === "acpx" && profile.acpxAgent === "grok"
    : profile.provider === "opencode";
  if (!expected) throw unprocessable("Pool member harness does not match its account");
  const supportsModel = (value: string) => provider === "openai" ? isCodexLocalKnownModel(value)
    : provider === "anthropic" ? claudeModels.some((m) => m.id === value)
    : provider === "xai" ? grokModels.some((m) => m.id === value) : value.startsWith("openrouter/");
  const config: Record<string, unknown> = { provider: profile.provider, ...(profile.acpxAgent ? { acpxAgent: profile.acpxAgent } : {}), model: profile.model };
  const validate = () => {
    if (!isAiConnectionCompatible(member.binding, adapterType, config.model, config.provider, config.acpxAgent)) throw unprocessable("Pool member is incompatible with this harness");
    if (adapterType === "paperclip_runner") {
      const resolved = resolvePaperclipRunnerProviderProfile(config);
      resolvePaperclipRunnerNativeProviderInput({ backend: resolved.backend, adapterConfig: config });
    }
  };
  validate();
  if (typeof overrides.model === "string" && overrides.model !== profile.model) {
    if (supportsModel(overrides.model)) {
      config.model = overrides.model;
      try { validate(); } catch { config.model = profile.model; notes.push("Model override is unavailable for this member; using its default."); }
    } else notes.push("Model override is unavailable for this member; using its default.");
  }
  const model = String(config.model);
  const efforts = provider === "openai" ? codexLocalReasoningEffortsForModel(model)
    : provider === "anthropic" ? claudeLocalReasoningEffortsForModel(model)
    : provider === "xai" ? grokLocalReasoningEffortsForModel(model) : [];
  // ACPX currently has no qualified effort override; keep that host limitation explicit.
  const effortKey = adapterType === "paperclip_runner" ? profile.provider === "codex" ? "modelReasoningEffort" : null
    : provider === "anthropic" ? "effort" : provider === "xai" ? "reasoningEffort" : provider === "openai" ? "modelReasoningEffort" : "variant";
  const requested = overrides.modelReasoningEffort ?? overrides.reasoningEffort ?? overrides.effort ?? overrides.variant;
  const effort = typeof requested === "string" && efforts.includes(requested) && effortKey ? requested
    : profile.effort && efforts.includes(profile.effort) && effortKey ? profile.effort : null;
  if (requested && requested !== effort) notes.push("Effort override is unavailable for this member; using its default.");
  if (effort && effortKey) config[effortKey] = effort;
  validate();
  return { config, notes };
}

export function aiConnectionRouterService(db: Db, workerManager?: PluginWorkerManager) {
  async function owner(pluginKey: string) {
    const [plugin] = await db.select().from(plugins).where(eq(plugins.pluginKey, pluginKey));
    if (!plugin || plugin.status !== "ready" || !plugin.manifestJson.capabilities.includes("ai.connections.route")) throw unprocessable("Enable a compatible AI connection router plugin");
    return plugin;
  }
  async function enabled() {
    if (!(await instanceSettingsService(db).getExperimental()).enableAiConnectionRouters) throw unprocessable("Ask your instance operator to enable AI connection routing.", { code: "ai_connection_router_disabled" });
  }
  async function catalog() {
    const experimental = (await instanceSettingsService(db).getExperimental()).enableAiConnectionRouters;
    const installed = await db.select().from(plugins);
    return installed.filter(plugin => plugin.status !== "uninstalled" && plugin.manifestJson.aiConnectionRouter && plugin.manifestJson.capabilities.includes("ai.connections.route"))
      .map(plugin => aiConnectionRouterAppDefinition(plugin.pluginKey, plugin.manifestJson.aiConnectionRouter!, {
        available: experimental && plugin.status === "ready",
        ...(!experimental ? { reason: "Ask your instance operator to enable AI connection routing." }
          : plugin.status !== "ready" ? { reason: "Enable the connection pool plugin in Plugins." } : {}),
      }));
  }
  async function list() {
    const rows = await db.select({ pool: aiConnectionPools }).from(aiConnectionPools)
      .innerJoin(toolConnections, eq(toolConnections.id, aiConnectionPools.id))
      .where(ne(toolConnections.status, "archived"));
    return rows.map(({ pool: row }): AiConnectionPool => ({ ...row.config, id: row.id, pluginKey: row.pluginKey, revision: row.revision }));
  }
  async function selectable(userId: string) {
    if (!(await instanceSettingsService(db).getExperimental()).enableAiConnectionRouters) return [];
    const accounts = await aiConnectionService(db).list(userId);
    const result: AiConnectionPool[] = [];
    for (const pool of await list()) {
      if (!pool.enabled) continue;
      try { await owner(pool.pluginKey); } catch { continue; }
      const members = pool.members.filter(member => accounts.some(account => account.id === member.binding.connectionId && account.grantId === member.binding.grantId));
      if (members.length) result.push({ ...pool, members });
    }
    return result;
  }
  async function inspect(poolId: string, userId: string) {
    const pool = (await list()).find(pool => pool.id === poolId);
    if (!pool) throw notFound("Connection pool not found");
    const visible = await aiConnectionService(db).list(userId);
    const result: Record<string, { reason: string; checkedAt: string | null; usage?: AiConnectionUsage }> = {};
    for (const member of pool.members) {
      const account = visible.find(account => account.id === member.binding.connectionId && account.grantId === member.binding.grantId);
      const key = account ? await usageCacheKey(member) : null;
      const cached = key ? usageCache.get(key) : undefined;
      const observation = cached && cached.expires > Date.now() ? cached.value : undefined;
      result[member.id] = { reason: account?.status === "connected" ? "Eligible if agent access permits" : account?.status ?? "Not permitted", checkedAt: account && observation ? observation.checkedAt : null, ...(account && observation ? { usage: observation } : {}) };
    }
    return result;
  }
  async function save(pluginKey: string, input: AiConnectionPoolSaveInput, userId: string) {
    await enabled();
    const plugin = await owner(pluginKey);
    const config = aiConnectionPoolConfigSchema.parse(input.config);
    const visible = await aiConnectionService(db).list(userId);
    for (const member of config.members) {
      if (!visible.some((v) => v.id === member.binding.connectionId && v.grantId === member.binding.grantId)) throw forbidden("Choose an account you may use");
      poolMemberRuntimeConfig(member, "paperclip_runner");
    }
    const id = input.id ?? randomUUID();
    await db.transaction(async (tx) => {
      if (input.id) {
        const [row] = await tx.select().from(aiConnectionPools).where(and(eq(aiConnectionPools.id, id), eq(aiConnectionPools.pluginKey, pluginKey))).for("update");
        if (!row) throw notFound("Connection pool not found");
        const [connection] = await tx.select().from(toolConnections).where(eq(toolConnections.id, id));
        if (!connection || connection.status === "archived") throw notFound("Connection pool not found");
        if (input.expectedRevision !== row.revision) throw conflict("Pool changed; reload before saving");
        await tx.update(aiConnectionPools).set({ config, revision: row.revision + 1, updatedAt: new Date() }).where(eq(aiConnectionPools.id, id));
        await tx.update(toolConnections).set({ name: config.name, enabled: config.enabled, updatedAt: new Date() }).where(eq(toolConnections.id, id));
      } else {
        const key = `plugin:${pluginKey}:ai-router`;
        await tx.insert(toolApplications).values({ applicationKey: key, name: plugin.manifestJson.aiConnectionRouter?.name ?? plugin.manifestJson.displayName, metadata: { sourceTemplateKey: aiConnectionRouterSlug(pluginKey) }, type: "paperclip_plugin", pluginId: plugin.id }).onConflictDoNothing();
        const [application] = await tx.select().from(toolApplications).where(eq(toolApplications.applicationKey, key));
        if (!application) throw new Error("Router application could not be created");
        await tx.insert(toolConnections).values({ id, applicationId: application.id, name: config.name, uid: id, connectionPurpose: "ai", transport: "runtime_auth", enabled: config.enabled, status: "active", healthStatus: "ok", config: { aiRouter: { pluginKey }, sourceTemplateKey: aiConnectionRouterSlug(pluginKey) }, createdByUserId: userId });
        await tx.insert(aiConnectionPools).values({ id, pluginKey, config });
        await tx.insert(aiConnectionRouterCursors).values({ poolId: id });
        const organizationId = await organizationService(tx).findId();
        if (!organizationId) throw notFound("Organization not found");
        await tx.insert(toolConnectionInstalls).values({ connectionId: id, targetType: "company", targetId: organizationId, createdByUserId: userId });
      }
      await logActivity(tx as unknown as Db, { actorType: "user", actorId: userId, action: "ai_connection.pool_saved", entityType: "tool_connection", entityId: id, details: { enabled: config.enabled, memberCount: config.members.length, mode: config.mode } });
    });
    return (await list()).find((p) => p.id === id)!;
  }
  async function remove(poolId: string, expectedRevision: number, userId: string) {
    // Archive the virtual connection; cascading deletion would erase task pins.
    // Cleanup remains available when the experimental flag or plugin is off.
    await db.transaction(async tx => {
      const [row] = await tx.select().from(aiConnectionPools).where(eq(aiConnectionPools.id, poolId)).for("update");
      if (!row) throw notFound("Connection pool not found");
      const [connection] = await tx.select().from(toolConnections).where(eq(toolConnections.id, poolId));
      if (!connection || connection.status === "archived") throw notFound("Connection pool not found");
      if (row.revision !== expectedRevision) throw conflict("Pool changed; reload before deleting");
      await tx.update(aiConnectionPools).set({ config: { ...row.config, enabled: false }, revision: row.revision + 1, updatedAt: new Date() }).where(eq(aiConnectionPools.id, poolId));
      await tx.update(toolConnections).set({ status: "archived", enabled: false, updatedAt: new Date() }).where(eq(toolConnections.id, poolId));
      await logActivity(tx as unknown as Db, { actorType: "user", actorId: userId, action: "ai_connection.pool_deleted", entityType: "tool_connection", entityId: poolId, details: { retainedTaskPins: true } });
    });
    return { ok: true };
  }
  async function usageCacheKey(member: AiConnectionPoolMember) {
    const [grant] = await db.select().from(connectionGrants).where(eq(connectionGrants.id, member.binding.grantId));
    if (!grant) return null;
    const ref = grant.credentialSecretRefs.find((r) => r.configPath === "ai.credential");
    const [secret] = ref ? await db.select({ version: companySecrets.latestVersion }).from(companySecrets).where(eq(companySecrets.id, ref.secretId)) : [];
    return `${grant.id}:${ref?.secretId}:${secret?.version}:${grant.updatedAt.toISOString()}`;
  }
  async function probe(member: AiConnectionPoolMember, userId: string, deadline: number) {
    const key = await usageCacheKey(member);
    if (!key) return undefined;
    const cached = usageCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    let pending = usageInFlight.get(key);
    if (!pending) {
      let probeTimer: ReturnType<typeof setTimeout> | undefined;
      pending = Promise.race([
        aiConnectionService(db).probeUsage(userId, member.binding.connectionId, member.binding.grantId).catch(() => undefined),
        new Promise<undefined>(resolve => { probeTimer = setTimeout(() => resolve(undefined), 15_000); }),
      ]).then(value => {
        if (value) {
          const resets = value.limits.map(v => Date.parse(v.resetsAt ?? "")).filter(v => Number.isFinite(v) && v > Date.now());
          if (usageCache.size > 1000) usageCache.clear();
          usageCache.set(key, { value, expires: Math.min(Date.now() + 60_000, ...resets) });
        }
        return value;
      }).finally(() => { if (probeTimer) clearTimeout(probeTimer); usageInFlight.delete(key); });
      usageInFlight.set(key, pending);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pending,
        new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), Math.max(0, deadline - Date.now())); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }

  async function resolve(input: { poolId: string; agentId: string; userId: string | null; adapterType: string; taskKey: string; overrides?: Record<string, unknown>; existingGrantId?: string; requireExisting?: boolean; persisted?: AiConnectionRouterSelection }) {
    const pinWhere = and(eq(aiConnectionTaskPins.poolId, input.poolId), eq(aiConnectionTaskPins.agentId, input.agentId), eq(aiConnectionTaskPins.taskKey, input.taskKey));
    const validateSelection = async (selection: AiConnectionRouterSelection, client = db) => aiConnectionService(client).select({ agentId: input.agentId, userId: input.userId, adapterType: input.adapterType, binding: selection.binding, model: selection.runtimeConfig.model, runnerProvider: selection.runtimeConfig.provider, acpxAgent: selection.runtimeConfig.acpxAgent });
    if (input.persisted) {
      if (input.persisted.poolId !== input.poolId) throw unprocessable("Persisted pool selection does not match this run");
      const [pin] = await db.select().from(aiConnectionTaskPins).where(pinWhere);
      // Uninstall can remove the virtual connection. Server-owned native recovery
      // evidence still authorizes the original concrete selection, never a new one.
      if (pin && (pin.selection.memberId !== input.persisted.memberId || JSON.stringify(pin.selection.binding) !== JSON.stringify(input.persisted.binding))) throw unprocessable("Persisted pool allocation is inconsistent");
      await validateSelection(input.persisted);
      return input.persisted;
    }
    await enabled();
    for (let attempt = 0; attempt < 20; attempt++) {
      const [record] = await db.select({ pool: aiConnectionPools, connectionStatus: toolConnections.status }).from(aiConnectionPools)
        .innerJoin(toolConnections, eq(toolConnections.id, aiConnectionPools.id))
        .where(eq(aiConnectionPools.id, input.poolId));
      if (!record || record.connectionStatus === "archived") throw unprocessable("This connection pool is unavailable; choose another AI connection");
      const row = record.pool;
      if (!row.config.enabled) throw unprocessable("Enable the selected connection pool");
      const plugin = await owner(row.pluginKey);
      if (!workerManager?.isRunning(plugin.id)) throw unprocessable("The connection router worker is unavailable; retry when it is ready");
      const [pin] = await db.select().from(aiConnectionTaskPins).where(pinWhere);
      const [cursor] = await db.select().from(aiConnectionRouterCursors).where(eq(aiConnectionRouterCursors.poolId, row.id));
      if (!cursor) throw unprocessable("The connection pool cursor is unavailable");
      const pool: AiConnectionPool = { ...row.config, id: row.id, pluginKey: row.pluginKey, revision: row.revision };
      const deadline = Date.now() + 15_000;
      const candidates: AiConnectionRouterRequest["candidates"] = [];
      for (const member of pin ? [pin.member] : pool.members) {
        try {
          const effective = poolMemberRuntimeConfig(member, input.adapterType, input.overrides);
          const selection: AiConnectionRouterSelection = { poolId: row.id, memberId: member.id, binding: member.binding, runtimeConfig: effective.config, notes: effective.notes };
          await validateSelection(selection);
          candidates.push({ member, runtimeConfig: effective.config, notes: effective.notes });
        } catch (error) { if (pin) throw error; }
      }
      if (!pin && input.requireExisting) {
        const existing = candidates.find((candidate) => candidate.member.binding.grantId === input.existingGrantId);
        if (!existing) throw unprocessable("Reset this task session before adopting the connection pool");
        candidates.splice(0, candidates.length, existing);
      }
      if (pool.mode === "usage_aware" && input.userId) {
        // At most four provider calls at once; the shared deadline bounds the whole pool.
        for (let i = 0; i < candidates.length && Date.now() < deadline; i += 4) await Promise.all(candidates.slice(i, i + 4).map(async (candidate) => { candidate.usage = await probe(candidate.member, input.userId!, deadline); }));
      }
      const authorizedPool = { ...pool, members: candidates.map((candidate) => candidate.member) };
      const result = await workerManager.call(plugin.id, "routeAiConnection", { pool: authorizedPool, memberOrder: pool.members.map((member) => member.id), agentId: input.agentId, taskKey: input.taskKey, lastMemberId: cursor.lastMemberId, cursorVersion: cursor.version, ...(pin ? { pinnedMemberId: pin.member.id } : {}), candidates, now: new Date().toISOString() }, 5000);
      if (result.kind === "exhausted") {
        const retry = Date.parse(result.retryAt);
        throw new AiConnectionPoolExhausted(new Date(Number.isFinite(retry) ? Math.max(Date.now() + 1000, retry) : Date.now() + 60_000).toISOString(), pool.id);
      }
      if (result.kind !== "selected") throw unprocessable("No pool account is permitted and compatible for this task");
      const candidate = candidates.find((v) => v.member.id === result.memberId);
      if (!candidate || (pin && candidate.member.id !== pin.member.id)) throw unprocessable("The router returned an unauthorized member");
      const selected: AiConnectionRouterSelection = { poolId: row.id, memberId: candidate.member.id, binding: candidate.member.binding, runtimeConfig: candidate.runtimeConfig, notes: candidate.notes };
      if (pin) return selected;
      const committed = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(aiConnectionRouterCursors).where(eq(aiConnectionRouterCursors.poolId, row.id)).for("update");
        const [existing] = await tx.select().from(aiConnectionTaskPins).where(pinWhere);
        if (existing) return { retry: true };
        const [current] = await tx.select().from(aiConnectionPools).where(eq(aiConnectionPools.id, row.id)).for("share");
        if (!locked || locked.version !== cursor.version || !current || current.revision !== row.revision) return { retry: true };
        const [currentPlugin] = await tx.select().from(plugins).where(eq(plugins.id, plugin.id)).for("share");
        if (currentPlugin?.status !== "ready") throw unprocessable("The router plugin was disabled during allocation");
        await tx.select({ id: instanceSettings.id }).from(instanceSettings).where(eq(instanceSettings.singletonKey, "default")).for("share");
        if (!(await instanceSettingsService(tx as unknown as Db).getExperimental()).enableAiConnectionRouters) throw unprocessable("AI connection routers were disabled during allocation");
        await validateSelection(selected, tx as unknown as Db);
        await tx.insert(aiConnectionTaskPins).values({ poolId: row.id, agentId: input.agentId, taskKey: input.taskKey, selection: selected, member: candidate.member });
        await tx.update(aiConnectionRouterCursors).set({ lastMemberId: candidate.member.id, version: sql`${aiConnectionRouterCursors.version} + 1` }).where(eq(aiConnectionRouterCursors.poolId, row.id));
        await logActivity(tx as unknown as Db, { actorType: "system", actorId: "system", agentId: input.agentId, action: "ai_connection.pool_selected", entityType: "tool_connection", entityId: row.id, details: { memberId: candidate.member.id, connectionId: candidate.member.binding.connectionId, taskKey: input.taskKey } });
        return { retry: false };
      });
      if (!committed.retry) return selected;
    }
    throw conflict("Concurrent pool selections changed the cursor; retry this task");
  }
  return { catalog, list, selectable, inspect, save, remove, resolve };
}
