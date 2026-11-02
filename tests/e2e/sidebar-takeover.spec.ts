import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";
import { ensureOrganization } from "./helpers/organization";

/**
 * E2E: contextual sidebar companion model.
 *
 * Most contextual routes render their navigation beside the stable global
 * sidebar. Settings intentionally takes over that sidebar while preserving the
 * account menu, and its Back to app link restores the global navigation.
 *
 * Plugin route sidebars share the same Layout path. A live plugin-route test
 * requires a plugin fixture, so that branch remains covered by Layout tests.
 */

const PORT = Number(process.env.PAPERCLIP_E2E_PORT ?? 3199);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const COLLAPSED_STORAGE_KEY = "paperclip.sidebar.collapsed";
const APP_SIDEBAR_EXPANDED_MARKER = "Collapse sidebar";

async function prepareInstance(board: APIRequestContext): Promise<void> {
  const healthRes = await board.get(`${BASE_URL}/api/health`);
  expect(healthRes.ok()).toBe(true);
  const health = await healthRes.json();
  expect(health.deploymentMode).toBe("local_trusted");

  await ensureOrganization(board, { baseUrl: BASE_URL });
}

test.describe("Contextual sidebar companion", () => {
  let board: APIRequestContext;

  test.beforeAll(async () => {
    board = await pwRequest.newContext({ baseURL: BASE_URL });
    await prepareInstance(board);
  });

  test.afterAll(async () => {
    await board.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.clear();
    }, COLLAPSED_STORAGE_KEY);
  });

  test("replaces global navigation with Settings navigation", async ({ page }) => {
    await page.goto("/organization/settings");

    const contextual = page.locator('[data-contextual-sidebar="settings"]');
    await expect(contextual).toBeVisible();
    await expect(contextual).toHaveCount(1);
    await expect(page.locator("[data-secondary-sidebar]")).toHaveCount(1);

    await expect(contextual.getByRole("link", { name: "General" })).toBeVisible();
    await expect(contextual.getByText("Environments", { exact: true })).toBeVisible();
    await expect(contextual.getByRole("link", { name: "Back to app" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    await expect(page.getByLabel(APP_SIDEBAR_EXPANDED_MARKER)).toHaveCount(0);
  });

  test("renders contextual labels at full width", async ({ page }) => {
    await page.goto("/organization/settings");

    const contextual = page.locator('[data-contextual-sidebar="settings"]');
    const envLabel = contextual.getByText("Environments", { exact: true });
    await expect(envLabel).toBeVisible();
    const labelBox = await envLabel.boundingBox();
    expect(labelBox).not.toBeNull();
    expect(labelBox!.width).toBeGreaterThan(20);
  });

  test("keeps the retired collapse control absent across contextual navigation", async ({ page }) => {
    await page.goto("/organization/settings");
    await expect(page.locator('[data-contextual-sidebar="settings"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to app" })).toBeVisible();
    await expect(page.getByLabel(APP_SIDEBAR_EXPANDED_MARKER)).toHaveCount(0);

    await page.goto(`/dashboard`);

    await expect(page.locator("[data-contextual-sidebar]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByLabel(APP_SIDEBAR_EXPANDED_MARKER)).toHaveCount(0);
  });

  test("uses Dashboard as the destination for a direct Settings link", async ({ page }) => {
    await page.goto("/organization/settings");
    await page.getByRole("link", { name: "Back to app" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-contextual-sidebar]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });
});
