import { expect, it, vi } from "vitest";
import type { RunnerApi } from "./api.js";
import { prepareLegacyContinuationSkill } from "./continuation-fixtures.js";
it("initializes the production library and assigns the operational skill before execution", async () => {
  const post = vi.fn();
  const get = vi.fn(async () => [{ key: "paperclipai/paperclip/paperclip" }]);
  await prepareLegacyContinuationSkill({ get, post } as unknown as RunnerApi, "agent");
  expect(get).toHaveBeenCalledWith("/api/skills");
  expect(post).toHaveBeenCalledWith("/api/agents/agent/skills/sync", { desiredSkills: ["paperclipai/paperclip/paperclip"], mode: "add" });
  get.mockResolvedValue([]);
  await expect(prepareLegacyContinuationSkill({ get, post } as unknown as RunnerApi, "agent")).rejects.toThrow("missing the bundled");
  expect(post).toHaveBeenCalledTimes(1);
});
