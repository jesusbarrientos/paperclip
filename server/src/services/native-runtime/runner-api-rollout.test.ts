import { describe, expect, it } from "vitest";
import { runnerApiToolsEnabled } from "./runner-api-rollout.js";

describe("runner API rollout", () => {
  it("enables API tools without operator configuration", () => {
    expect(runnerApiToolsEnabled(undefined, {})).toBe(true);
    expect(runnerApiToolsEnabled(true, {})).toBe(true);
    expect(runnerApiToolsEnabled(false, {})).toBe(false);
  });
  it("fails closed for explicit disabled or invalid settings", () => {
    for (const value of ["false", "", "TRUE", "1", "invalid"]) {
      for (const binding of [undefined, false, true]) expect(runnerApiToolsEnabled(binding, { PAPERCLIP_RUNNER_API_TOOLS_ENABLED: value })).toBe(false);
    }
    expect(runnerApiToolsEnabled(undefined, { PAPERCLIP_RUNNER_API_TOOLS_ENABLED: "true" })).toBe(true);
  });
  it("keeps baseline tools disabled and honors an operator stop over explicit bindings", () => {
    expect(runnerApiToolsEnabled(false, { PAPERCLIP_RUNNER_API_TOOLS_ENABLED: "true" })).toBe(false);
    expect(runnerApiToolsEnabled(false, {})).toBe(false);
    expect(runnerApiToolsEnabled(true, { PAPERCLIP_RUNNER_API_TOOLS_ENABLED: "false" })).toBe(false);
  });
});
