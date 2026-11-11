import { ApiError, type PaperclipApi } from "./api-client.js";

/** Must stay well under the server's CLIENT_SESSION_TIMEOUT_MS (90 s) so one lost beat does not pause work. */
export const CLIENT_SESSION_HEARTBEAT_MS = 30_000;

export interface ClientSessionOptions {
  api: Pick<PaperclipApi, "touchClientSession" | "closeClientSession">;
  clientSessionId: string;
  intervalMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  onError?: (error: unknown) => void;
}

export class ClientSessionHeartbeat {
  private timer: unknown = null;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(private readonly options: ClientSessionOptions) {
    this.setTimer = options.setTimer ?? ((fn, ms) => setInterval(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearInterval(handle as NodeJS.Timeout));
  }

  get id() {
    return this.options.clientSessionId;
  }

  get running() {
    return this.timer !== null;
  }

  start() {
    if (this.timer !== null) return;
    void this.beat();
    this.timer = this.setTimer(() => void this.beat(), this.options.intervalMs ?? CLIENT_SESSION_HEARTBEAT_MS);
  }

  async beat() {
    try {
      await this.options.api.touchClientSession(this.options.clientSessionId);
    } catch (error) {
      this.options.onError?.(error);
    }
  }

  /** Stops beating and tells the server the window closed, so its machine runs pause now instead of after the timeout. */
  async close(timeoutMs = 3000): Promise<string[]> {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await this.options.api.closeClientSession(this.options.clientSessionId, controller.signal);
      return result.pausedIssueIds;
    } catch (error) {
      if (!(error instanceof ApiError)) this.options.onError?.(error);
      return [];
    } finally {
      clearTimeout(abort);
    }
  }
}
