// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { consumeSkillSourceReturn, rememberSkillSourceReturn, skillSourceReturnPath } from "./skill-source-connect-return";

afterEach(() => { sessionStorage.clear(); vi.useRealTimers(); });

it("retains a one-time return through an OAuth reload", () => {
  const sourceId = "94df7764-6811-43e4-ac85-a6d6b636d73d";
  rememberSkillSourceReturn(sourceId);
  expect(consumeSkillSourceReturn()).toBe(`/skills/sources/${sourceId}`);
  expect(skillSourceReturnPath()).toBeNull();
});

it("expires abandoned setup and rejects arbitrary redirect destinations", () => {
  vi.useFakeTimers();
  rememberSkillSourceReturn("new");
  vi.advanceTimersByTime(31 * 60 * 1000);
  expect(consumeSkillSourceReturn()).toBeNull();
  rememberSkillSourceReturn("https://example.com");
  expect(skillSourceReturnPath()).toBeNull();
  sessionStorage.setItem("paperclip.skill-source-connect-return", JSON.stringify({ sourceId: "//example.com", expiresAt: Date.now() + 1000 }));
  expect(consumeSkillSourceReturn()).toBeNull();
});
