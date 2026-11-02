import { describe, expect, it } from "vitest";
import {
  isOnboardingPath,
  isOnboardingWizardActive,
  onboardingStepForCompany,
  resolveRouteOnboardingOptions,
  shouldRouteAgentlessCompanyToOnboarding,
  ONBOARDING_AGENT_STEP,
  ONBOARDING_MISSION_STEP,
} from "./onboarding-route";

describe("isOnboardingPath", () => {
  it("matches the onboarding route", () => {
    expect(isOnboardingPath("/onboarding")).toBe(true);
  });

  it("ignores non-onboarding routes", () => {
    expect(isOnboardingPath("/dashboard")).toBe(false);
    expect(isOnboardingPath("/onboarding/extra")).toBe(false);
  });
});

describe("resolveRouteOnboardingOptions", () => {
  it("opens organization creation when the instance has none", () => {
    expect(
      resolveRouteOnboardingOptions({ pathname: "/onboarding", organization: null }),
    ).toEqual({ initialStep: 1 });
  });

  it("opens the agent step, never the mission step, for an existing organization", () => {
    const resolved = resolveRouteOnboardingOptions({
      pathname: "/onboarding",
      organization: { id: "org-1" },
    });
    expect(resolved).toEqual({ initialStep: ONBOARDING_AGENT_STEP, companyId: "org-1" });
    expect(resolved!.initialStep).not.toBe(ONBOARDING_MISSION_STEP);
  });

  it("opens nothing off the onboarding route", () => {
    expect(
      resolveRouteOnboardingOptions({ pathname: "/dashboard", organization: null }),
    ).toBeNull();
  });

  it("never resolves into the create wizard on a managed stack", () => {
    expect(
      resolveRouteOnboardingOptions({ pathname: "/onboarding", organization: null, cloudManaged: true }),
    ).toBeNull();
    expect(
      resolveRouteOnboardingOptions({
        pathname: "/onboarding",
        organization: { id: "org-1" },
        cloudManaged: true,
      }),
    ).toEqual({ initialStep: ONBOARDING_AGENT_STEP, companyId: "org-1" });
  });
});

describe("isOnboardingWizardActive", () => {
  it("is active on the freshly-landed onboarding route (auto-open, not dismissed)", () => {
    expect(
      isOnboardingWizardActive({ onboardingOpen: false, routeDismissed: false }),
    ).toBe(true);
  });

  it("hands off to the launcher once the wizard is dismissed and not re-opened", () => {
    expect(
      isOnboardingWizardActive({ onboardingOpen: false, routeDismissed: true }),
    ).toBe(false);
  });

  it("stays active when explicitly re-opened after a dismissal", () => {
    expect(
      isOnboardingWizardActive({ onboardingOpen: true, routeDismissed: true }),
    ).toBe(true);
  });
});

describe("shouldRouteAgentlessCompanyToOnboarding", () => {
  it("sends a company with no agents to onboarding", () => {
    expect(
      shouldRouteAgentlessCompanyToOnboarding({
        pathname: "/dashboard",
        agentsLoaded: true,
        agentCount: 0,
      }),
    ).toBe(true);
  });

  it("leaves a company that has agents alone", () => {
    expect(
      shouldRouteAgentlessCompanyToOnboarding({
        pathname: "/dashboard",
        agentsLoaded: true,
        agentCount: 1,
      }),
    ).toBe(false);
  });

  it("waits for the agent list before deciding", () => {
    // In flight, the list is undefined and reads exactly like an empty one.
    // Deciding here would bounce every user through onboarding on each cold
    // load — the count is zero only because nothing has arrived yet.
    expect(
      shouldRouteAgentlessCompanyToOnboarding({
        pathname: "/dashboard",
        agentsLoaded: false,
        agentCount: 0,
      }),
    ).toBe(false);
  });

  it("does not trust a cached empty list while it is being refreshed", () => {
    // The wizard hires the first agent and lands on the first task. A
    // dashboard reached from there can still hold the empty list it cached
    // before the hire, with the refetch in flight — offering on it reopens
    // "Create your first agent" for a company that just got one.
    expect(
      shouldRouteAgentlessCompanyToOnboarding({
        pathname: "/dashboard",
        agentsLoaded: true,
        agentsRefreshing: true,
        agentCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldRouteAgentlessCompanyToOnboarding({
        pathname: "/dashboard",
        agentsLoaded: true,
        agentsRefreshing: false,
        agentCount: 0,
      }),
    ).toBe(true);
  });

  it("does not redirect onto onboarding from onboarding", () => {
    // The loop: finish the wizard without creating an agent, and a redirect
    // that ignored the current path would send you straight back in.
    for (const pathname of ["/onboarding", "/onboarding"]) {
      expect(
        shouldRouteAgentlessCompanyToOnboarding({
          pathname,
          agentsLoaded: true,
          agentCount: 0,
        }),
      ).toBe(false);
    }
  });
});

describe("onboardingStepForCompany", () => {
  it("opens an existing company on the agent step", () => {
    expect(onboardingStepForCompany()).toBe(ONBOARDING_AGENT_STEP);
  });

  it("never opens on the mission step, whatever the company's goals say", () => {
    // This used to branch on whether the company had a mission, and a company
    // without one was sent to ask for it first. Onboarding stopped asking — the
    // mission is collected later, in the tenant app — but the branch outlived
    // the question, and because Cloud's naming screen had dropped its own
    // mission field, *every* Cloud-created company arrived looking mission-less
    // and took the detour.
    //
    // There is no argument left to vary, which is the point: the assertion is
    // that the mission step is unreachable from here rather than merely
    // unlikely.
    expect(onboardingStepForCompany()).not.toBe(ONBOARDING_MISSION_STEP);
  });
});
