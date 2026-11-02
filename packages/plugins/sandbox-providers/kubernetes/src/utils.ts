import { randomInt } from "node:crypto";

const ULID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function deriveNamespaceName(prefix: string, slug: string): string {
  return `${prefix}${slug}`;
}

export function newRunUlidDns(now: () => number = Date.now): string {
  const timestamp = now();
  let out = "";
  let t = timestamp;
  for (let i = 0; i < 10; i++) {
    out = ULID_ALPHABET[t & 0x1f] + out;
    t = Math.floor(t / 32);
  }
  for (let i = 0; i < 16; i++) {
    // crypto-strength randomness: these become Job/Sandbox CR names and the
    // providerLeaseId, so they must not be enumerable.
    out += ULID_ALPHABET[randomInt(32)];
  }
  return out;
}

export interface LabelsInput {
  runId: string;
  agentId: string;
  adapterType: string;
}

export function paperclipLabels(input: LabelsInput): Record<string, string> {
  return {
    "paperclip.io/run-id": input.runId,
    "paperclip.io/agent-id": input.agentId,
    "paperclip.io/adapter": input.adapterType,
    "paperclip.io/managed-by": "paperclip-k8s-plugin",
  };
}
