import { describe, it, expect } from "vitest";
import { deriveNamespaceName, newRunUlidDns, paperclipLabels } from "../../src/utils.js";

describe("deriveNamespaceName", () => {
  it("concatenates prefix and slug", () => {
    expect(deriveNamespaceName("paperclip-", "acme-co")).toBe("paperclip-acme-co");
  });
});

describe("newRunUlidDns", () => {
  it("produces a DNS-safe 26-char lowercase id", () => {
    const id = newRunUlidDns();
    expect(id).toMatch(/^[a-z0-9]{26}$/);
  });
});

describe("paperclipLabels", () => {
  it("returns canonical label map", () => {
    const labels = paperclipLabels({ runId: "r1", agentId: "a1", adapterType: "claude_local" });
    expect(labels["paperclip.io/run-id"]).toBe("r1");
    expect(labels["paperclip.io/agent-id"]).toBe("a1");
    expect(labels["paperclip.io/adapter"]).toBe("claude_local");
    expect(labels["paperclip.io/managed-by"]).toBe("paperclip-k8s-plugin");
  });
});
