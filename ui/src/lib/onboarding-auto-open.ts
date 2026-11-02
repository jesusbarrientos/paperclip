/**
 * Whether onboarding has already been offered automatically.
 *
 * The dashboard opens onboarding when the organization has no agent. That is
 * an offer, and an offer that reappears after it is declined is not one.
 *
 * Module scope rather than state inside the dashboard, on purpose: a ref dies
 * with the component, so navigating away and back would offer again. A page
 * reload does offer again, which is the right scope: that is a new visit
 * rather than the same one continuing.
 */
let offered = false;

/**
 * Records an offer, and reports whether it is the first one. Returns false
 * when onboarding has already been offered, in which case the caller must not
 * open it again.
 */
export function claimOnboardingOffer(): boolean {
  if (offered) return false;
  offered = true;
  return true;
}

/** Forget the offer. For tests, which must not inherit each other's state. */
export function resetOnboardingOffers(): void {
  offered = false;
}
