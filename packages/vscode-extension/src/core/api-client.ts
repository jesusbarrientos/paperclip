import type {
  AgentSummary,
  ExecutionLocation,
  HeartbeatRun,
  HeartbeatRunEvent,
  IssueComment,
  IssueInteraction,
  IssueSummary,
  Machine,
  ProjectSummary,
  WorkContextState,
} from "./types.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isConflict() {
    return this.status === 409;
  }

  get isUnauthorized() {
    return this.status === 401 || this.status === 403;
  }
}

export function normalizeServerUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Server URL must use http or https: ${value}`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export interface ApiClientOptions {
  serverUrl: string;
  token: string | null;
  fetch?: FetchLike;
}

export class PaperclipApi {
  readonly serverUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: ApiClientOptions) {
    this.serverUrl = normalizeServerUrl(options.serverUrl);
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  }

  get token() {
    return this.options.token;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    init: { signal?: AbortSignal } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.options.token) headers.authorization = `Bearer ${this.options.token}`;
    const response = await this.fetchImpl(`${this.serverUrl}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: init.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!response.ok) {
      const message =
        parsed && typeof parsed === "object" && typeof (parsed as { error?: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : `${method} ${path} failed with ${response.status}`;
      throw new ApiError(response.status, message, parsed);
    }
    return parsed as T;
  }

  me() {
    return this.request<{ userId: string; user?: { name?: string | null; email?: string | null } | null }>(
      "GET",
      "/cli-auth/me",
    );
  }

  revokeCurrentKey() {
    return this.request<{ revoked: boolean }>("POST", "/cli-auth/revoke-current", {});
  }

  listProjects() {
    return this.request<ProjectSummary[]>("GET", "/projects");
  }

  listIssues(filters: { projectId?: string; status?: string[]; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("projectId", filters.projectId);
    if (filters.status?.length) params.set("status", filters.status.join(","));
    if (filters.limit) params.set("limit", String(filters.limit));
    const query = params.toString();
    return this.request<IssueSummary[]>("GET", `/issues${query ? `?${query}` : ""}`);
  }

  getIssue(issueId: string) {
    return this.request<IssueSummary>("GET", `/issues/${encodeURIComponent(issueId)}`);
  }

  listAgents() {
    return this.request<AgentSummary[]>("GET", "/agents");
  }

  listComments(issueId: string) {
    return this.request<IssueComment[]>("GET", `/issues/${encodeURIComponent(issueId)}/comments?order=asc`);
  }

  addComment(issueId: string, body: string, clientRequestId: string) {
    return this.request<IssueComment>("POST", `/issues/${encodeURIComponent(issueId)}/comments`, {
      body,
      clientRequestId,
    });
  }

  listInteractions(issueId: string) {
    return this.request<IssueInteraction[]>("GET", `/issues/${encodeURIComponent(issueId)}/interactions`);
  }

  acceptInteraction(issueId: string, interactionId: string) {
    return this.request<IssueInteraction>(
      "POST",
      `/issues/${encodeURIComponent(issueId)}/interactions/${encodeURIComponent(interactionId)}/accept`,
      {},
    );
  }

  rejectInteraction(issueId: string, interactionId: string, reason?: string) {
    return this.request<IssueInteraction>(
      "POST",
      `/issues/${encodeURIComponent(issueId)}/interactions/${encodeURIComponent(interactionId)}/reject`,
      reason ? { reason } : {},
    );
  }

  getWorkContext(issueId: string) {
    return this.request<WorkContextState>("GET", `/issues/${encodeURIComponent(issueId)}/work-context`);
  }

  runWorkContext(issueId: string, input: { location?: ExecutionLocation; clientSessionId?: string | null }) {
    return this.request<{ runId: string | null; state: WorkContextState }>(
      "POST",
      `/issues/${encodeURIComponent(issueId)}/work-context/run`,
      input,
    );
  }

  setExecutionLocation(issueId: string, location: ExecutionLocation, clientSessionId?: string | null) {
    return this.request<WorkContextState>("PUT", `/issues/${encodeURIComponent(issueId)}/execution-location`, {
      location,
      ...(clientSessionId !== undefined ? { clientSessionId } : {}),
    });
  }

  handoff(issueId: string, to: ExecutionLocation) {
    return this.request<{ runId: string | null; state: WorkContextState }>(
      "POST",
      `/issues/${encodeURIComponent(issueId)}/work-context/handoff`,
      { to },
    );
  }

  touchClientSession(clientSessionId: string) {
    return this.request<{ ok: boolean }>("POST", "/work-contexts/client-sessions", { clientSessionId });
  }

  closeClientSession(clientSessionId: string, signal?: AbortSignal) {
    return this.request<{ pausedIssueIds: string[] }>(
      "DELETE",
      `/work-contexts/client-sessions/${encodeURIComponent(clientSessionId)}`,
      undefined,
      { signal },
    );
  }

  getMachine(machineId: string) {
    return this.request<Machine>("GET", `/machines/${encodeURIComponent(machineId)}`);
  }

  getRun(runId: string) {
    return this.request<HeartbeatRun>("GET", `/heartbeat-runs/${encodeURIComponent(runId)}`);
  }

  listIssueLiveRuns(issueId: string) {
    return this.request<HeartbeatRun[]>("GET", `/issues/${encodeURIComponent(issueId)}/live-runs`);
  }

  listRunEvents(runId: string, afterSeq: number, limit = 500) {
    return this.request<HeartbeatRunEvent[]>(
      "GET",
      `/heartbeat-runs/${encodeURIComponent(runId)}/events?afterSeq=${afterSeq}&limit=${limit}`,
    );
  }

  cancelRun(runId: string) {
    return this.request<HeartbeatRun | null>("POST", `/heartbeat-runs/${encodeURIComponent(runId)}/cancel`, {});
  }

  resolveRuntimeRequest(input: {
    runId: string;
    requestId: string;
    turnId: string | null;
    requestKind: string | null;
    resolution: { action: string };
  }) {
    return this.request<{ accepted: true; commandId: string }>(
      "POST",
      `/heartbeat-runs/${encodeURIComponent(input.runId)}/runtime-requests/${encodeURIComponent(input.requestId)}/resolve`,
      { turnId: input.turnId, requestKind: input.requestKind, resolution: input.resolution },
    );
  }

  issueUrl(issue: Pick<IssueSummary, "id" | "identifier">) {
    return `${this.serverUrl}/issues/${encodeURIComponent(issue.identifier ?? issue.id)}`;
  }

  runUrl(agentId: string, runId: string) {
    return `${this.serverUrl}/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`;
  }
}
