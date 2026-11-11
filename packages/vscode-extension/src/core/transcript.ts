import type { HeartbeatRunEvent } from "./types.js";
import { isTerminalRunStatus } from "./types.js";

export type RuntimeRequestStatus = "pending" | "resolved" | "cancelled" | "expired";

export type TranscriptEntry =
  | { kind: "assistant"; key: string; text: string; streaming: boolean }
  | { kind: "thinking"; key: string; text: string }
  | { kind: "tool"; key: string; name: string; detail: string | null; status: "running" | "ok" | "error"; output: string | null }
  | {
      kind: "request";
      key: string;
      runId: string;
      requestId: string;
      turnId: string | null;
      requestKind: string | null;
      prompt: string;
      /** Question/elicitation requests need a form; the extension sends those to the browser. */
      input: boolean;
      choices: { key: string; label: string }[];
      status: RuntimeRequestStatus;
      resolvedAction: string | null;
    }
  | { kind: "error"; key: string; text: string }
  | { kind: "notice"; key: string; text: string };

export interface TranscriptSnapshot {
  runId: string;
  runStatus: string | null;
  lastSeq: number;
  entries: TranscriptEntry[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function truncate(value: string, max = 400) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function summarize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return truncate(value);
  try {
    return truncate(JSON.stringify(value));
  } catch {
    return null;
  }
}

function itemKind(payload: Record<string, unknown>): string {
  const item = record(payload.item) ?? payload;
  return (text(payload.kind) ?? text(item.kind) ?? text(item.type) ?? "").replaceAll("_", "").toLowerCase();
}

function itemText(payload: Record<string, unknown>): string | null {
  const item = record(payload.item) ?? payload;
  return text(payload.text) ?? text(item.text);
}

function itemId(envelope: Record<string, unknown>, payload: Record<string, unknown>): string | null {
  const item = record(payload.item) ?? payload;
  return text(envelope.itemId) ?? text(payload.itemId) ?? text(item.id);
}

function isToolKind(kind: string) {
  return kind.includes("tool") || kind === "commandexecution" || kind === "filechange";
}

/**
 * Folds persisted run events (REST or WebSocket replay/live) into the
 * transcript shown in the chat panel. Events are applied once by seq, so
 * replays after a reconnect never duplicate entries.
 */
export class RunTranscript {
  private readonly entries: TranscriptEntry[] = [];
  private readonly byKey = new Map<string, TranscriptEntry>();
  private readonly seenSourceEventIds = new Set<string>();
  private lastSeq = 0;
  private runStatus: string | null = null;

  constructor(readonly runId: string) {}

  get cursor() {
    return this.lastSeq;
  }

  get status() {
    return this.runStatus;
  }

  snapshot(): TranscriptSnapshot {
    return {
      runId: this.runId,
      runStatus: this.runStatus,
      lastSeq: this.lastSeq,
      entries: this.entries.map((entry) => ({ ...entry })),
    };
  }

  pendingRequests() {
    return this.entries.filter(
      (entry): entry is Extract<TranscriptEntry, { kind: "request" }> =>
        entry.kind === "request" && entry.status === "pending",
    );
  }

  setRunStatus(status: string, error?: string | null) {
    if (status === this.runStatus) return;
    this.runStatus = status;
    if (isTerminalRunStatus(status)) {
      for (const entry of this.entries) {
        if (entry.kind === "assistant") entry.streaming = false;
        if (entry.kind === "tool" && entry.status === "running") entry.status = status === "succeeded" ? "ok" : "error";
        if (entry.kind === "request" && entry.status === "pending") entry.status = "expired";
      }
      if (status !== "succeeded" && error) this.push({ kind: "error", key: `status:${status}`, text: error });
    }
  }

  /** Marks a request answered from this window before the runner confirms it, so the card stops offering buttons. */
  markRequestSettling(requestId: string, action: string) {
    const entry = this.byKey.get(`request:${requestId}`);
    if (entry?.kind === "request" && entry.status === "pending") {
      entry.status = action === "accept" || action === "accept_for_session" ? "resolved" : "cancelled";
      entry.resolvedAction = action;
    }
  }

  apply(event: HeartbeatRunEvent): boolean {
    if (event.runId !== this.runId) return false;
    if (event.seq <= this.lastSeq) return false;
    this.lastSeq = event.seq;

    const envelope = record(event.payload?.prpEvent);
    if (!envelope) {
      this.applyPlain(event);
      return true;
    }
    const sourceEventId = text(envelope.sourceEventId);
    if (sourceEventId) {
      if (this.seenSourceEventIds.has(sourceEventId)) return true;
      this.seenSourceEventIds.add(sourceEventId);
    }
    const payload = record(envelope.payload) ?? {};
    const eventType = text(envelope.eventType) ?? event.eventType;
    this.applyPrp(event, eventType, envelope, payload);
    return true;
  }

  private push(entry: TranscriptEntry) {
    const existing = this.byKey.get(entry.key);
    if (existing) {
      Object.assign(existing, entry);
      return;
    }
    this.byKey.set(entry.key, entry);
    this.entries.push(entry);
  }

  private applyPlain(event: HeartbeatRunEvent) {
    const message = text(event.message);
    if (!message) return;
    const isError = event.level === "error" || event.eventType.includes("error");
    this.push({ kind: isError ? "error" : "notice", key: `seq:${event.seq}`, text: truncate(message, 2000) });
  }

  private applyPrp(
    event: HeartbeatRunEvent,
    eventType: string,
    envelope: Record<string, unknown>,
    payload: Record<string, unknown>,
  ) {
    const kind = itemKind(payload);
    const id = itemId(envelope, payload);

    if ((eventType === "item.delta" || eventType === "item.completed") && (kind === "agentmessage" || kind === "assistantmessage")) {
      const value = itemText(payload);
      if (!value) return;
      const key = `assistant:${id ?? event.seq}`;
      const existing = this.byKey.get(key);
      if (eventType === "item.delta") {
        const previous = existing?.kind === "assistant" ? existing.text : "";
        this.push({ kind: "assistant", key, text: previous + value, streaming: true });
      } else {
        this.push({ kind: "assistant", key, text: value, streaming: false });
      }
      return;
    }

    if (eventType === "item.completed" && kind === "reasoning") {
      const value = itemText(payload);
      if (value) this.push({ kind: "thinking", key: `thinking:${id ?? event.seq}`, text: truncate(value, 2000) });
      return;
    }

    if ((eventType === "item.started" || eventType === "item.completed") && isToolKind(kind) && id) {
      const item = record(payload.item) ?? payload;
      const key = `tool:${id}`;
      const existing = this.byKey.get(key);
      const name =
        text(item.name) ?? text(item.toolName) ?? text(item.command) ?? (existing?.kind === "tool" ? existing.name : kind);
      const failed = item.isError === true || item.status === "failed";
      this.push({
        kind: "tool",
        key,
        name,
        detail: summarize(item.input ?? item.arguments) ?? (existing?.kind === "tool" ? existing.detail : null),
        status: eventType === "item.completed" ? (failed ? "error" : "ok") : "running",
        output: eventType === "item.completed" ? summarize(item.result ?? item.output) : null,
      });
      return;
    }

    if (eventType === "tool.execution.started" || eventType === "tool.execution.completed") {
      const executionId = text(payload.executionId) ?? id ?? String(event.seq);
      const key = `tool:${executionId}`;
      const existing = this.byKey.get(key);
      const name =
        text(payload.toolName) ?? text(payload.name) ?? text(record(payload.tool)?.name) ?? (existing?.kind === "tool" ? existing.name : "tool");
      this.push({
        kind: "tool",
        key,
        name,
        detail: summarize(payload.title ?? payload.input) ?? (existing?.kind === "tool" ? existing.detail : null),
        status: eventType === "tool.execution.completed" ? (payload.status === "failed" ? "error" : "ok") : "running",
        output: eventType === "tool.execution.completed" ? summarize(payload.output) : null,
      });
      return;
    }

    if (eventType.startsWith("runtime_request.")) {
      this.applyRuntimeRequest(eventType, envelope, payload);
      return;
    }

    if (eventType === "provider.notice.recorded") {
      const summary = text(payload.summary) ?? text(payload.message);
      if (summary) {
        this.push({ kind: payload.severity === "error" ? "error" : "notice", key: `seq:${event.seq}`, text: truncate(summary, 1000) });
      }
      return;
    }

    if (eventType === "run.terminal") {
      const status = text(payload.status) ?? text(payload.outcome);
      const message = text(payload.message) ?? text(payload.summary) ?? text(record(payload.error)?.message);
      if (status && status !== "succeeded" && status !== "completed" && message) {
        this.push({ kind: "error", key: `terminal:${event.runId}`, text: truncate(message, 2000) });
      }
      return;
    }

    if (event.level === "error" || eventType.endsWith(".failed") || eventType.includes("error")) {
      const message = text(event.message) ?? text(payload.message) ?? text(record(payload.error)?.message) ?? eventType;
      this.push({ kind: "error", key: `seq:${event.seq}`, text: truncate(message, 2000) });
    }
  }

  private applyRuntimeRequest(eventType: string, envelope: Record<string, unknown>, payload: Record<string, unknown>) {
    const request = record(payload.request) ?? payload;
    const requestId = text(request.requestId) ?? text(payload.requestId);
    if (!requestId) return;
    const key = `request:${requestId}`;
    const previous = this.byKey.get(key);
    const prior = previous?.kind === "request" ? previous : null;
    const suffix = eventType.split(".").at(-1);
    const action = text(request.action) ?? text(payload.action) ?? prior?.resolvedAction ?? null;
    // The lifecycle suffix is authoritative: delivery receipts carry status:"delivered"
    // and must not reopen a request that already resolved.
    let status: RuntimeRequestStatus =
      suffix === "resolved" ? "resolved" : suffix === "expired" ? "expired" : suffix === "cancelled" ? "cancelled" : "pending";
    if (status === "resolved" && (action === "decline" || action === "cancel")) status = "cancelled";
    if (status === "pending" && prior && prior.status !== "pending") status = prior.status;
    const choices = (Array.isArray(request.choices) ? request.choices : [])
      .map(record)
      .flatMap((choice) => {
        const choiceKey = text(choice?.key);
        const label = text(choice?.label);
        return choiceKey && label ? [{ key: choiceKey, label }] : [];
      })
      .slice(0, 8);
    const requestKind = text(request.requestKind) ?? text(payload.requestKind) ?? prior?.requestKind ?? null;
    const requestType = text(request.type) ?? "";
    this.push({
      kind: "request",
      key,
      runId: this.runId,
      requestId,
      turnId: text(request.turnId) ?? text(payload.turnId) ?? text(envelope.turnId) ?? prior?.turnId ?? null,
      requestKind,
      prompt: text(request.prompt) ?? prior?.prompt ?? "Permission requested",
      input:
        prior?.input ??
        (requestKind === "user_input" || requestKind === "elicitation" || requestType.includes("input") || requestType.includes("elicitation")),
      choices: choices.length > 0 ? choices : prior?.choices ?? [],
      status,
      resolvedAction: status === "pending" ? null : action,
    });
  }
}

const RESOLUTION_ACTIONS = new Set(["accept", "accept_for_session", "decline", "cancel"]);

/** Choice keys double as resolution actions; anything else cannot be sent to the resolve endpoint. */
export function requestChoices(entry: Extract<TranscriptEntry, { kind: "request" }>) {
  if (entry.input) return [];
  const valid = entry.choices.filter((choice) => RESOLUTION_ACTIONS.has(choice.key));
  if (valid.length > 0) return valid;
  return [
    { key: "accept", label: "Approve" },
    { key: "decline", label: "Deny" },
  ];
}
