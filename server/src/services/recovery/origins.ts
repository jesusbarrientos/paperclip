export const RECOVERY_ORIGIN_KINDS = {
  issueGraphLivenessEscalation: "harness_liveness_escalation",
  // Historical tasks retain their origin and recovery-recursion exclusion.
  issueProductivityReview: "issue_productivity_review",
  strandedIssueRecovery: "stranded_issue_recovery",
  staleActiveRunEvaluation: "stale_active_run_evaluation",
} as const;

export const RECOVERY_REASON_KINDS = {
  runLivenessContinuation: "run_liveness_continuation",
} as const;

export const RECOVERY_KEY_PREFIXES = {
  issueGraphLivenessIncident: "harness_liveness",
  issueGraphLivenessLeaf: "harness_liveness_leaf",
} as const;

export type RecoveryOriginKind = typeof RECOVERY_ORIGIN_KINDS[keyof typeof RECOVERY_ORIGIN_KINDS];
export type RecoveryReasonKind = typeof RECOVERY_REASON_KINDS[keyof typeof RECOVERY_REASON_KINDS];
export type RecoveryKeyPrefix = typeof RECOVERY_KEY_PREFIXES[keyof typeof RECOVERY_KEY_PREFIXES];

export function isStrandedIssueRecoveryOriginKind(originKind: string | null | undefined) {
  return originKind === RECOVERY_ORIGIN_KINDS.strandedIssueRecovery;
}

export function buildIssueGraphLivenessIncidentKey(input: {
  issueId: string;
  state: string;
  blockerIssueId?: string | null;
  participantAgentId?: string | null;
}) {
  return [
    RECOVERY_KEY_PREFIXES.issueGraphLivenessIncident,
    input.issueId,
    input.state,
    input.blockerIssueId ?? input.participantAgentId ?? "none",
  ].join(":");
}

export function parseIssueGraphLivenessIncidentKey(incidentKey: string | null | undefined) {
  if (!incidentKey) return null;
  const parts = incidentKey.split(":");
  if (parts[0] !== RECOVERY_KEY_PREFIXES.issueGraphLivenessIncident) return null;
  // Keys stored before single-organization instances carry a company segment.
  if (parts.length === 5) parts.splice(1, 1);
  if (parts.length !== 4) return null;
  const [, issueId, state, leafIssueId] = parts;
  if (!issueId || !state || !leafIssueId) return null;
  return { issueId, state, leafIssueId };
}

export function buildIssueGraphLivenessLeafKey(input: {
  state: string;
  leafIssueId: string;
}) {
  return [
    RECOVERY_KEY_PREFIXES.issueGraphLivenessLeaf,
    input.state,
    input.leafIssueId,
  ].join(":");
}
