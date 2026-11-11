import { normalizeServerUrl } from "./api-client.js";
import type { LiveEvent } from "./types.js";

export interface LiveEventFilter {
  issueId?: string;
  runId?: string;
  types?: string[];
}

export function buildLiveEventsUrl(serverUrl: string, filter: LiveEventFilter, afterSeq: number | null): string {
  const url = new URL(`${normalizeServerUrl(serverUrl)}/api/events/ws`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (filter.issueId) url.searchParams.set("issueId", filter.issueId);
  if (filter.runId) url.searchParams.set("runId", filter.runId);
  if (filter.types?.length) url.searchParams.set("types", filter.types.join(","));
  if (filter.runId && afterSeq !== null) url.searchParams.set("afterSeq", String(afterSeq));
  return url.toString();
}

export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 30_000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
}

export interface SocketLike {
  on(event: "open", listener: () => void): unknown;
  on(event: "message", listener: (data: unknown) => void): unknown;
  on(event: "close", listener: (code: number) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  close(): void;
}

export type SocketFactory = (url: string, headers: Record<string, string>) => SocketLike;

export type StreamStatus = "connecting" | "open" | "reconnecting" | "stopped";

export interface LiveEventStreamOptions {
  serverUrl: string;
  token: string;
  filter: LiveEventFilter;
  createSocket: SocketFactory;
  onEvent: (event: LiveEvent) => void;
  onStatus?: (status: StreamStatus, detail?: string) => void;
  /** Starting cursor for a run subscription; null subscribes to live events only. */
  afterSeq?: number | null;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

function decode(data: unknown): LiveEvent | null {
  const raw = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
  try {
    const parsed = JSON.parse(raw) as LiveEvent;
    return parsed && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Keeps one filtered subscription to `/api/events/ws` alive. For run
 * subscriptions it tracks the highest delivered seq so a reconnect resumes
 * with `afterSeq` and the server replays whatever was missed.
 */
export class LiveEventStream {
  private socket: SocketLike | null = null;
  private attempt = 0;
  private timer: unknown = null;
  private stopped = true;
  private lastSeq: number | null;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(private readonly options: LiveEventStreamOptions) {
    this.lastSeq = options.filter.runId ? (options.afterSeq ?? 0) : null;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as NodeJS.Timeout));
  }

  get cursor() {
    return this.lastSeq;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.options.onStatus?.("stopped");
  }

  private connect() {
    if (this.stopped) return;
    const url = buildLiveEventsUrl(this.options.serverUrl, this.options.filter, this.lastSeq);
    this.options.onStatus?.(this.attempt === 0 ? "connecting" : "reconnecting");
    let socket: SocketLike;
    try {
      socket = this.options.createSocket(url, { authorization: `Bearer ${this.options.token}` });
    } catch (error) {
      this.scheduleReconnect(error instanceof Error ? error.message : String(error));
      return;
    }
    this.socket = socket;
    socket.on("open", () => {
      if (this.socket !== socket) return;
      this.attempt = 0;
      this.options.onStatus?.("open");
    });
    socket.on("message", (data) => {
      if (this.socket !== socket) return;
      const event = decode(data);
      if (!event) return;
      if (event.type === "heartbeat.run.event" && this.lastSeq !== null) {
        const seq = typeof event.payload?.seq === "number" ? event.payload.seq : null;
        if (seq !== null) {
          if (seq <= this.lastSeq) return;
          this.lastSeq = seq;
        }
      }
      if (event.type === "replay.complete" && event.payload?.truncated === true) {
        this.options.onEvent(event);
        this.reconnectNow();
        return;
      }
      this.options.onEvent(event);
    });
    socket.on("error", () => {
      // "close" always follows; reconnect is scheduled there.
    });
    socket.on("close", (code) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.scheduleReconnect(`closed (${code})`);
    });
  }

  private reconnectNow() {
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.connect();
  }

  private scheduleReconnect(detail: string) {
    if (this.stopped) return;
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;
    this.options.onStatus?.("reconnecting", detail);
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }
}
