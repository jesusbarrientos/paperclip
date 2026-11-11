import { randomUUID } from "node:crypto";
import { ApiError, type PaperclipApi } from "./api-client.js";
import { CommentThread, type ChatMessage } from "./chat-model.js";
import { LiveEventStream, type SocketFactory, type StreamStatus } from "./live-events.js";
import { RunTranscript, type TranscriptSnapshot } from "./transcript.js";
import type { AgentSummary, HeartbeatRunEvent, IssueSummary, LiveEvent, WorkContextState } from "./types.js";

export interface ActiveIssueSnapshot {
  issue: IssueSummary;
  state: WorkContextState | null;
  messages: ChatMessage[];
  transcript: TranscriptSnapshot | null;
  streamStatus: StreamStatus;
  interrupting: boolean;
  error: string | null;
}

const ISSUE_EVENT_TYPES = [
  "heartbeat.run.queued",
  "heartbeat.run.status",
  "heartbeat.run.event",
  "work_context.updated",
  "activity.logged",
];

function toRunEvent(payload: Record<string, unknown>): HeartbeatRunEvent | null {
  if (typeof payload.runId !== "string" || typeof payload.seq !== "number" || typeof payload.eventType !== "string") {
    return null;
  }
  return {
    runId: payload.runId,
    seq: payload.seq,
    eventType: payload.eventType,
    level: typeof payload.level === "string" ? payload.level : null,
    message: typeof payload.message === "string" ? payload.message : null,
    payload: payload.payload && typeof payload.payload === "object" ? (payload.payload as Record<string, unknown>) : null,
  };
}

/** The issue-filtered socket has no replay, so after a reconnect the transcript is backfilled over REST from its last seq. */
export class ActiveIssue {
  private readonly thread: CommentThread;
  private transcript: RunTranscript | null = null;
  private state: WorkContextState | null = null;
  private stream: LiveEventStream | null = null;
  private streamStatus: StreamStatus = "connecting";
  private interrupting = false;
  private error: string | null = null;
  private disposed = false;
  private refreshing: Promise<void> | null = null;

  constructor(
    private issue: IssueSummary,
    private readonly api: PaperclipApi,
    private readonly options: {
      createSocket: SocketFactory;
      agents: AgentSummary[];
      onChange: () => void;
    },
  ) {
    const names = new Map(options.agents.map((agent) => [agent.id, agent.name]));
    this.thread = new CommentThread((comment) => {
      if (comment.authorAgentId) return names.get(comment.authorAgentId) ?? "Agent";
      if (comment.authorType === "user") return "User";
      return comment.authorType;
    });
  }

  get id() {
    return this.issue.id;
  }

  get workContext() {
    return this.state;
  }

  get pendingRequests() {
    return this.transcript?.pendingRequests() ?? [];
  }

  snapshot(): ActiveIssueSnapshot {
    return {
      issue: this.issue,
      state: this.state,
      messages: this.thread.messages(),
      transcript: this.transcript?.snapshot() ?? null,
      streamStatus: this.streamStatus,
      interrupting: this.interrupting,
      error: this.error,
    };
  }

  async start() {
    await this.refreshAll();
    if (this.disposed || !this.api.token) return;
    this.stream = new LiveEventStream({
      serverUrl: this.api.serverUrl,
      token: this.api.token,
      filter: { issueId: this.issue.id, types: ISSUE_EVENT_TYPES },
      createSocket: this.options.createSocket,
      onEvent: (event) => this.handleEvent(event),
      onStatus: (status) => {
        const reconnected = status === "open" && this.streamStatus === "reconnecting";
        this.streamStatus = status;
        if (reconnected) void this.refreshAll();
        this.changed();
      },
    });
    this.stream.start();
  }

  dispose() {
    this.disposed = true;
    this.stream?.stop();
    this.stream = null;
  }

  private changed() {
    if (!this.disposed) this.options.onChange();
  }

  private fail(error: unknown) {
    this.error = error instanceof Error ? error.message : String(error);
    this.changed();
  }

  async refreshAll() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        const [issue, state, comments] = await Promise.all([
          this.api.getIssue(this.issue.id),
          this.api.getWorkContext(this.issue.id),
          this.api.listComments(this.issue.id),
        ]);
        this.issue = issue;
        this.applyState(state);
        this.thread.upsert(comments);
        await this.backfillTranscript();
        this.error = null;
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.refreshing = null;
        this.changed();
      }
    })();
    return this.refreshing;
  }

  private applyState(state: WorkContextState) {
    this.state = state;
    const runId = state.run?.id ?? null;
    if (runId && this.transcript?.runId !== runId) this.transcript = new RunTranscript(runId);
    if (state.run) this.transcript?.setRunStatus(state.run.status);
    if (!state.run) this.interrupting = false;
  }

  private async backfillTranscript() {
    const transcript = this.transcript;
    if (!transcript) return;
    for (;;) {
      const events = await this.api.listRunEvents(transcript.runId, transcript.cursor);
      for (const event of events) transcript.apply(event);
      if (events.length < 500) break;
    }
    if (!this.state?.run || this.state.run.id !== transcript.runId) {
      const run = await this.api.getRun(transcript.runId).catch(() => null);
      if (run) transcript.setRunStatus(run.status, run.error);
    }
  }

  private async refreshIssue() {
    try {
      this.issue = await this.api.getIssue(this.issue.id);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
    this.changed();
  }

  private async refreshState() {
    try {
      this.applyState(await this.api.getWorkContext(this.issue.id));
      await this.backfillTranscript();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
    this.changed();
  }

  private handleEvent(event: LiveEvent) {
    const payload = event.payload ?? {};
    switch (event.type) {
      case "heartbeat.run.event": {
        const runEvent = toRunEvent(payload);
        if (!runEvent) return;
        if (!this.transcript || this.transcript.runId !== runEvent.runId) {
          this.transcript = new RunTranscript(runEvent.runId);
          void this.backfillTranscript().then(() => this.changed());
          return;
        }
        if (this.transcript.apply(runEvent)) this.changed();
        return;
      }
      case "heartbeat.run.queued":
      case "heartbeat.run.status":
      case "work_context.updated":
        void this.refreshState();
        return;
      case "activity.logged":
        if (typeof payload.action !== "string" || !payload.action.startsWith("issue.")) return;
        if (payload.action.startsWith("issue.comment")) {
          void this.api
            .listComments(this.issue.id)
            .then((comments) => {
              this.thread.upsert(comments);
              this.changed();
            })
            .catch((error) => this.fail(error));
        }
        void this.refreshIssue();
        return;
    }
  }

  async sendComment(body: string) {
    const clientRequestId = randomUUID();
    this.thread.addPending(clientRequestId, body);
    this.changed();
    try {
      this.thread.upsert([await this.api.addComment(this.issue.id, body, clientRequestId)]);
    } catch (error) {
      this.thread.markFailed(clientRequestId);
      this.error = error instanceof Error ? error.message : String(error);
    }
    this.changed();
  }

  /** Requests cancellation; the run counts as stopped only when the server reports it terminal. */
  async interrupt() {
    const run = this.state?.run;
    if (!run) return;
    this.interrupting = true;
    this.changed();
    try {
      await this.api.cancelRun(run.id);
    } catch (error) {
      this.interrupting = false;
      this.fail(error);
      return;
    }
    await this.refreshState();
  }

  async resolveRequest(requestId: string, action: string) {
    const entry = this.transcript?.pendingRequests().find((candidate) => candidate.requestId === requestId);
    if (!entry) return;
    try {
      await this.api.resolveRuntimeRequest({
        runId: entry.runId,
        requestId,
        turnId: entry.turnId,
        requestKind: entry.requestKind,
        resolution: { action },
      });
      this.transcript?.markRequestSettling(requestId, action);
    } catch (error) {
      // 409 means another client already decided; the run events will show which way.
      if (!(error instanceof ApiError && error.isConflict)) {
        this.fail(error);
        return;
      }
    }
    this.changed();
  }

  replaceState(state: WorkContextState) {
    this.applyState(state);
    this.changed();
  }
}
