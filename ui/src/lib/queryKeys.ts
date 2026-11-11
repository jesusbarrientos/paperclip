export const queryKeys = {
  skillSources: {
    preview: (repositoryUrl: string, connectionId: string | null, commitSha: string | null, skillPath: string, filePath: string) => ['skill-sources', 'preview', repositoryUrl, connectionId, commitSha, skillPath, filePath] as const,
    all: () => ["skill-sources"] as const,
    repositories: () => ["skill-source-repositories"] as const,
  },
  agentChats: {
    list: (userId?: string | null) =>
      ["agent-chats", userId] as const,
    detail: (userId: string | null, agentId: string | undefined) =>
      ["agent-chat", userId, agentId] as const,
  },
  organization: ["organization"] as const,
  organizationExportFidelity: ["organization", "export-fidelity"] as const,
  apps: {
    gallery: () => ["apps", "gallery"] as const,
    attention: () => ["apps", "attention"] as const,
  },
  chatEndpoints: {
    list: () => ["chat-endpoints", "list"] as const,
    detail: (endpointId: string) => ["chat-endpoints", "detail", endpointId] as const,
    resources: (endpointId: string) => ["chat-endpoints", endpointId, "resources"] as const,
    principals: (endpointId: string) => ["chat-endpoints", endpointId, "principals"] as const,
    conversations: (endpointId: string) => ["chat-endpoints", endpointId, "conversations"] as const,
    activity: (endpointId: string) => ["chat-endpoints", endpointId, "activity"] as const,
  },
  tools: {
    aggregatorApps: (connectionId: string, userId: string | null) => ["tools", "aggregator-apps", connectionId, userId] as const,
    composioApps: (connectionId: string) => ["tools", "composio-apps", connectionId] as const,
    applications: () =>
      ["tools", "applications"] as const,
    connections: () =>
      ["tools", "connections"] as const,
    connection: (connectionId: string) =>
      ["tools", "connection", connectionId] as const,
    connectionInstalls: (connectionId: string) =>
      ["tools", "connection", connectionId, "installs"] as const,
    connectionGrants: (connectionId: string) =>
      ["tools", "connection", connectionId, "grants"] as const,
    catalog: (connectionId: string) => ["tools", "connection", connectionId, "catalog"] as const,
    connectionActivity: (connectionId: string) =>
      ["tools", "connection", connectionId, "activity"] as const,
    testAgents: (connectionId: string) =>
      ["tools", "connection", connectionId, "test-agents"] as const,
    testAgentAccesses: () => ["tools", "test-agent-access"] as const,
    testAgentAccessesForConnection: (connectionId: string) =>
      ["tools", "test-agent-access", connectionId] as const,
    testAgentAccess: (connectionId: string, agentId: string) =>
      ["tools", "test-agent-access", connectionId, agentId] as const,
    testCallStatus: (connectionId: string, actionRequestId: string) =>
      [
        "tools",
        "connection",
        connectionId,
        "test-calls",
        actionRequestId,
      ] as const,
    actionRequests: (status: string) =>
      ["tools", "action-requests", status] as const,
    gateways: () => ["tools", "gateways"] as const,
    profiles: () => ["tools", "profiles"] as const,
    profileNewTools: (profileId: string) =>
      ["tools", "profiles", profileId, "new-tools"] as const,
    effectiveProfilesForAgent: (agentId: string) =>
      ["tools", "profiles", "effective", "agent", agentId] as const,
    stdioTemplates: () =>
      ["tools", "stdio-templates"] as const,
    runtimeSlots: () =>
      ["tools", "runtime-slots"] as const,
    runtimeHealth: () =>
      ["tools", "runtime-health"] as const,
    runDecisions: (runId: string) =>
      ["tools", "runs", runId, "decisions"] as const,
    liveRuntimeSlots: () =>
      ["tools", "runtime-slots", "live"] as const,
    policies: () => ["tools", "policies"] as const,
    trustRules: () =>
      ["tools", "trust-rules"] as const,
    audit: (limit: number) =>
      ["tools", "audit", limit] as const,
    activity: (
      filters: { gateway?: string; app?: string; agent?: string; outcome?: string; window?: string; search?: string },
    ) =>
      [
        "tools",
        "activity",
        filters.gateway ?? "__all",
        filters.app ?? "__all",
        filters.agent ?? "__all",
        filters.outcome ?? "__all",
        filters.window ?? "24h",
        filters.search ?? "",
      ] as const,
  },
  audit: {
    runs: (agentId?: string | null) =>
      ["audit", "runs", agentId ?? "__all"] as const,
    agentActions: (
      filters: {
        actorScope?: "agents" | "all" | null;
        agentId?: string | null;
        responsibleUserId?: string | null;
        runId?: string | null;
        entityType?: string | null;
        entityId?: string | null;
        action?: string | null;
        from?: string | null;
        to?: string | null;
        actorType?: string | null;
      },
    ) =>
      [
        "audit",
        "agent-actions",
        filters.actorScope ?? "agents",
        filters.agentId ?? "__all",
        filters.responsibleUserId ?? "__all",
        filters.runId ?? "__all",
        filters.entityType ?? "__all",
        filters.entityId ?? "__all",
        filters.action ?? "__all",
        filters.actorType ?? "__all",
        filters.from ?? "",
        filters.to ?? "",
      ] as const,
  },
  smokeLab: {
    services: () =>
      ["smoke-lab", "services"] as const,
    runs: () => ["smoke-lab", "runs"] as const,
    run: (runId: string) =>
      ["smoke-lab", "runs", runId] as const,
  },
  companySkills: {
    list: () => ["company-skills"] as const,
    listRecent: () =>
      ["company-skills", "recent-updated"] as const,
    detail: (skillId: string) =>
      ["company-skills", skillId] as const,
    versions: (skillId: string) =>
      ["company-skills", skillId, "versions"] as const,
    comments: (skillId: string) =>
      ["company-skills", skillId, "comments"] as const,
    updateStatus: (skillId: string) =>
      ["company-skills", skillId, "update-status"] as const,
    forkPrecheck: (skillId: string) =>
      ["company-skills", skillId, "fork-precheck"] as const,
    file: (skillId: string, relativePath: string) =>
      ["company-skills", skillId, "file", relativePath] as const,
    catalog: (filters: { kind?: string; category?: string; q?: string } = {}) =>
      [
        "company-skills",
        "catalog",
        filters.kind ?? "__all-kinds__",
        filters.category ?? "__all-categories__",
        filters.q ?? "",
      ] as const,
    catalogDetail: (catalogRef: string) =>
      ["company-skills", "catalog", "detail", catalogRef] as const,
    catalogFile: (catalogRef: string, relativePath: string) =>
      ["company-skills", "catalog", "file", catalogRef, relativePath] as const,
    testInputs: (skillId: string) =>
      ["company-skills", skillId, "test-inputs"] as const,
    testRunTemplates: () =>
      ["company-skills", "test-run-templates"] as const,
    testRuns: (skillId: string, inputId?: string | null) =>
      [
        "company-skills",
        skillId,
        "test-runs",
        inputId ?? "__all-inputs__",
      ] as const,
    testRunDetail: (skillId: string, runId: string) =>
      ["company-skills", skillId, "test-run", runId] as const,
  },
  teamCatalog: {
    catalog: (filters: { kind?: string; category?: string; q?: string } = {}) =>
      [
        "team-catalog",
        "catalog",
        filters.kind ?? "__all-kinds__",
        filters.category ?? "__all-categories__",
        filters.q ?? "",
      ] as const,
    catalogDetail: (catalogRef: string) =>
      ["team-catalog", "catalog", "detail", catalogRef] as const,
    catalogFile: (catalogRef: string, relativePath: string) =>
      ["team-catalog", "catalog", "file", catalogRef, relativePath] as const,
    installed: () =>
      ["team-catalog", "installed"] as const,
  },
  agents: {
    list: () => ["agents", "list"] as const,
    detail: (id: string) => ["agents", "detail", id] as const,
    runtimeState: (id: string) => ["agents", "runtime-state", id] as const,
    taskSessions: (id: string) => ["agents", "task-sessions", id] as const,
    skills: (id: string) => ["agents", "skills", id] as const,
    instructionsBundle: (id: string) =>
      ["agents", "instructions-bundle", id] as const,
    instructionCandidates: (id: string) =>
      ["agents", "instruction-candidates", id] as const,
    instructionsFile: (id: string, relativePath: string) =>
      ["agents", "instructions-bundle", id, "file", relativePath] as const,
    keys: (agentId: string) => ["agents", "keys", agentId] as const,
    configRevisions: (agentId: string) =>
      ["agents", "config-revisions", agentId] as const,
    adapterModels: (
      adapterType: string,
      environmentId?: string | null,
      provider?: string,
    ) =>
      [
        "agents",
        "adapter-models",
        adapterType,
        environmentId ?? null,
        provider ?? null,
      ] as const,
    detectModel: (adapterType: string) =>
      ["agents", "detect-model", adapterType] as const,
    authSignal: (adapterType: string, environmentId?: string | null) =>
      ["agents", "auth-signal", adapterType, environmentId ?? null] as const,
    activeLoginSession: (adapterType: string) =>
      ["agents", "active-login-session", adapterType] as const,
  },
  builtInAgents: {
    list: () => ["built-in-agents"] as const,
  },
  summarySlots: {
    detail: (
      scopeKind: string,
      slotKey: string,
      scopeId?: string | null,
    ) =>
      [
        "summary-slots",
        scopeKind,
        slotKey,
        scopeId ?? null,
      ] as const,
    revisions: (
      scopeKind: string,
      slotKey: string,
      scopeId?: string | null,
    ) =>
      [
        "summary-slots",
        scopeKind,
        slotKey,
        scopeId ?? null,
        "revisions",
      ] as const,
  },
  statusCards: {
    list: (archived: boolean) =>
      ["status-cards", archived ? "archived" : "active"] as const,
    detail: (id: string) => ["status-cards", "detail", id] as const,
    updates: (id: string) => ["status-cards", "detail", id, "updates"] as const,
    summaryRevisions: (id: string) =>
      ["status-cards", "detail", id, "summary-revisions"] as const,
    dryRun: (id: string) => ["status-cards", "detail", id, "dry-run"] as const,
  },
  issues: {
    list: () => ["issues", "list"] as const,
    mentionPool: () =>
      ["issues", "list", "mention-pool"] as const,
    search: (
      q: string,
      projectId?: string,
      limit?: number,
    ) =>
      [
        "issues",
        "list",
        "search",
        q,
        projectId ?? "__all-projects__",
        limit ?? "__no-limit__",
      ] as const,
    listAssignedToMe: () =>
      ["issues", "list", "assigned-to-me"] as const,
    listMineByMe: () =>
      ["issues", "list", "mine-by-me"] as const,
    listTouchedByMe: () =>
      ["issues", "list", "touched-by-me"] as const,
    listUnreadTouchedByMe: () =>
      ["issues", "list", "unread-touched-by-me"] as const,
    listBlockedAttention: () =>
      ["issues", "list", "blocked-attention"] as const,
    countBlockedAttention: () =>
      ["issues", "list", "blocked-attention", "count"] as const,
    labels: () => ["issues", "list", "labels"] as const,
    listByProject: (projectId: string) =>
      ["issues", "list", "project", projectId] as const,
    listPluginOperationsByProject: (
      projectId: string,
      originKindPrefix: string,
    ) =>
      [
        "issues",
        "list",
        "project",
        projectId,
        "plugin-operations",
        originKindPrefix,
      ] as const,
    listParticipatedByAgent: (agentId: string) =>
      ["issues", "list", "participated-by-agent", agentId] as const,
    listByParent: (parentId: string) =>
      ["issues", "list", "parent", parentId] as const,
    listCreatedFromIssue: (issueId: string) =>
      ["issues", "list", "created-from", issueId] as const,
    listByDescendantRoot: (rootIssueId: string) =>
      ["issues", "list", "descendants", rootIssueId] as const,
    listByExecutionWorkspace: (
      executionWorkspaceId: string,
    ) =>
      [
        "issues",
        "list",
        "execution-workspace",
        executionWorkspaceId,
      ] as const,
    detail: (id: string) => ["issues", "detail", id] as const,
    comments: (issueId: string) => ["issues", "comments", issueId] as const,
    commentsList: (issueId: string) =>
      ["issues", "comments", issueId, "list"] as const,
    queuedComments: (issueId: string) =>
      ["issues", "queued-comments", issueId] as const,
    interactions: (issueId: string) =>
      ["issues", "interactions", issueId] as const,
    acceptedPlanDecompositions: (issueId: string) =>
      ["issues", "accepted-plan-decompositions", issueId] as const,
    feedbackVotes: (issueId: string) =>
      ["issues", "feedback-votes", issueId] as const,
    costSummary: (issueId: string, options: { excludeRoot?: boolean } = {}) =>
      options.excludeRoot
        ? (["issues", "cost-summary", issueId, "exclude-root"] as const)
        : (["issues", "cost-summary", issueId] as const),
    attachments: (issueId: string) =>
      ["issues", "attachments", issueId] as const,
    attachmentPreview: (attachmentId: string) =>
      ["issues", "attachment-preview", attachmentId] as const,
    documents: (issueId: string) => ["issues", "documents", issueId] as const,
    document: (issueId: string, key: string) =>
      ["issues", "document", issueId, key] as const,
    documentRevisions: (issueId: string, key: string) =>
      ["issues", "document-revisions", issueId, key] as const,
    documentAnnotations: (
      issueId: string,
      key: string,
      status: "open" | "resolved" | "all" = "all",
    ) => ["issues", "document-annotations", issueId, key, status] as const,
    activity: (issueId: string) => ["issues", "activity", issueId] as const,
    runs: (issueId: string) => ["issues", "runs", issueId] as const,
    approvals: (issueId: string) => ["issues", "approvals", issueId] as const,
    liveRuns: (issueId: string) => ["issues", "live-runs", issueId] as const,
    activeRun: (issueId: string) => ["issues", "active-run", issueId] as const,
    runnerGoal: (issueId: string, agentId?: string | null) =>
      ["issues", "runner-goal", issueId, agentId ?? "__effective__"] as const,
    workProducts: (issueId: string) =>
      ["issues", "work-products", issueId] as const,
    fileResources: (
      issueId: string,
      options: {
        workspace?: string;
        projectId?: string | null;
        workspaceId?: string | null;
        path?: string | null;
        mode?: string;
        q?: string | null;
        limit?: number;
        offset?: number;
      } = {},
    ) => ["issues", "file-resources", issueId, "list", options] as const,
    fileResource: (
      issueId: string,
      query: {
        path: string;
        workspace?: string;
        projectId?: string | null;
        workspaceId?: string | null;
      },
    ) => ["issues", "file-resources", issueId, "resolve", query] as const,
    fileResourceContent: (
      issueId: string,
      query: {
        path: string;
        workspace?: string;
        projectId?: string | null;
        workspaceId?: string | null;
      },
    ) => ["issues", "file-resources", issueId, "content", query] as const,
    /**
     * Batched availability preflight. `refKeys` are the deduplicated,
     * lexicographically sorted reference keys in the request so identical
     * batches share one cache entry.
     */
    fileResourceAvailability: (issueId: string, refKeys: readonly string[]) =>
      ["issues", "file-resources", issueId, "availability", refKeys] as const,
  },
  routines: {
    list: (filters?: { projectId?: string | null }) =>
      [
        "routines",
        filters?.projectId ?? "__all-projects__",
      ] as const,
    detail: (id: string) => ["routines", "detail", id] as const,
    runs: (id: string) => ["routines", "runs", id] as const,
    revisions: (id: string) => ["routines", "revisions", id] as const,
    activity: (id: string) =>
      ["routines", "activity", id] as const,
    documentAnnotations: (
      routineId: string,
      key: "description",
      status: "open" | "resolved" | "all" = "all",
    ) => ["routines", "document-annotations", routineId, key, status] as const,
  },
  folders: {
    list: (kind: string) =>
      ["folders", kind] as const,
  },
  pipelines: {
    list: () => ["pipelines", "list"] as const,
    detail: (pipelineId: string) =>
      ["pipelines", "detail", pipelineId] as const,
    cases: (pipelineId: string) => ["pipelines", "cases", pipelineId] as const,
    caseDetail: (caseId: string) => ["pipelines", "item", caseId] as const,
    caseChildren: (caseId: string) =>
      ["pipelines", "item", caseId, "children"] as const,
    caseEvents: (caseId: string) =>
      ["pipelines", "item", caseId, "events"] as const,
    caseIssueLinks: (caseId: string) =>
      ["pipelines", "item", caseId, "issue-links"] as const,
    caseOutputs: (caseId: string) =>
      ["pipelines", "item", caseId, "outputs"] as const,
    caseDocument: (caseId: string, key: string) =>
      ["pipelines", "item", caseId, "document", key] as const,
    caseDocumentRevisions: (caseId: string, key: string) =>
      ["pipelines", "item", caseId, "document-revisions", key] as const,
    intakeForm: (pipelineId: string) =>
      ["pipelines", "intake-form", pipelineId] as const,
    health: (pipelineId: string) =>
      ["pipelines", "health", pipelineId] as const,
    document: (pipelineId: string, key: string) =>
      ["pipelines", "document", pipelineId, key] as const,
    documentRevisions: (pipelineId: string, key: string) =>
      ["pipelines", "document-revisions", pipelineId, key] as const,
    attention: () =>
      ["pipelines", "attention"] as const,
    reviewCases: () =>
      ["pipelines", "review-cases"] as const,
    learnings: (offset: number) =>
      ["pipelines", "learnings", offset] as const,
  },
  executionWorkspaces: {
    list: (
      filters?: Record<string, string | boolean | undefined>,
    ) => ["execution-workspaces", filters ?? {}] as const,
    summaryList: (
      filters?: Record<string, string | boolean | undefined>,
    ) => ["execution-workspaces", "summary", filters ?? {}] as const,
    overview: (
      filters?: Record<string, string | number | boolean | undefined>,
    ) =>
      ["execution-workspaces", "overview", filters ?? {}] as const,
    detail: (id: string) => ["execution-workspaces", "detail", id] as const,
    closeReadiness: (id: string) =>
      ["execution-workspaces", "close-readiness", id] as const,
    workspaceOperations: (id: string) =>
      ["execution-workspaces", "workspace-operations", id] as const,
  },
  machines: {
    list: () => ["machines", "list"] as const,
    pairing: (machineId: string, token: string) => ["machines", "pairing", machineId, token] as const,
  },
  workContexts: {
    all: () => ["work-context"] as const,
    detail: (issueId: string) => ["work-context", issueId] as const,
  },
  environments: {
    list: () => ["environments", "list"] as const,
    capabilities: () =>
      ["environment-capabilities"] as const,
    customImageTemplate: (environmentId: string) =>
      ["environments", environmentId, "custom-image-template"] as const,
    customImageSetupSession: (sessionId: string) =>
      ["environment-custom-image-setup-sessions", sessionId] as const,
  },
  projects: {
    all: () => ["projects", "list"] as const,
    list: (opts: { includeArchived?: boolean } = {}) =>
      [
        "projects",
        "list",
        { includeArchived: opts.includeArchived === true },
      ] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
    clonedRepositories: (id: string) => ["projects", "cloned-repositories", id] as const,
  },
  cases: {
    list: () => ["cases", "list"] as const,
    detail: (id: string) => ["cases", "detail", id] as const,
    documents: (id: string) => ["cases", "documents", id] as const,
    documentAnnotations: (
      caseId: string,
      key: string,
      status: "open" | "resolved" | "all" = "all",
    ) => ["cases", "document-annotations", caseId, key, status] as const,
    events: (id: string) => ["cases", "events", id] as const,
    children: (parentId: string) => ["cases", "children", parentId] as const,
    revisions: (id: string, key: string) =>
      ["cases", "revisions", id, key] as const,
    forIssue: (issueId: string) => ["cases", "for-issue", issueId] as const,
  },
  externalObjects: {
    byIssue: (issueId: string) =>
      ["external-objects", "by-issue", issueId] as const,
    issueSummary: (issueId: string) =>
      ["external-objects", "issue-summary", issueId] as const,
    issueSummaries: (issueIds: readonly string[]) =>
      ["external-objects", "issue-summaries", issueIds] as const,
    projectSummary: (projectId: string) =>
      ["external-objects", "project-summary", projectId] as const,
  },
  goals: {
    list: () => ["goals", "list"] as const,
    detail: (id: string) => ["goals", "detail", id] as const,
  },
  artifacts: {
    list: (
      kind?: string,
      q?: string,
      groupBy?: string,
      groupIssueId?: string,
    ) =>
      [
        "artifacts",
        kind ?? "all",
        q ?? "",
        groupBy ?? "none",
        groupIssueId ?? "",
      ] as const,
    byAgent: (agentId: string) =>
      ["artifacts", "by-agent", agentId] as const,
  },
  budgets: {
    overview: () =>
      ["budgets", "overview"] as const,
  },
  approvals: {
    list: (status?: string) =>
      ["approvals", status] as const,
    detail: (approvalId: string) =>
      ["approvals", "detail", approvalId] as const,
    comments: (approvalId: string) =>
      ["approvals", "comments", approvalId] as const,
    issues: (approvalId: string) =>
      ["approvals", "issues", approvalId] as const,
  },
  access: {
    invites: (state: string = "all", limit: number = 20) =>
      ["access", "invites", "paginated-v1", state, limit] as const,
    joinRequests: (status: string = "pending_approval") =>
      ["access", "join-requests", status] as const,
    companyMembers: () =>
      ["access", "company-members"] as const,
    companyUserDirectory: () =>
      ["access", "company-user-directory"] as const,
    adminUsers: (query: string) => ["access", "admin-users", query] as const,
    userCompanyAccess: (userId: string) =>
      ["access", "user-company-access", userId] as const,
    invite: (token: string) => ["access", "invite", token] as const,
    currentBoardAccess: ["access", "current-board-access"] as const,
  },
  auth: {
    session: ["auth", "session"] as const,
  },
  inboxAgentPolicy: {
    mine: () =>
      ["inbox-agent-policy", "me"] as const,
  },
  sidebarPreferences: {
    projectOrder: (userId: string) =>
      ["sidebar-preferences", "project-order", userId] as const,
  },
  resourceMemberships: {
    mine: () =>
      ["resource-memberships", "me"] as const,
  },
  instance: {
    settings: ["instance", "settings"] as const,
    generalSettings: ["instance", "general-settings"] as const,
    experimentalSettings: ["instance", "experimental-settings"] as const,
  },
  health: ["health"] as const,
  stagingCommit: ["staging-commit"] as const,
  cloud: {
    stacks: ["cloud", "stacks"] as const,
  },
  secrets: {
    list: () => ["secrets", "list"] as const,
    providers: () => ["secret-providers"] as const,
    providerConfigs: () =>
      ["secret-provider-configs"] as const,
    usage: (secretId: string) => ["secrets", "usage", secretId] as const,
    accessEvents: (secretId: string) =>
      ["secrets", "access-events", secretId] as const,
    userDefinitions: () =>
      ["user-secret-definitions"] as const,
    userDefinitionCoverage: (definitionId: string) =>
      ["user-secret-definitions", definitionId, "coverage"] as const,
    myUserSecrets: () =>
      ["my-user-secrets"] as const,
    proposals: (status: string = "pending") =>
      ["secret-proposals", status] as const,
  },
  companySearch: {
    search: (
      q: string,
      scope: string,
      limit: number,
      offset: number,
    ) => ["company-search", q, scope, limit, offset] as const,
  },
  dashboard: () => ["dashboard"] as const,
  attention: () => ["attention"] as const,
  decisions: {
    list: (status?: string) =>
      ["decisions", status ?? "__all-statuses__"] as const,
    detail: (id: string) => ["decisions", "detail", id] as const,
    forTargetIssue: (issueId: string) =>
      ["decisions", "target", issueId] as const,
  },
  decisionQueues: {
    list: () => ["decision-queues"] as const,
    items: (key: string) =>
      ["decision-queues", "items", key] as const,
    seedRules: () =>
      ["decision-queues", "seed-rules"] as const,
    triage: (sourceKind: string, sourceId: string) =>
      ["decision-triage", sourceKind, sourceId] as const,
  },
  workTimeline: (lens?: string) =>
    ["work-timeline", lens ?? "all"] as const,
  userProfile: (userSlug: string) =>
    ["user-profile", userSlug] as const,
  sidebarBadges: () => ["sidebar-badges"] as const,
  inboxDismissals: () =>
    ["inbox-dismissals"] as const,
  activity: () => ["activity"] as const,
  costs: (from?: string, to?: string) =>
    ["costs", from, to] as const,
  usageByProvider: (from?: string, to?: string) =>
    ["usage-by-provider", from, to] as const,
  usageByBiller: (from?: string, to?: string) =>
    ["usage-by-biller", from, to] as const,
  financeSummary: (from?: string, to?: string) =>
    ["finance-summary", from, to] as const,
  financeByBiller: (from?: string, to?: string) =>
    ["finance-by-biller", from, to] as const,
  financeByKind: (from?: string, to?: string) =>
    ["finance-by-kind", from, to] as const,
  financeEvents: (
    from?: string,
    to?: string,
    limit: number = 100,
  ) => ["finance-events", from, to, limit] as const,
  usageWindowSpend: () =>
    ["usage-window-spend"] as const,
  usageQuotaWindows: () =>
    ["usage-quota-windows"] as const,
  heartbeats: (agentId?: string) =>
    ["heartbeats", agentId] as const,
  runDetail: (runId: string) => ["heartbeat-run", runId] as const,
  providerTraceMetadata: (runIds: readonly string[]) =>
    ["provider-trace-metadata", [...runIds].sort()] as const,
  runWorkspaceOperations: (runId: string) =>
    ["heartbeat-run", runId, "workspace-operations"] as const,
  liveRuns: () => ["live-runs"] as const,
  runIssues: (runId: string) => ["run-issues", runId] as const,
  org: () => ["org"] as const,
  skills: {
    available: ["skills", "available"] as const,
  },
  plugins: {
    all: ["plugins"] as const,
    examples: ["plugins", "examples"] as const,
    detail: (pluginId: string) => ["plugins", pluginId] as const,
    health: (pluginId: string) => ["plugins", pluginId, "health"] as const,
    uiContributions: ["plugins", "ui-contributions"] as const,
    config: (pluginId: string) =>
      ["plugins", pluginId, "config"] as const,
    localFolders: (pluginId: string) =>
      ["plugins", pluginId, "local-folders"] as const,
    dashboard: (pluginId: string) =>
      ["plugins", pluginId, "dashboard"] as const,
    logs: (pluginId: string) => ["plugins", pluginId, "logs"] as const,
  },
  adapters: {
    all: ["adapters"] as const,
  },
};
