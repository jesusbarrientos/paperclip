import { test, expect, type Page } from "@playwright/test";
import { mockOnboardingLocalAiConnection } from "./helpers/onboarding-ai-connection";
import {
  expectLandsOnFirstTaskWithoutDashboardBounce,
  instrumentNavLog,
} from "./helpers/onboarding-landing";
import { ensureOrganization } from "./helpers/organization";

/**
 * E2E: post-wizard onboarding launch.
 *
 * Completing the onboarding wizard now creates the first assigned task and
 * drops the user straight onto that task's detail page (not the dashboard),
 * so they land in the conversation the agent will start in. The chat intro
 * still has unit coverage in BoardChat tests.
 */

const FIRST_TASK_TITLE = "Paperclip onboarding";

/**
 * Intercept authentication, environment checks, and hiring so no real CLI check
 * runs and no real agent process spawns (the hire still happens server-side
 * with an inert http adapter).
 */
async function installLaunchIntercepts(page: Page, baseURL?: string) {
  await mockOnboardingLocalAiConnection(page);
  await page.route("**/test-environment", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "pass", checks: [] }),
    }),
  );

  await page.route("**/agent-hires", async (route) => {
    const req = route.request();
    const body = JSON.parse(req.postData() || "{}");
    const auth = req.headers().authorization;
    const real = await fetch(new URL(req.url(), baseURL).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify({
        name: body.name,
        role: body.role,
        adapterType: "http",
        adapterConfig: { url: "http://127.0.0.1:1/dead" },
        runtimeConfig: { heartbeat: { enabled: false } },
      }),
    });
    await route.fulfill({
      status: real.status,
      contentType: "application/json",
      body: await real.text(),
    });
  });
}

/**
 * Drive the wizard from the /onboarding route through to "Get started". The
 * organization exists already, so the route opens on the agent step.
 */
async function runOnboardingWizard(page: Page) {
  await ensureOrganization(page.request);
  await page.goto("/onboarding");

  // Step 3: name the agent. The role picker is gone — the arc asks for a
  // name and hires under the neutral `general` role.
  await page.waitForSelector("#onboarding-agent-name", { timeout: 30_000 });
  await page.locator("#onboarding-agent-name").fill("Ada");
  await page.getByRole("button", { name: /^Next$/ }).click();

  // Step 4: pick a model source, then advance. Nothing is selected on arrival
  // — the row is a question, not a confirmation — so the CTA is disabled until
  // a tile is pressed. By role rather than by label: which adapters the tiles
  // offer depends on the registry this environment reports.
  const source = page.getByRole("radio").first();
  await source.waitFor({ timeout: 30_000 });
  await source.click();

  // "Connect", not "Next": this step's button starts the sign-in where there
  // is one to start, so it is named for what it does. This test simulates
  // successful local account connection before the environment check and hire.
  // A source the organization already connected skips straight to review.
  //
  // Waited on for enabled rather than for visible: it is already on screen,
  // disabled, and clicking a disabled button raises nothing and does nothing.
  const connectNext = page.getByRole("button", { name: /^Connect$/ });
  const getStarted = page.getByRole("button", { name: /Get started/ });
  await expect(connectNext.or(getStarted)).toBeVisible({ timeout: 30_000 });
  if (await connectNext.isVisible()) {
    await expect(connectNext).toBeEnabled({ timeout: 30_000 });
    await connectNext.click();
  }

  // Step 5: review → Get started creates the first task and opens its
  // detail page.
  await getStarted.waitFor({ timeout: 20_000 });
  await getStarted.click();
}

async function assertFirstTaskExists(page: Page) {
  const issuesRes = await page.request.get(`/api/issues`);
  expect(issuesRes.ok()).toBe(true);
  const issues = await issuesRes.json();
  const firstTask = issues.find(
    (candidate: { title: string }) => candidate.title === FIRST_TASK_TITLE,
  );
  expect(firstTask).toBeTruthy();
  await expect(page.getByText(FIRST_TASK_TITLE).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("First-task launch after onboarding wizard", () => {
  test("creates the first task and opens its detail page", async ({ page, baseURL }) => {
    await instrumentNavLog(page);
    await installLaunchIntercepts(page, baseURL);

    await runOnboardingWizard(page);

    await expectLandsOnFirstTaskWithoutDashboardBounce(page);
    await assertFirstTaskExists(page);
  });
});
