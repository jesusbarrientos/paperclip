import { describe, expect, it } from "vitest";
import {
  DEFAULT_INSTANCE_SETTINGS_PATH,
  filterHiddenInstanceSettingsPath,
  normalizeRememberedInstanceSettingsPath,
} from "./instance-settings";

describe("normalizeRememberedInstanceSettingsPath", () => {
  it("canonicalizes known instance settings pages under organization settings", () => {
    expect(normalizeRememberedInstanceSettingsPath("/instance/settings/general")).toBe(
      "/organization/settings/instance/general",
    );
    expect(normalizeRememberedInstanceSettingsPath("/instance/settings/experimental")).toBe(
      "/organization/settings/instance/experimental",
    );
    expect(normalizeRememberedInstanceSettingsPath("/instance/settings/environments")).toBe(
      "/organization/settings/instance/environments",
    );
    expect(normalizeRememberedInstanceSettingsPath("/settings/access?tab=users#admins")).toBe(
      "/organization/settings/instance/access?tab=users#admins",
    );
    expect(normalizeRememberedInstanceSettingsPath("/instance/settings/plugins/example?tab=config#logs")).toBe(
      "/organization/settings/instance/plugins/example?tab=config#logs",
    );
    expect(normalizeRememberedInstanceSettingsPath("/company/settings/instance/adapters")).toBe(
      "/organization/settings/instance/adapters",
    );
    expect(normalizeRememberedInstanceSettingsPath("/organization/settings/instance/general")).toBe(
      "/organization/settings/instance/general",
    );
    expect(normalizeRememberedInstanceSettingsPath("/organization/settings/instance/plugins/example?tab=config#logs")).toBe(
      "/organization/settings/instance/plugins/example?tab=config#logs",
    );
    expect(normalizeRememberedInstanceSettingsPath("/organization/settings/environments")).toBe(
      "/organization/settings/instance/environments",
    );
  });

  it("falls back to the default page for unknown paths", () => {
    expect(normalizeRememberedInstanceSettingsPath("/instance/settings/nope")).toBe(
      DEFAULT_INSTANCE_SETTINGS_PATH,
    );
    // The Heartbeats page was removed; remembered paths remap to the default.
    expect(normalizeRememberedInstanceSettingsPath("/instance/settings/heartbeats")).toBe(
      DEFAULT_INSTANCE_SETTINGS_PATH,
    );
    expect(normalizeRememberedInstanceSettingsPath(null)).toBe(DEFAULT_INSTANCE_SETTINGS_PATH);
  });
});

describe("filterHiddenInstanceSettingsPath", () => {
  const hidden = new Set(["instance.plugins", "instance.environments"]);

  it("remaps hidden pages (including sub-paths) to the default settings path", () => {
    expect(
      filterHiddenInstanceSettingsPath("/organization/settings/instance/plugins", hidden),
    ).toBe(DEFAULT_INSTANCE_SETTINGS_PATH);
    expect(
      filterHiddenInstanceSettingsPath("/organization/settings/instance/plugins/plugin-1", hidden),
    ).toBe(DEFAULT_INSTANCE_SETTINGS_PATH);
    expect(
      filterHiddenInstanceSettingsPath("/organization/settings/instance/environments", hidden),
    ).toBe(DEFAULT_INSTANCE_SETTINGS_PATH);
  });

  it("keeps visible pages and non-settings paths untouched", () => {
    expect(
      filterHiddenInstanceSettingsPath("/organization/settings/instance/experimental", hidden),
    ).toBe("/organization/settings/instance/experimental");
    expect(filterHiddenInstanceSettingsPath("/dashboard", hidden)).toBe("/dashboard");
    expect(
      filterHiddenInstanceSettingsPath("/organization/settings/instance/plugins", new Set()),
    ).toBe("/organization/settings/instance/plugins");
  });
});
