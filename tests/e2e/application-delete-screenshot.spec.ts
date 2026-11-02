import { expect, test } from "@playwright/test";
import { ensureOrganization } from "./helpers/organization";

// One-off visual capture for PAP-10817. Connection removal now lives on the
// Connectors page, rather than behind a per-connection setup surface.
test("captures the current app removal confirmations", async ({ page }) => {
  await ensureOrganization(page.request);

  const conn = await page.request.post(`/api/tools/connections`, {
    data: {
      applicationName: "Guarded MCP",
      name: "Primary connection",
      transport: "mcp_remote",
      config: { url: "http://127.0.0.1:65535/mcp" },
    },
  });
  expect(conn.ok(), `connection create failed ${conn.status()}: ${await conn.text()}`).toBe(true);
  const connection = await conn.json();

  await page.goto(`/apps`);
  await expect(page.getByRole("heading", { name: "Connectors" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Manage Primary connection connection" }).click();
  await page.getByRole("menuitem", { name: "Remove connection" }).click();
  await expect(page.getByRole("button", { name: "Remove connection" })).toBeVisible();
  await page.screenshot({ path: "test-results/pap-10817-delete-dialog-guarded.png", fullPage: true });

  await page.request.delete(`/api/tool-connections/${connection.id}`).catch(() => undefined);
});
