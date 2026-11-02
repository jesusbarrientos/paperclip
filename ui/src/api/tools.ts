import type { AggregatorAppsResponse, ArcadeDiscoverySetupInput } from "@paperclipai/shared/aggregator-apps";
import type { ComposioAppAccountInput, ComposioAppSetupInput, ComposioAppSetupResult, ComposioAppSnapshot, ComposioAppsResponse } from "@paperclipai/shared";
import type {
  ToolApplication,
  ConfigureRailwaySsh,
  RailwaySshSetup,
  ToolConnection,
  ToolConnectionInstall,
  ToolConnectionInstallSnapshot,
  ToolConnectionRemovalSummary,
  ConnectToolAppResult,
  ConnectToolApp,
  FinishToolAppResult,
  ToolCatalogEntry,
  ToolRuntimeSlot,
  ToolPolicy,
  ToolConnectionHealthCheckResult,
  ToolCatalogRefreshResult,
  ToolAccessDecision,
  ToolAccessDecisionInput,
  CreateToolPolicy,
  DuplicateToolPolicy,
  McpJsonImportPreview,
  ToolRuntimeHealthSummary,
  ToolRunDecisionLookup,
  ToolOAuthStartResult,
  ToolStdioCommandTemplate,
  ToolProfileBinding,
  ToolProfileBindingTargetType,
  ToolProfileDefaultAction,
  ToolProfileEffectiveSummary,
  ToolProfileEntry,
  ToolProfileEntryEffect,
  ToolProfileEntrySelectorType,
  ToolProfileStatus,
  ToolProfileWithDetails,
  ToolProfileNewToolReviewDecision,
  ToolProfileNewToolsReview,
  ToolProfileNewToolsReviewResult,
  ToolRiskLevel,
  UpdateToolPolicy,
  ReorderToolPolicies,
  AppDefinition,
  ToolAppsAttentionResponse,
  ToolConnectionActivityResponse,
  ToolConnectionLifecycleEventType,
  ToolConnectionTestAgentsResponse,
  ToolConnectionTestAgentAccessResponse,
  ToolConnectionTestCallResult,
  ToolConnectionTestCallStatus,
  ToolActionRequest,
  ToolActionRequestStatus,
  ToolActionRequestsResponse,
  ToolMcpGatewayWithTokens,
  ToolMcpGatewayTokenCreated,
  ToolMcpGatewayToken,
  CreateToolMcpGateway,
  CreateToolMcpGatewayToken,
  UpdateToolMcpGateway,
  CreateToolTrustRuleFromActionRequest,
  ToolRedactedValueSummary,
  ConnectionGrant,
  ConnectionGrantKind,
  ConnectionGrantDelegation,
  ConnectionGrantsResponse,
  ToolConnectionCreateCapabilities,
  ToolAppMetadataPreflightResult,
} from "@paperclipai/shared";
import { api, detachInflightGet } from "./client";

/**
 * Tools & Access API client (Phase 6, PAP-10389).
 *
 * Mirrors the governed MCP/tool-access contracts shipped by Phases 2-5
 * (`server/src/routes/tool-access.ts` and `tool-gateway.ts`). The UI consumes
 * server-side enforcement contracts directly instead of faking tool access in
 * the browser.
 */

export type ToolApplicationsResponse = { applications: ToolApplication[] };
export type ToolConnectionsResponse = { connections: ToolConnection[] };
export type ToolCatalogResponse = { catalog: ToolCatalogEntry[] };
export type ToolRuntimeSlotsResponse = { runtimeSlots: ToolRuntimeSlot[] };
export type ToolRuntimeHealthResponse = ToolRuntimeHealthSummary;
export type ToolTrustRulesResponse = { trustRules: ToolPolicy[] };
export type ToolPoliciesResponse = { policies: ToolPolicy[] };
export type ToolProfilesResponse = { profiles: ToolProfileWithDetails[] };
export type ToolGalleryResponse = {
  apps: AppDefinition[];
  capabilities: ToolConnectionCreateCapabilities;
  credentialSources: {
    vercelConnect: {
      available: boolean;
      enabled: boolean;
      authentication: "workload_oidc" | "access_token" | null;
      manageUrl: string;
      reason: string | null;
    };
  };
};
export type ToolMcpGatewaysResponse = { gateways: ToolMcpGatewayWithTokens[] };
export type CloudConnectorEnrollmentStatus = {
  configured: boolean;
  status: "not_configured" | "unenrolled" | "pending" | "active" | "suspended" | "unverified";
  brokerBaseUrl: string;
  instanceId: string | null;
  environment: "development" | "staging" | "production";
  origins: string[];
  verificationUrl?: string;
  expiresAt?: string;
};
export type CreateGatewayTokenInput = Omit<CreateToolMcpGatewayToken, "expiresAt"> & {
  expiresAt?: string | Date | null;
};
export type UpdateGatewayInput = UpdateToolMcpGateway;
export type ReviewNewToolsInput = {
  decisions: Array<{ catalogEntryId: string; decision: ToolProfileNewToolReviewDecision }>;
};

export type StdioTemplateSummary = ToolStdioCommandTemplate;
export type StdioTemplatesResponse = { templates: StdioTemplateSummary[] };

/** Admin "run your own" command-template create input (M8b, PAP-10862). */
export interface CreateStdioTemplateInput {
  templateId: string;
  name: string;
  description?: string | null;
  command: string;
  args?: string[];
  envKeys?: string[];
}

export interface CreateToolApplicationInput {
  name: string;
  description?: string | null;
  type: ToolApplication["type"];
  pluginId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateToolApplicationInput {
  name?: string;
  description?: string | null;
  status?: ToolApplication["status"];
  metadata?: Record<string, unknown> | null;
}

export interface CreateToolConnectionInput {
  applicationId?: string;
  applicationName?: string;
  name: string;
  transport: NonNullable<ToolConnection["transport"]>;
  status?: ToolConnection["status"];
  config?: Record<string, unknown>;
  credentialRefs?: ToolConnection["credentialRefs"];
  enabled?: boolean;
}

export interface UpdateToolConnectionInput {
  agentInstructions?: import("@paperclipai/shared").ConnectionAgentInstructions | null;
  name?: string;
  status?: ToolConnection["status"];
  config?: Record<string, unknown>;
  transportConfig?: Record<string, unknown>;
  credentialRefs?: ToolConnection["credentialRefs"];
  enabled?: boolean;
}

export interface ToolProfileEntryInput {
  selectorType: ToolProfileEntrySelectorType;
  effect?: ToolProfileEntryEffect;
  applicationId?: string | null;
  connectionId?: string | null;
  catalogEntryId?: string | null;
  toolName?: string | null;
  riskLevel?: ToolRiskLevel | null;
  conditions?: Record<string, unknown> | null;
}

export interface CreateToolProfileInput {
  profileKey: string;
  name: string;
  description?: string | null;
  status?: ToolProfileStatus;
  defaultAction?: ToolProfileDefaultAction;
  metadata?: Record<string, unknown> | null;
  entries?: ToolProfileEntryInput[];
}

export interface UpdateToolProfileInput {
  profileKey?: string;
  name?: string;
  description?: string | null;
  status?: ToolProfileStatus;
  defaultAction?: ToolProfileDefaultAction;
  metadata?: Record<string, unknown> | null;
  entries?: ToolProfileEntryInput[];
}

export interface ToolProfileBindingInput {
  targetType: ToolProfileBindingTargetType;
  targetId: string;
  priority?: number;
  metadata?: Record<string, unknown> | null;
}

export type UnbindToolProfileInput = Pick<ToolProfileBindingInput, "targetType" | "targetId">;

/** Redacted tool-gateway audit row (subset of `activity_log`). */
export interface ToolGatewayAuditRow {
  id: string;
  action: string;
  actorType: string | null;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

/** Normalized outcome for the humanized Activity feed. */
export type ToolAuditOutcome =
  | "allowed"
  | "blocked"
  | "asked_first"
  | "waiting"
  | "failed"
  | "unknown";

/**
 * Audit row enriched server-side with humanized display names and a normalized
 * outcome — the shape returned by `GET /tool-gateway/audit`.
 */
export interface ToolGatewayActivityEvent extends ToolGatewayAuditRow {
  agentId: string | null;
  runId: string | null;
  applicationId: string | null;
  connectionId: string | null;
  agentDisplayName: string | null;
  actorDisplayName?: string | null;
  appDisplayName: string | null;
  applicationDisplayName: string | null;
  connectionDisplayName: string | null;
  toolDisplayName: string | null;
  lifecycleType?: ToolConnectionLifecycleEventType | null;
  normalizedOutcome: ToolAuditOutcome;
  invocation: {
    id: string;
    toolName: string;
    status: string;
    policyDecision: string | null;
    approvalState: string;
    argumentsSummary: ToolRedactedValueSummary | null;
    resultSummary: ToolRedactedValueSummary | null;
    resultSizeBytes: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
}

export type ToolGatewayActivityResponse = {
  events: ToolGatewayActivityEvent[];
  nextCursor: string | null;
};

export type ToolAuditWindow = "1h" | "24h" | "7d" | "30d" | "all";

export interface ListActivityParams {
  gateway?: string | null;
  app?: string | null;
  agent?: string | null;
  outcome?: string | null;
  window?: ToolAuditWindow;
  search?: string | null;
  limit?: number;
  cursor?: string | null;
}

export type ToolPolicyTestResponse = {
  decision: ToolAccessDecision;
  auditEvent: unknown | null;
};

export const toolsApi = {
  getCloudConnectorEnrollment: () =>
    api.get<CloudConnectorEnrollmentStatus>("/tools/oauth/cloud-connector/enrollment"),
  startCloudConnectorEnrollment: (label?: string, returnTo?: string) =>
    api.post<CloudConnectorEnrollmentStatus>("/tools/oauth/cloud-connector/enrollment", { label, returnTo }),
  // --- Applications ---
  listGallery: () =>
    api.get<ToolGalleryResponse>(`/tools/gallery`),
  preflightAppMetadata: (galleryKey: string, methodKey?: string | null) => {
    const query = methodKey ? `?methodKey=${encodeURIComponent(methodKey)}` : "";
    return api.get<ToolAppMetadataPreflightResult>(
      `/tools/apps/${encodeURIComponent(galleryKey)}/preflight${query}`,
    );
  },
  connectApp: (input: ConnectToolApp) =>
    api.post<ConnectToolAppResult>(`/tools/apps/connect`, input),
  startOAuth: (
    connectionId: string,
    input: {
      asCurrentUser?: boolean;
      asAgentId?: string;
      interactionId?: string;
    } = {},
  ) =>
    api.post<ToolOAuthStartResult>(`/tools/oauth/${connectionId}/start`, input),
  finalizeOAuthAccess: (
    connectionId: string,
    input: { grantKind: ConnectionGrantKind },
  ) =>
    api.post<FinishToolAppResult>(
      `/tools/apps/${connectionId}/finalize-oauth-access`,
      input,
    ),
  finishApp: (connectionId: string, input: {
    enabledCatalogEntryIds: string[];
    askFirstCatalogEntryIds: string[];
    reviewedCatalogEntryIds?: string[];
    agentInstructions?: import("@paperclipai/shared").ConnectionAgentInstructions | null;
    access: "all_agents" | { agentIds: string[] };
  }) =>
    api.post<FinishToolAppResult>(
      `/tools/apps/${connectionId}/finish`,
      input,
    ),
  listAppsAttention: () =>
    api.get<ToolAppsAttentionResponse>(`/tools/apps/attention`),
  listApplications: () =>
    api.get<ToolApplicationsResponse>(`/tools/applications`),
  createApplication: (input: CreateToolApplicationInput) =>
    api.post<ToolApplication>(`/tools/applications`, input),
  updateApplication: (applicationId: string, input: UpdateToolApplicationInput) =>
    api.patch<ToolApplication>(`/tool-applications/${applicationId}`, input),
  deleteApplication: (applicationId: string) =>
    api.delete<ToolApplication>(`/tool-applications/${applicationId}`),

  // --- Connections ---
  listConnections: () =>
    api.get<ToolConnectionsResponse>(`/tools/connections`),
  getConnection: (connectionId: string) =>
    api.get<ToolConnection>(`/tool-connections/${connectionId}`),
  // --- Installs (Phase 3b, PAP-13618): which agents carry this connection's
  // tools in their runtime context. `installed ⊆ permitted`; the server
  // auto-extends access (adds profile bindings) for any newly-installed target.
  getConnectionInstalls: (connectionId: string) =>
    api.get<{ connectionId: string; installs: ToolConnectionInstall[] }>(
      `/tool-connections/${connectionId}/installs`,
    ),
  putConnectionInstalls: (
    connectionId: string,
    installs: Array<{ targetType: "company" | "agent"; targetId: string }>,
  ) =>
    api.put<ToolConnectionInstallSnapshot>(
      `/tool-connections/${connectionId}/installs`,
      { installs },
    ),
  // --- Identity grants (PAP-17835): who a connection acts as. The response
  // carries server-computed capabilities and the audience member directory, so
  // the UI never rebuilds the permission matrix from `membershipRole`.
  listConnectionGrants: (connectionId: string) =>
    api.get<ConnectionGrantsResponse>(`/tool-connections/${connectionId}/grants`),
  createConnectionGrantDelegation: (connectionId: string, grantId: string, agentId: string) =>
    api.post<ConnectionGrantDelegation>(
      `/tool-connections/${connectionId}/grants/${grantId}/delegations`,
      { agentId },
    ),
  revokeConnectionGrantDelegation: (
    connectionId: string,
    grantId: string,
    delegationId: string,
  ) => api.delete<ConnectionGrantDelegation>(
    `/tool-connections/${connectionId}/grants/${grantId}/delegations/${delegationId}`,
  ),
  revokeConnectionGrant: (connectionId: string, grantId: string) =>
    api.delete<ConnectionGrant>(`/tool-connections/${connectionId}/grants/${grantId}`),
  // An empty `memberUserIds` is the canonical "all organization members".
  // Replacement is atomic server-side, so this never partially widens access.
  replaceConnectionGrantMembers: (connectionId: string, grantId: string, memberUserIds: string[]) =>
    api.put<ConnectionGrant>(
      `/tool-connections/${connectionId}/grants/${grantId}/members`,
      { memberUserIds },
    ),
  /**
   * Start the signed-in user's own personal authorization. `subjectUserId` must
   * be the caller: the server refuses any other subject, so there is no way to
   * initiate consent on someone else's behalf.
   */
  startPersonalAuthorization: (
    connectionId: string,
    input: { subjectUserId: string; scopes?: string[]; returnTo?: string },
  ) =>
    api.post<{ url: string; handoff?: ToolOAuthStartResult["handoff"] }>(
      `/tools/connections/${connectionId}/start-authorization`,
      input,
    ),
  createConnection: (input: CreateToolConnectionInput) =>
    api.post<ToolConnection>(`/tools/connections`, input),
  updateConnection: (connectionId: string, input: UpdateToolConnectionInput) =>
    api.patch<ToolConnection>(`/tool-connections/${connectionId}`, input),
  configureRailwaySsh: (connectionId: string, input: ConfigureRailwaySsh) =>
    api.post<RailwaySshSetup | null>(`/tool-connections/${connectionId}/railway/ssh`, input),
  // Removal is a credential-revoking teardown (PAP-17119), so the response
  // carries the cleanup receipt alongside the archived connection.
  archiveConnection: (connectionId: string) =>
    api.delete<ToolConnection & { removal: ToolConnectionRemovalSummary }>(
      `/tool-connections/${connectionId}`,
    ),
  checkConnectionHealth: (connectionId: string) =>
    api.post<ToolConnectionHealthCheckResult>(`/tool-connections/${connectionId}/health-check`, {}),
  reconnectConnection: (connectionId: string, credentialValues: Record<string, string>) =>
    api.post<ToolConnectionHealthCheckResult>(`/tool-connections/${connectionId}/reconnect`, {
      credentialValues,
    }),
  refreshCatalog: (connectionId: string) =>
    api.post<ToolCatalogRefreshResult>(`/tool-connections/${connectionId}/catalog/refresh`, {}),
  listCatalog: (connectionId: string) =>
    api.get<ToolCatalogResponse>(`/tool-connections/${connectionId}/catalog`),
  listConnectionActivity: (connectionId: string, limit = 20) =>
    api.get<ToolConnectionActivityResponse>(
      `/tool-connections/${connectionId}/activity?limit=${limit}`,
    ),
  listTestAgents: (connectionId: string) =>
    api.get<ToolConnectionTestAgentsResponse>(
      `/tool-connections/${connectionId}/test-agents`,
    ),
  getTestAgentAccess: (connectionId: string, agentId: string) =>
    api.get<ToolConnectionTestAgentAccessResponse>(
      `/tool-connections/${connectionId}/test-agents/${agentId}/access`,
    ),
  setupComposioApp: (connectionId: string, toolkit: string, input: ComposioAppSetupInput) =>
    api.post<ComposioAppSetupResult>(`/tool-connections/${connectionId}/composio/apps/${encodeURIComponent(toolkit)}/setup`, input),
  listAggregatorApps: (connectionId: string) => {
    const path = `/tool-connections/${connectionId}/aggregator/apps`;
    // React Query already deduplicates within a viewing-user key. Path-only
    // request coalescing could hand a previous user's in-flight response to a new account.
    detachInflightGet(path);
    return api.get<AggregatorAppsResponse>(path, { cache: "no-store" });
  },
  syncAggregatorApps: (connectionId: string, force = false) => api.post<AggregatorAppsResponse>(`/tool-connections/${connectionId}/aggregator/apps/sync`, { force }),
  refreshAggregatorApps: (connectionId: string, toolkits: string[] = []) => api.post<AggregatorAppsResponse>(`/tool-connections/${connectionId}/aggregator/apps/refresh`, { toolkits }),
  configureArcadeDiscovery: (connectionId: string, input: ArcadeDiscoverySetupInput) => api.put<AggregatorAppsResponse>(`/tool-connections/${connectionId}/aggregator/discovery`, input),
  listComposioApps: (connectionId: string) => api.get<ComposioAppsResponse>(`/tool-connections/${connectionId}/composio/apps`),
  syncComposioApps: (connectionId: string, force = false) => api.post<ComposioAppsResponse>(`/tool-connections/${connectionId}/composio/apps/sync`, { force }),
  refreshComposioApps: (connectionId: string, toolkits: string[]) => api.post<ComposioAppsResponse>(`/tool-connections/${connectionId}/composio/apps/refresh`, { toolkits }),
  manageComposioAppAccount: (connectionId: string, toolkit: string, input: ComposioAppAccountInput) =>
    api.post<ComposioAppSetupResult & { apps: ComposioAppSnapshot[] }>(`/tool-connections/${connectionId}/composio/apps/${encodeURIComponent(toolkit)}/accounts`, input),
  runTestCall: (
    connectionId: string,
    input: { agentId: string; toolName: string; parameters?: Record<string, unknown> },
  ) =>
    api.post<ToolConnectionTestCallResult>(
      `/tool-connections/${connectionId}/test-calls`,
      input,
    ),
  getTestCallStatus: (connectionId: string, actionRequestId: string) =>
    api.get<ToolConnectionTestCallStatus>(
      `/tool-connections/${connectionId}/test-calls/${actionRequestId}`,
    ),
  importMcpJson: (body: { mcpJson: unknown }) =>
    api.post<McpJsonImportPreview>(`/tools/mcp/import-json`, body),
  listStdioTemplates: () =>
    api.get<StdioTemplatesResponse>(`/tools/stdio-templates`),
  createStdioTemplate: (input: CreateStdioTemplateInput) =>
    api.post<StdioTemplateSummary>(`/tools/stdio-templates`, input),
  disableStdioTemplate: (templateId: string, reason?: string | null) =>
    api.post<StdioTemplateSummary>(
      `/tools/stdio-templates/${encodeURIComponent(templateId)}/disable`,
      { reason: reason ?? null },
    ),

  // --- Profiles ---
  listProfiles: () =>
    api.get<ToolProfilesResponse>(`/tools/profiles`),
  getProfileNewTools: (profileId: string) =>
    api.get<ToolProfileNewToolsReview>(`/tool-profiles/${profileId}/new-tools`),
  reviewProfileNewTools: (profileId: string, input: ReviewNewToolsInput) =>
    api.post<ToolProfileNewToolsReviewResult>(`/tool-profiles/${profileId}/new-tools/review`, input),
  createProfile: (input: CreateToolProfileInput) =>
    api.post<ToolProfileWithDetails>(`/tools/profiles`, input),
  updateProfile: (profileId: string, input: UpdateToolProfileInput) =>
    api.patch<ToolProfileWithDetails>(`/tool-profiles/${profileId}`, input),
  duplicateProfile: (
    profileId: string,
    input: { name: string; includeAssignments?: boolean },
  ) => api.post<ToolProfileWithDetails>(`/tool-profiles/${profileId}/duplicate`, input),
  deleteProfile: (
    profileId: string,
    input: { force?: boolean; reassignToProfileId?: string } = {},
  ) => api.delete<{ deleted: true }>(`/tool-profiles/${profileId}`, input),
  addProfileEntry: (profileId: string, input: ToolProfileEntryInput) =>
    api.post<ToolProfileEntry>(`/tool-profiles/${profileId}/entries`, input),
  updateProfileEntry: (entryId: string, input: Partial<ToolProfileEntryInput>) =>
    api.patch<ToolProfileEntry>(`/tool-profile-entries/${entryId}`, input),
  deleteProfileEntry: (entryId: string) =>
    api.delete<ToolProfileEntry>(`/tool-profile-entries/${entryId}`),
  bindProfile: (profileId: string, input: ToolProfileBindingInput) =>
    api.post<ToolProfileBinding>(`/tools/profiles/${profileId}/bind`, input),
  unbindProfile: (profileId: string, input: UnbindToolProfileInput) =>
    api.post<{ unbound: number }>(`/tools/profiles/${profileId}/unbind`, input),
  getEffectiveProfilesForAgent: (agentId: string) =>
    api.get<ToolProfileEffectiveSummary>(
      `/tools/profiles/effective/agents/${encodeURIComponent(agentId)}`,
    ),

  // --- Runtime ---
  listRuntimeSlots: () =>
    api.get<ToolRuntimeSlotsResponse>(`/tools/runtime-slots`),
  stopRuntimeSlot: (slotId: string) =>
    api.post<ToolRuntimeSlot>(`/tools/runtime-slots/${slotId}/stop`, {}),
  restartRuntimeSlot: (slotId: string) =>
    api.post<ToolRuntimeSlot>(`/tools/runtime-slots/${slotId}/restart`, {}),
  getRuntimeHealth: () =>
    api.get<ToolRuntimeHealthResponse>(`/tools/runtime-health`),
  getRunDecisionLookup: (runId: string) =>
    api.get<ToolRunDecisionLookup>(`/tools/runs/${runId}/decisions`),
  listLiveRuntimeSlots: () =>
    api.get<ToolRuntimeSlot[]>(`/tool-gateway/runtime-slots`),

  // --- Policies (trust rules + decision simulator) ---
  listPolicies: () =>
    api.get<ToolPoliciesResponse>(`/tools/policies`),
  createPolicy: (input: CreateToolPolicy) =>
    api.post<ToolPolicy>(`/tools/policies`, input),
  reorderPolicies: (input: ReorderToolPolicies) =>
    api.post<ToolPoliciesResponse>(`/tools/policies/reorder`, input),
  duplicatePolicy: (policyId: string, input: DuplicateToolPolicy = {}) =>
    api.post<ToolPolicy>(`/tools/policies/${policyId}/duplicate`, input),
  updatePolicy: (policyId: string, input: UpdateToolPolicy) =>
    api.patch<ToolPolicy>(`/tools/policies/${policyId}`, input),
  deletePolicy: (policyId: string) =>
    api.delete<ToolPolicy>(`/tools/policies/${policyId}`),
  listTrustRules: () =>
    api.get<ToolTrustRulesResponse>(`/tools/trust-rules`),
  revokeTrustRule: (policyId: string, reason?: string | null) =>
    api.post<ToolPolicy>(`/tools/trust-rules/${policyId}/revoke`, {
      reason: reason ?? null,
    }),
  testPolicy: (input: ToolAccessDecisionInput) =>
    api.post<ToolPolicyTestResponse>(`/tools/policy/test`, input),

  // --- Review queue (Ask first) ---
  listActionRequests: (status: ToolActionRequestStatus = "pending") =>
    api.get<ToolActionRequestsResponse>(
      `/tools/action-requests?status=${encodeURIComponent(status)}`,
    ),
  approveActionRequest: (actionRequestId: string, rememberAction = false) =>
    api.post<ToolActionRequest>(`/tool-gateway/action-requests/${actionRequestId}/approve`, { rememberAction }),
  declineActionRequest: (actionRequestId: string, reason?: string) =>
    api.post<ToolActionRequest>(`/tool-gateway/action-requests/${actionRequestId}/decline`, { reason }),
  createTrustRuleFromActionRequest: (
    actionRequestId: string,
    input: CreateToolTrustRuleFromActionRequest = {},
  ) =>
    api.post<ToolPolicy>(
      `/tools/action-requests/${actionRequestId}/trust-rule`,
      input,
    ),

  // --- Named MCP gateways ---
  listGateways: () =>
    api.get<ToolMcpGatewaysResponse>(`/tools/gateways`),
  createGateway: (input: CreateToolMcpGateway) =>
    api.post<ToolMcpGatewayWithTokens>(`/tools/gateways`, input),
  updateGateway: (gatewayId: string, input: UpdateGatewayInput) =>
    api.patch<ToolMcpGatewayWithTokens>(`/tool-gateway/gateways/${gatewayId}`, input),
  createGatewayToken: (gatewayId: string, input: CreateGatewayTokenInput) =>
    api.post<ToolMcpGatewayTokenCreated>(`/tool-gateway/gateways/${gatewayId}/tokens`, input),
  revokeGatewayToken: (tokenId: string) =>
    api.post<ToolMcpGatewayToken>(`/tool-gateway/gateway-tokens/${tokenId}/revoke`, {}),

  // --- Audit / Activity ---
  /**
   * Humanized Activity feed with server-side filters and cursor pagination.
   * Returns `{ events, nextCursor }`.
   */
  listActivity: (params: ListActivityParams = {}) => {
    const search = new URLSearchParams();
    if (params.gateway) search.set("gateway", params.gateway);
    if (params.app) search.set("app", params.app);
    if (params.agent) search.set("agent", params.agent);
    if (params.outcome) search.set("outcome", params.outcome);
    // Omitting the window is the API's canonical all-time request. This also
    // keeps the page usable during a rolling restart against an older server
    // that does not recognize the newer explicit `all` value.
    if (params.window && params.window !== "all") search.set("window", params.window);
    if (params.search) search.set("search", params.search);
    if (params.cursor) search.set("cursor", params.cursor);
    search.set("limit", String(params.limit ?? 50));
    return api.get<ToolGatewayActivityResponse>(`/tool-gateway/audit?${search.toString()}`);
  },
  /** Flat audit sample (no pagination) — used by derived counters/banners. */
  listAudit: (limit = 100) =>
    api
      .get<ToolGatewayActivityResponse>(
        `/tool-gateway/audit?window=30d&limit=${Math.min(limit, 100)}`,
      )
      .then((res) => res.events),
};
