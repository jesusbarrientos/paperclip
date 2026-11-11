import { normalizeServerUrl, type FetchLike } from "./api-client.js";

export interface CliAuthChallenge {
  id: string;
  token: string;
  boardApiToken: string;
  approvalPath: string;
  approvalUrl: string | null;
  pollPath: string;
  expiresAt: string;
  suggestedPollIntervalMs: number;
}

type ChallengeStatus = "pending" | "approved" | "cancelled" | "expired";

export class SignInError extends Error {
  constructor(
    readonly reason: "cancelled" | "expired" | "aborted",
    message: string,
  ) {
    super(message);
    this.name = "SignInError";
  }
}

async function json<T>(fetchImpl: FetchLike, url: string, init?: RequestInit): Promise<T> {
  const response = await fetchImpl(url, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof body?.error === "string" ? body.error : `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function createCliAuthChallenge(
  fetchImpl: FetchLike,
  serverUrl: string,
  clientName: string,
): Promise<CliAuthChallenge & { resolvedApprovalUrl: string }> {
  const base = normalizeServerUrl(serverUrl);
  const challenge = await json<CliAuthChallenge>(fetchImpl, `${base}/api/cli-auth/challenges`, {
    method: "POST",
    body: JSON.stringify({ command: "vscode: Paperclip sign in", clientName, requestedAccess: "board" }),
  });
  return { ...challenge, resolvedApprovalUrl: challenge.approvalUrl ?? `${base}${challenge.approvalPath}` };
}

export interface PollOptions {
  fetch: FetchLike;
  serverUrl: string;
  challenge: CliAuthChallenge;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Resolves with the board API key once the challenge is approved in the browser. */
export async function waitForChallengeApproval(options: PollOptions): Promise<string> {
  const base = normalizeServerUrl(options.serverUrl);
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const expiresAt = Date.parse(options.challenge.expiresAt);
  const pollMs = Math.max(500, options.challenge.suggestedPollIntervalMs || 1000);
  const pollUrl = `${base}/api${options.challenge.pollPath}?token=${encodeURIComponent(options.challenge.token)}`;

  while (!Number.isFinite(expiresAt) || now() < expiresAt) {
    if (options.signal?.aborted) throw new SignInError("aborted", "Sign in was cancelled.");
    const status = await json<{ status: ChallengeStatus }>(options.fetch, pollUrl);
    if (status.status === "approved") return options.challenge.boardApiToken;
    if (status.status === "cancelled") throw new SignInError("cancelled", "The sign in request was cancelled.");
    if (status.status === "expired") break;
    await sleep(pollMs);
  }
  throw new SignInError("expired", "The sign in request expired before it was approved.");
}
