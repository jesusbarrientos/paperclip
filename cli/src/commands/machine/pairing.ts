import {
  API,
  type MachinePairingClaimResponse,
  type MachinePairingStartRequest,
  type MachinePairingStartResponse,
} from "@paperclipai/shared";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PairingDeps {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  headers?: Record<string, string>;
}

export class PairingError extends Error {
  constructor(message: string, readonly reason: "expired" | "revoked" | "already_claimed" | "request_failed") {
    super(message);
  }
}

const MIN_POLL_INTERVAL_MS = 1_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function apiUrl(serverUrl: string, apiPath: string): string {
  return `${serverUrl}${apiPath}`;
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : `HTTP ${response.status}`;
}

export async function startPairing(
  serverUrl: string,
  request: MachinePairingStartRequest,
  deps: PairingDeps = {},
): Promise<MachinePairingStartResponse> {
  const doFetch = deps.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(apiUrl(serverUrl, API.machinePairings), {
      method: "POST",
      headers: { ...deps.headers, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(request),
    });
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
    throw new PairingError(`Could not reach ${serverUrl}: ${error instanceof Error ? error.message : String(error)}${cause}`, "request_failed");
  }
  if (!response.ok) {
    throw new PairingError(`Could not start pairing: ${await readError(response)}`, "request_failed");
  }
  return await response.json() as MachinePairingStartResponse;
}

export function resolveApprovalUrl(serverUrl: string, pairing: MachinePairingStartResponse): string {
  if (pairing.approvalUrl) return pairing.approvalUrl;
  return new URL(pairing.approvalPath, `${serverUrl}/`).toString();
}

export async function waitForPairingClaim(
  serverUrl: string,
  pairing: Pick<MachinePairingStartResponse, "machineId" | "token" | "expiresAt" | "suggestedPollIntervalMs">,
  deps: PairingDeps & { onPending?: () => void; onTransientError?: (message: string) => void } = {},
): Promise<{ machineId: string; credential: string }> {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const intervalMs = Math.max(MIN_POLL_INTERVAL_MS, pairing.suggestedPollIntervalMs || 0);
  const expiresAt = Date.parse(pairing.expiresAt);
  const claimUrl = apiUrl(serverUrl, API.machinePairingClaim.replace(":machineId", encodeURIComponent(pairing.machineId)));

  while (true) {
    if (Number.isFinite(expiresAt) && now() >= expiresAt) {
      throw new PairingError("Pairing request expired before it was approved. Run `paperclipai machine pair` again.", "expired");
    }
    await sleep(intervalMs);

    let response: Response;
    try {
      response = await doFetch(claimUrl, {
        method: "POST",
        headers: { ...deps.headers, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ token: pairing.token }),
      });
    } catch (error) {
      deps.onTransientError?.(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (response.status >= 500 || response.status === 429) {
      deps.onTransientError?.(`HTTP ${response.status}`);
      continue;
    }
    if (!response.ok) {
      throw new PairingError(`Pairing claim failed: ${await readError(response)}`, "request_failed");
    }

    const body = await response.json() as MachinePairingClaimResponse;
    switch (body.status) {
      case "pending":
        deps.onPending?.();
        continue;
      case "authorized":
        return { machineId: body.machineId, credential: body.credential };
      case "expired":
        throw new PairingError("Pairing request expired before it was approved. Run `paperclipai machine pair` again.", "expired");
      case "revoked":
        throw new PairingError("Pairing request was rejected or the machine was revoked.", "revoked");
      case "already_claimed":
        throw new PairingError("This pairing was already claimed. Run `paperclipai machine pair` again.", "already_claimed");
      default:
        throw new PairingError(`Unexpected pairing status: ${JSON.stringify(body)}`, "request_failed");
    }
  }
}
