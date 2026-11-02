import { beforeEach, describe, expect, it } from "vitest";
import { claimOnboardingOffer, resetOnboardingOffers } from "./onboarding-auto-open";

describe("claimOnboardingOffer", () => {
  beforeEach(resetOnboardingOffers);

  it("lets the first offer through", () => {
    expect(claimOnboardingOffer()).toBe(true);
  });

  it("refuses a second offer", () => {
    // The dashboard effect re-runs whenever a query behind it refetches, and
    // again on every return to the page. Neither may reopen a wizard the
    // customer closed.
    claimOnboardingOffer();
    expect(claimOnboardingOffer()).toBe(false);
  });
});
