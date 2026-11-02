import { expect, test } from "@playwright/test";
import { mockOnboardingLocalAiConnection } from "./helpers/onboarding-ai-connection";
import {
  expectLandsOnFirstTaskWithoutDashboardBounce,
  instrumentNavLog,
} from "./helpers/onboarding-landing";
import { ensureOrganization } from "./helpers/organization";

/** The name the CEO role fills in — see AGENT_ROLE_LABELS. */
const AGENT_NAME = "CEO";

/** Wait for the saved question before checking its dismissed presentation. */
async function expectOpeningQuestionDismissed(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("task-chat-unanswered-question")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("task-chat-composer-takeover")).toHaveCount(0);
  await expect(page.getByTestId("task-chat-pending-input-indicator")).toHaveCount(0);
  await expect(page.getByTestId("task-chat-composer-mode")).toBeVisible({ timeout: 30_000 });
}

/** The opening question arrives after the interactions fetch. Dismiss it once. */
async function dismissOpeningCard(page: import("@playwright/test").Page) {
  const takeover = page.getByTestId("task-chat-composer-takeover");
  await expect(takeover).toBeVisible({ timeout: 30_000 });
  await takeover.getByRole("button", { name: "Cancel", exact: true }).click();
  await expectOpeningQuestionDismissed(page);
}

test("captures planning mode UI for desktop and mobile", async ({ page }) => {
  const timestamp = Date.now();
  const screenshotDir = "test-results/planning-mode";

  await instrumentNavLog(page);
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
    const real = await fetch(new URL(req.url()).toString(), {
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

  // With an organization in place, /onboarding opens on the agent step.
  await ensureOrganization(page.request);
  await page.goto("/onboarding");

  // The agent step asks for a name and nothing else; the name is what gates
  // "Next", and the hire is filed under the neutral `general` role.
  await page.waitForSelector("#onboarding-agent-name", { timeout: 30_000 });
  await page.locator("#onboarding-agent-name").fill(AGENT_NAME);

  await page.getByRole("button", { name: /^Next$/ }).click();

  // The connect step arrives with no source selected — the tile row is a
  // question, not a confirmation — so its CTA stays disabled until one is
  // pressed. It reads "Connect", not "Next": the button starts the sign-in
  // where there is one to start. The test simulates successful local account
  // connection, then exercises the real first-task creation flow.
  //
  // Waited on for enabled rather than visible: it is already on screen, and
  // clicking a disabled button raises nothing and does nothing. A source the
  // organization already connected skips straight to review.
  const source = page.getByRole("radio").first();
  await source.waitFor({ timeout: 30_000 });
  await source.click();
  const connectNext = page.getByRole("button", { name: /^Connect$/ });
  const getStarted = page.getByRole("button", { name: /Get started/ });
  await expect(connectNext.or(getStarted)).toBeVisible({ timeout: 30_000 });
  if (await connectNext.isVisible()) {
    await expect(connectNext).toBeEnabled({ timeout: 30_000 });
    await connectNext.click();
  }

  // The review step names the agent rather than the step.
  await expect(
    page.getByRole("heading", { name: "Let's get started..." }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Get started/ }).click();
  // The wizard now drops the user straight onto the first task's detail page,
  // and must not bounce through the dashboard (PAP-404).
  await expectLandsOnFirstTaskWithoutDashboardBounce(page);

  // Earlier specs may have onboarded too, so identify this run's first task
  // by the page it landed on rather than by its title.
  const baseOrigin = new URL(page.url()).origin;
  const landedRef = decodeURIComponent(new URL(page.url()).pathname.split("/").pop() ?? "");
  const issueRes = await page.request.get(`${baseOrigin}/api/issues/${encodeURIComponent(landedRef)}`);
  expect(issueRes.ok()).toBe(true);
  const issue = await issueRes.json();
  const issueIdentifier = issue.identifier ?? issue.id;
  const issuePath = `/issues/${issueIdentifier}`;
  const issueLinkSelector = `a[href$="/issues/${issueIdentifier}"]`;

  const setMode = async (mode: "standard" | "planning") => {
    const patchRes = await page.request.patch(`${baseOrigin}/api/issues/${issue.id}`, {
      data: { workMode: mode },
    });
    expect(patchRes.ok()).toBe(true);
    await expect
      .poll(async () => {
        const currentRes = await page.request.get(`${baseOrigin}/api/issues/${issue.id}`);
        expect(currentRes.ok()).toBe(true);
        const current = await currentRes.json();
        return current.workMode;
      }, { timeout: 10_000 })
      .toBe(mode);
  };

  await setMode("planning");

  await page.goto(issuePath);
  await dismissOpeningCard(page);
  await page.reload();
  await expectOpeningQuestionDismissed(page);
  await expect(page.getByText("Plan mode").first()).toBeVisible();
  const desktopPlanningToggle = page.getByTestId("task-chat-composer-mode");
  await expect(desktopPlanningToggle).toBeVisible();
  await expect(desktopPlanningToggle).toHaveAttribute("data-pending-work-mode", "planning");

  await page.screenshot({
    path: `${screenshotDir}/desktop-planning-detail-${timestamp}.png`,
    fullPage: true,
  });

  await page.goto(`/issues`);
  await expect(page.locator(issueLinkSelector)).toBeVisible();
  await expect(page.locator(issueLinkSelector)).not.toContainText("Plan mode");
  await page.screenshot({
    path: `${screenshotDir}/desktop-planning-row-${timestamp}.png`,
    fullPage: true,
  });

  await page.goto(issuePath);
  await expectOpeningQuestionDismissed(page);
  await page.getByTestId("task-chat-composer-mode").click();
  await expect(page.getByTestId("task-chat-composer-mode")).toHaveCount(0);
  await expect(page.getByTestId("task-chat-composer-add")).toBeVisible();
  await page.screenshot({
    path: `${screenshotDir}/desktop-standard-toggle-${timestamp}.png`,
    fullPage: true,
  });

  await setMode("planning");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(issuePath);
  await expectOpeningQuestionDismissed(page);
  await expect(page.getByText("Plan mode").first()).toBeVisible();
  const mobilePlanningToggle = page.getByTestId("task-chat-composer-mode");
  await expect(mobilePlanningToggle).toBeVisible();
  await expect(mobilePlanningToggle).toHaveAttribute("data-pending-work-mode", "planning");
  await page.screenshot({
    path: `${screenshotDir}/mobile-planning-detail-${timestamp}.png`,
    fullPage: true,
  });

  await page.goto(`/issues`);
  await expect(page.locator(issueLinkSelector)).toBeVisible();
  await expect(page.locator(issueLinkSelector)).not.toContainText("Plan mode");
  await page.screenshot({
    path: `${screenshotDir}/mobile-planning-row-${timestamp}.png`,
    fullPage: true,
  });
});
