import type {
  Agent,
  ConnectionIntentInteraction,
  AgentDesiredSkillEntry,
  AgentSkillAssignmentMode,
  AgentPermissions,
  AgentDetail,
  AgentInstructionsBundle,
  AgentInstructionHistory,
  AgentInstructionCandidate,
  ResolveAgentInstructionCandidate,
  AgentInstructionDiff,
  AgentInstructionSnapshot,
  AgentInstructionsFileDetail,
  AgentSkillSnapshot,
  AdapterEnvironmentTestResult,
  AdapterAuthSignalResponse,
  AdapterAuthSessionResponse,
  AdapterAuthSessionOwnerResponse,
  ClaudeSetupTokenSessionResponse,
  ClaudeSetupTokenSessionOwnerResponse,
  ClaudeSetupTokenSessionPrompt,
  ClaudeSetupTokenCompletionResponse,
  ClaudeSetupTokenOverwrite,
  ClaudeOAuthTokenStatusResponse,
  SubmitBrowserCodeRequest,
  AgentKeyCreated,
  AgentRuntimeState,
  AgentTaskSession,
  AgentWakeupResponse,
  ChatFailedRunRetryResponse,
  HeartbeatRun,
  Approval,
  AgentConfigRevision,
  ClearAgentErrorResponse,
  AgentApiKeyScope,
} from "@paperclipai/shared";
import { isUuidLike, normalizeAgentUrlKey } from "@paperclipai/shared";
import { ApiError, api } from "./client";

export interface AgentKey {
  id: string;
  name: string;
  scope: AgentApiKeyScope;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface AdapterModel {
  id: string;
  label: string;
}

export interface DetectedAdapterModel {
  model: string;
  provider: string;
  source: string;
  candidates?: string[];
}

export interface ClaudeLoginResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  loginUrl: string | null;
  stdout: string;
  stderr: string;
}

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reports: OrgNode[];
}

export interface AgentHireResponse {
  agent: Agent;
  approval: Approval | null;
}

export interface AgentPermissionUpdate {
  canCreateAgents: boolean;
  canCreateSkills: boolean;
  canAssignTasks: boolean;
  trustPreset?: AgentPermissions["trustPreset"];
  authorizationPolicy?: AgentPermissions["authorizationPolicy"];
}

export interface AgentWakeRequest {
  source?: "timer" | "assignment" | "on_demand" | "automation";
  triggerDetail?: "manual" | "ping" | "callback" | "system";
  reason?: string | null;
  payload?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  forceFreshSession?: boolean;
  debug?: { providerTrace: "raw" };
}

function agentPath(id: string, suffix = "") {
  return `/agents/${encodeURIComponent(id)}${suffix}`;
}

export const agentsApi = {
  adoptAiConnection: (agentId: string, interactionId: string, connectionId: string) =>
    api.post<ConnectionIntentInteraction>(`/agents/${agentId}/connection-intents/${interactionId}/adopt`, { connectionId }),

  list: () => api.get<Agent[]>(`/agents`),
  org: () => api.get<OrgNode[]>(`/org`),
  listConfigurations: () =>
    api.get<Record<string, unknown>[]>(`/agent-configurations`),
  get: async (id: string) => {
    try {
      return await api.get<AgentDetail>(agentPath(id));
    } catch (error) {
      // Backward-compat fallback: if backend shortname lookup reports ambiguity,
      // resolve using the agent list while ignoring terminated agents.
      if (
        !(error instanceof ApiError) ||
        error.status !== 409 ||
        isUuidLike(id)
      ) {
        throw error;
      }

      const urlKey = normalizeAgentUrlKey(id);
      if (!urlKey) throw error;

      const agents = await api.get<Agent[]>(`/agents`);
      const matches = agents.filter(
        (agent) => agent.status !== "terminated" && normalizeAgentUrlKey(agent.urlKey) === urlKey,
      );
      if (matches.length !== 1) throw error;
      return api.get<AgentDetail>(agentPath(matches[0]!.id));
    }
  },
  getConfiguration: (id: string) =>
    api.get<Record<string, unknown>>(agentPath(id, "/configuration")),
  listConfigRevisions: (id: string) =>
    api.get<AgentConfigRevision[]>(agentPath(id, "/config-revisions")),
  getConfigRevision: (id: string, revisionId: string) =>
    api.get<AgentConfigRevision>(agentPath(id, `/config-revisions/${revisionId}`)),
  rollbackConfigRevision: (id: string, revisionId: string) =>
    api.post<Agent>(agentPath(id, `/config-revisions/${revisionId}/rollback`), {}),
  create: (data: Record<string, unknown>) =>
    api.post<Agent>(`/agents`, data),
  hire: (data: Record<string, unknown>) =>
    api.post<AgentHireResponse>(`/agent-hires`, data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Agent>(agentPath(id), data),
  updatePermissions: (id: string, data: AgentPermissionUpdate) =>
    api.patch<AgentDetail>(agentPath(id, "/permissions"), data),
  instructionsBundle: (id: string) =>
    api.get<AgentInstructionsBundle>(agentPath(id, "/instructions-bundle")),
  updateInstructionsBundle: (
    id: string,
    data: {
      mode?: "managed" | "external";
      rootPath?: string | null;
      entryFile?: string;
      clearLegacyPromptTemplate?: boolean;
    },
  ) => api.patch<AgentInstructionsBundle>(agentPath(id, "/instructions-bundle"), data),
  instructionsFile: (id: string, relativePath: string) =>
    api.get<AgentInstructionsFileDetail>(
      agentPath(id, `/instructions-bundle/file?path=${encodeURIComponent(relativePath)}`),
    ),
  saveInstructionsFile: (
    id: string,
    data: { path: string; content: string; baseRevisionId?: string | null; baseHash?: string | null; clearLegacyPromptTemplate?: boolean },
  ) => api.put<AgentInstructionsFileDetail>(agentPath(id, "/instructions-bundle/file"), data),
  instructionCandidates: (id: string) =>
    api.get<AgentInstructionCandidate[]>(agentPath(id, "/instructions-bundle/candidates")),
  resolveInstructionCandidate: (id: string, runId: string, data: ResolveAgentInstructionCandidate) =>
    api.post<AgentInstructionsFileDetail>(agentPath(id, `/instructions-bundle/candidates/${runId}/resolve`), data),
  instructionHistory: (id: string, path: string, cursor?: string) =>
    api.get<AgentInstructionHistory>(agentPath(id, `/instructions-bundle/history?path=${encodeURIComponent(path)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`)),
  instructionRevision: (id: string, path: string, revisionId: string) =>
    api.get<AgentInstructionSnapshot>(agentPath(id, `/instructions-bundle/revision/${revisionId}?path=${encodeURIComponent(path)}`)),
  instructionDiff: (id: string, path: string, from: string, to: string) =>
    api.get<AgentInstructionDiff>(agentPath(id, `/instructions-bundle/diff?path=${encodeURIComponent(path)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)),
  restoreInstructions: (id: string, data: { path: string; revisionId: string; baseRevisionId: string }) =>
    api.post<AgentInstructionsFileDetail>(agentPath(id, "/instructions-bundle/restore"), data),
  downloadInstructionsFile: (id: string, relativePath: string) =>
    `/api${agentPath(id, `/instructions-bundle/file?path=${encodeURIComponent(relativePath)}&download=true`)}`,
  deleteInstructionsFile: (id: string, relativePath: string, baseHash?: string) =>
    api.delete<AgentInstructionsBundle>(
      agentPath(id, `/instructions-bundle/file?path=${encodeURIComponent(relativePath)}${baseHash ? `&baseHash=${baseHash}` : ""}`),
    ),
  pause: (id: string) => api.post<Agent>(agentPath(id, "/pause"), {}),
  resume: (id: string) => api.post<Agent>(agentPath(id, "/resume"), {}),
  clearError: (id: string) =>
    api.post<ClearAgentErrorResponse>(agentPath(id, "/clear-error"), {}),
  approve: (id: string) => api.post<Agent>(agentPath(id, "/approve"), {}),
  terminate: (id: string) => api.post<Agent>(agentPath(id, "/terminate"), {}),
  remove: (id: string) => api.delete<{ ok: true }>(agentPath(id)),
  listKeys: (id: string) => api.get<AgentKey[]>(agentPath(id, "/keys")),
  skills: (id: string) =>
    api.get<AgentSkillSnapshot>(agentPath(id, "/skills")),
  syncSkills: (
    id: string,
    desiredSkills: Array<string | AgentDesiredSkillEntry>,
    mode: AgentSkillAssignmentMode,
  ) => api.post<AgentSkillSnapshot>(agentPath(id, "/skills/sync"), { desiredSkills, mode }),
  createKey: (id: string, name: string, scope?: AgentApiKeyScope) =>
    api.post<AgentKeyCreated>(agentPath(id, "/keys"), { name, ...(scope ? { scope } : {}) }),
  revokeKey: (agentId: string, keyId: string) =>
    api.delete<{ ok: true }>(agentPath(agentId, `/keys/${encodeURIComponent(keyId)}`)),
  runtimeState: (id: string) =>
    api.get<AgentRuntimeState>(agentPath(id, "/runtime-state")),
  taskSessions: (id: string) =>
    api.get<AgentTaskSession[]>(agentPath(id, "/task-sessions")),
  resetSession: (id: string, taskKey?: string | null) =>
    api.post<void>(agentPath(id, "/runtime-state/reset-session"), { taskKey: taskKey ?? null }),
  adapterModels: (
    type: string,
    options?: { refresh?: boolean; environmentId?: string | null; provider?: string; poolId?: string },
  ) => {
    const params = new URLSearchParams();
    if (options?.refresh) params.set("refresh", "1");
    if (options?.provider) params.set("provider", options.provider);
    if (options?.poolId) params.set("poolId", options.poolId);
    if (options?.environmentId) params.set("environmentId", options.environmentId);
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return api.get<AdapterModel[]>(
      `/adapters/${encodeURIComponent(type)}/models${query}`,
    );
  },
  detectModel: (type: string) =>
    api.get<DetectedAdapterModel | null>(
      `/adapters/${encodeURIComponent(type)}/detect-model`,
    ),
  testEnvironment: (
    type: string,
    data: {
      adapterConfig: Record<string, unknown>;
      aiConnection?: import("@paperclipai/shared").AiRuntimeConnectionBinding;
      agentId?: string;
      testCredentials?: Record<string, string>;
      environmentId?: string | null;
    },
  ) =>
    api.post<AdapterEnvironmentTestResult>(
      `/adapters/${type}/test-environment`,
      data,
    ),
  getAdapterAuthSignal: (type: string, environmentId?: string | null) => {
    const query = environmentId ? `?environmentId=${encodeURIComponent(environmentId)}` : "";
    return api.get<AdapterAuthSignalResponse>(
      `/adapters/${encodeURIComponent(type)}/auth-signal${query}`,
    );
  },
  invoke: (id: string, data: AgentWakeRequest = {}) =>
    api.post<HeartbeatRun>(agentPath(id, "/heartbeat/invoke"), data),
  wakeup: (
    id: string,
    data: AgentWakeRequest,
  ) => api.post<AgentWakeupResponse>(agentPath(id, "/wakeup"), data),
  retryFailedRun: async (
    id: string,
    failedRunId: string,
  ) => {
    const result = await api.post<
      AgentWakeupResponse | ChatFailedRunRetryResponse
    >(agentPath(id, "/wakeup"), {
      source: "on_demand",
      triggerDetail: "manual",
      reason: "retry_failed_run",
      failedRunId,
    });
    if ("id" in result) {
      // Exact retries are idempotent: a repeated click can return a successor
      // that has already stopped. It does not mean a new attempt was queued.
      if (["failed", "timed_out", "cancelled", "interrupted"].includes(result.status)) {
        throw new Error(
          "The previous retry has already stopped. Refresh the task and retry its latest failed run.",
        );
      }
      return { runId: result.id, issueId: null };
    }
    if ("actionId" in result) {
      if (result.status === "failed" || result.status === "cancelled") {
        throw new Error(
          "This retry could not start. Open the task to review its current access and recovery state.",
        );
      }
      return { runId: result.runId, issueId: result.issueId };
    }
    throw new Error(result.message ?? "Retry was skipped.");
  },
  loginWithClaude: (id: string) =>
    api.post<ClaudeLoginResult>(agentPath(id, "/claude-login"), {}),
  startAdapterAuthLogin: (
    type: string,
    data: { environmentId: string; ttlSeconds?: number; aiConnection?: import("@paperclipai/shared").AiConnectionLoginIntent },
  ) =>
    api.post<AdapterAuthSessionResponse>(
      `/adapters/${encodeURIComponent(type)}/login-sessions`,
      data,
    ),
  // The owner response repeats the live prompt on every read while the
  // session holds an active public status, so this polling call carries the
  // same no-store request option as the active-session read below.
  getAdapterAuthLoginStatus: (type: string, sessionId: string) =>
    api.get<AdapterAuthSessionOwnerResponse>(
      `/adapters/${encodeURIComponent(type)}/login-sessions/${encodeURIComponent(sessionId)}`,
      { cache: "no-store" },
    ),
  // Reads the caller's active login session for one company and adapter, with
  // no session id, so the browser rediscovers its own session after a reload
  // with no local state. A 404 means no active session for the caller.
  getActiveAdapterAuthLoginSession: (type: string) =>
    api.get<AdapterAuthSessionOwnerResponse>(
      `/adapters/${encodeURIComponent(type)}/login-sessions/active`,
      { cache: "no-store" },
    ),
  cancelAdapterAuthLogin: (type: string, sessionId: string) =>
    api.post<AdapterAuthSessionOwnerResponse>(
      `/adapters/${encodeURIComponent(type)}/login-sessions/${encodeURIComponent(sessionId)}/cancel`,
      {},
    ),
  // The Claude submitted-browser-code login uses the company-and-environment
  // setup-token routes. The route fixes the `claude_local` adapter. The start
  // response carries the panel mode; the authorization URL rides only through the
  // guarded prompt read. The completion response carries a non-secret
  // `storedSessionId` claim and no token.
  // Reads the stored Claude OAuth token status for the authenticated owner. A
  // 200 carries only the secret id and the latest version; a 404 means the owner
  // has no stored value (indistinguishable from a foreign value). The client
  // applies the stored token first and captures the version for a later
  // version-checked overwrite.
  getClaudeOAuthTokenStatus: () =>
    api.get<ClaudeOAuthTokenStatusResponse>(
      `/claude-oauth-token-status`,
    ),
  startClaudeSetupTokenLogin: (
    data: { environmentId: string; overwrite?: ClaudeSetupTokenOverwrite; aiConnection?: import("@paperclipai/shared").AiConnectionLoginIntent },
  ) =>
    api.post<ClaudeSetupTokenSessionOwnerResponse>(
      `/setup-token-login-sessions`,
      { adapterType: "claude_local", ...data },
    ),
  getClaudeSetupTokenLoginStatus: (sessionId: string) =>
    api.get<ClaudeSetupTokenSessionResponse>(
      `/setup-token-login-sessions/${encodeURIComponent(sessionId)}`,
    ),
  // Reads the caller's active Claude setup-token login session, with no
  // session id, so the browser rediscovers its own session after a reload with
  // no local state. A 404 means no active session for the caller.
  getActiveClaudeSetupTokenLoginSession: () =>
    api.get<ClaudeSetupTokenSessionOwnerResponse>(
      `/setup-token-login-sessions/active`,
      { cache: "no-store" },
    ),
  getClaudeSetupTokenLoginPrompt: (sessionId: string) =>
    api.get<ClaudeSetupTokenSessionPrompt>(
      `/setup-token-login-sessions/${encodeURIComponent(sessionId)}/prompt`,
    ),
  submitClaudeSetupTokenBrowserCode: (sessionId: string, browserCode: string) =>
    api.post<ClaudeSetupTokenSessionResponse>(
      `/setup-token-login-sessions/${encodeURIComponent(sessionId)}/code`,
      { browserCode } satisfies SubmitBrowserCodeRequest,
    ),
  completeClaudeSetupTokenLogin: (sessionId: string) =>
    api.post<ClaudeSetupTokenCompletionResponse>(
      `/setup-token-login-sessions/${encodeURIComponent(sessionId)}/completion`,
      {},
    ),
  cancelClaudeSetupTokenLogin: (sessionId: string) =>
    api.post<void>(
      `/setup-token-login-sessions/${encodeURIComponent(sessionId)}/cancel`,
      {},
    ),
  availableSkills: () =>
    api.get<{ skills: AvailableSkill[] }>("/skills/available"),
};

export interface AvailableSkill {
  name: string;
  description: string;
  isPaperclipManaged: boolean;
}
