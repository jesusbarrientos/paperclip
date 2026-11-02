import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureOrganization } from "./helpers/organization";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * NUX Phase 4 — visual QA screenshot capture.
 *
 * Boots a throwaway local_trusted instance (see playwright.config.ts webServer)
 * and captures screenshots of every surface integrated by NUX Phases 1–3:
 *   - Team-lead hire step (capsule wizard, PAP-125)
 *   - Conference Room (BoardChat) shell + composer + activity feed
 *   - Artifacts page
 *
 * The onboarding front door and the "Add agents to your org" growth intake
 * were removed with the four-step wizard, so the shots that captured them
 * are gone too.
 *
 * These are structural/rendering checks — LLM-dependent streaming (CEO chat
 * responses, hiring-plan generation) is verified separately on an LLM-backed
 * instance. Screenshots land in ./nux-phase4-shots for upload as evidence.
 */

// Write under the gitignored test-results dir so re-runs leave no untracked
// noise; screenshots are uploaded to the issue as QA evidence, not committed.
const SHOT_DIR = path.join(__dirname, "test-results", "nux-phase4-shots");

function shot(name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  return path.join(SHOT_DIR, name);
}

test.describe("NUX Phase 4 visual QA", () => {
  test("captures every integrated surface", async ({ page }) => {
    // New-NUX surfaces are flag-gated default-OFF (PAP-136/137/138): turn the
    // experimental flag on for this throwaway instance before driving them.
    const flagRes = await page.request.patch("/api/instance/settings/experimental", {
      data: { enableConferenceRoomChat: true },
    });
    expect(flagRes.ok()).toBe(true);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push("PAGEERROR: " + err.message));

    // ── Section A: team-lead hire ─────────────────────────────────────────
    // The organization name step is captured by onboarding.spec.ts, which runs
    // before any organization exists; here /onboarding opens on the hire step.
    await ensureOrganization(page.request);
    await page.goto("/onboarding");
    await page.waitForSelector("#onboarding-agent-name", {
      timeout: 30_000,
    });
    await page.screenshot({ path: shot("04-hire-team-lead.png") });

    // ── Section B: Conference Room (BoardChat) ────────────────────────────
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`/board-chat`);
    await expect(page).toHaveURL(new RegExp(`/board-chat`));
    // (Regression guard for the Rules-of-Hooks crash that previously blanked this page — see PAP-50.)
    await expect(
      page.getByPlaceholder("Ask anything about your organization..."),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2_000); // let welcome bubble + suggestion chips stage in
    await page.screenshot({ path: shot("06-board-chat.png") });

    // ── Section C: Artifacts ──────────────────────────────────────────────
    await page.goto(`/artifacts`);
    await expect(page).toHaveURL(new RegExp(`/artifacts`));
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: shot("07-artifacts.png") });

    for (const f of [
      "04-hire-team-lead.png",
      "06-board-chat.png",
      "07-artifacts.png",
    ]) {
      const p = shot(f);
      expect(fs.existsSync(p), `missing ${f}`).toBe(true);
      expect(fs.statSync(p).size, `empty ${f}`).toBeGreaterThan(1_000);
    }

    // No React Rules-of-Hooks / render crashes on any surface we visited.
    const hookErrors = consoleErrors.filter(
      (e) => /Rendered more hooks|change in the order of Hooks/i.test(e),
    );
    expect(hookErrors, hookErrors.join("\n")).toHaveLength(0);
  });
});
