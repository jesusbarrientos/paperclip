export function isOnboardingPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 && segments[0]?.toLowerCase() === "onboarding";
}

/** The wizard step that asks for the company's mission. */
export const ONBOARDING_MISSION_STEP = 2;

/**
 * The wizard step that asks for the first agent.
 *
 * A company that already has its mission has answered steps 1 and 2 — Cloud
 * collects both at signup and the seed writes the mission as a company-level
 * goal. Opening such a company on "what is the mission?" asks the customer
 * something they answered minutes earlier on another origin, which is the
 * seam the seeded arc exists to remove.
 */
export const ONBOARDING_AGENT_STEP = 3;

export type ExistingCompanyOnboardingStep =
  | typeof ONBOARDING_MISSION_STEP
  | typeof ONBOARDING_AGENT_STEP;

/**
 * The step a company that already exists belongs on: always the agent.
 *
 * This used to branch on whether the company had a mission, sending a company
 * without one to `ONBOARDING_MISSION_STEP` first. Onboarding no longer asks —
 * the mission is collected later, in the tenant app — so the branch had become
 * a way to reach a question the arc had stopped asking. It survived because
 * Cloud's naming screen dropped its own mission field, which left every
 * Cloud-created company looking mission-less on arrival, and so every walk
 * detoured through a step the design had removed.
 *
 * The parameter is gone rather than ignored: callers were running a goal lookup
 * to compute it, and an argument that cannot change the answer is an invitation
 * to keep computing it.
 */
export function onboardingStepForCompany(): ExistingCompanyOnboardingStep {
  return ONBOARDING_AGENT_STEP;
}

export function resolveRouteOnboardingOptions(params: {
  pathname: string;
  organization: { id: string } | null;
  /**
   * Organization creation lives on Cloud for a managed stack (in-app creation
   * is a 403 floor), so there a bare `/onboarding` must never open the create
   * wizard: it would be a dead end wearing a form.
   */
  cloudManaged?: boolean;
}): { initialStep: 1 | ExistingCompanyOnboardingStep; companyId?: string } | null {
  if (!isOnboardingPath(params.pathname)) return null;
  if (params.organization) {
    return { initialStep: onboardingStepForCompany(), companyId: params.organization.id };
  }
  if (params.cloudManaged) return null;
  return { initialStep: 1 };
}

/**
 * Whether a company with no agents should be sent to onboarding rather than
 * left on the dashboard.
 *
 * A company with no agent cannot do anything: no runs, no tasks, nothing to
 * show. The dashboard already says so in a banner with a "Create one here"
 * link, which asks the customer to notice a problem the product could simply
 * fix for them.
 *
 * It also closes the gap a Cloud-provisioned stack falls into. Cloud creates
 * the company before the tenant boots, so `shouldRedirectCompanylessRouteToOnboarding`
 * never fires — a seeded customer arrives at an empty dashboard having just
 * answered a signup flow, and nothing routes them onward.
 *
 * `agentsLoaded` is required rather than optional on purpose. Callers hold
 * agents as `Agent[] | undefined` while the query is in flight, and an absent
 * list reads exactly like an empty one — redirecting on that would bounce
 * every user through onboarding on each cold load.
 *
 * `agentsRefreshing` covers the other way a count of zero lies: a cached list
 * that is being refetched. The wizard hires the first agent and then lands on
 * the first task; a dashboard reached from there can hold the empty list it
 * cached before the hire, with the refetch still in flight. Offering on that
 * list reopens "Create your first agent" for a company that just got one,
 * and the customer walks the agent and model steps a second time.
 */
export function shouldRouteAgentlessCompanyToOnboarding(params: {
  pathname: string;
  agentsLoaded: boolean;
  agentsRefreshing?: boolean;
  agentCount: number;
}): boolean {
  if (!params.agentsLoaded) return false;
  if (params.agentsRefreshing) return false;
  if (params.agentCount > 0) return false;
  // Already there. Redirecting onto the path we are on is the loop that
  // "finished the wizard but created no agent" would otherwise spin in.
  return !isOnboardingPath(params.pathname);
}

/**
 * Whether the wizard's Back button is offered on the current step.
 *
 * A run never walks back behind the step it entered on: those steps either do
 * not apply to it (an existing company is already named, and its mission is
 * hydrated rather than asked for) or were completed elsewhere. Walking back
 * into step 1 while holding a company is the sharpest case — that step creates
 * a company, so it would make a second one.
 */
export function canGoBackFromOnboardingStep(params: {
  currentStep: number;
  entryStep: number;
}): boolean {
  return params.currentStep > 1 && params.currentStep > params.entryStep;
}

/**
 * Whether a completed progress-bar segment can be clicked to jump back to it.
 *
 * Same bound as {@link canGoBackFromOnboardingStep}. The progress bar applies
 * only the "already completed" half of the rule, which lets a run entered on
 * an existing company jump to the name and mission steps the Back button
 * deliberately withholds.
 */
export function canJumpToOnboardingStep(params: {
  targetStep: number;
  currentStep: number;
  entryStep: number;
}): boolean {
  return (
    params.targetStep < params.currentStep && params.targetStep >= params.entryStep
  );
}

/**
 * Whether the onboarding wizard is currently covering the screen — either
 * opened explicitly via the dialog context or auto-opened from the
 * /onboarding route and not yet dismissed. While this is true the route
 * launcher must not render interactive content, so it hands off fully to the
 * full-screen wizard instead of staying clickable/focusable behind it
 * (PAP-52).
 */
export function isOnboardingWizardActive(params: {
  onboardingOpen: boolean;
  routeDismissed: boolean;
}): boolean {
  return params.onboardingOpen || !params.routeDismissed;
}
