import type { heartbeatRuns, issues } from "@paperclipai/db";

/**
 * This claim must be settled by queue-first recovery, not generic terminal-lock
 * cleanup. It is pending intent only; admission still validates its authority.
 */
export function isExplicitContinuationRetryClaim(
  issue: Pick<typeof issues.$inferSelect, "id" | "executionRunId">,
  run: Pick<typeof heartbeatRuns.$inferSelect, "id" | "runtimeMode" | "status" | "contextSnapshot"> | null | undefined,
) {
  return Boolean((run && issue.executionRunId === run.id) &&
    run.runtimeMode === "legacy" && ["failed", "timed_out"].includes(run.status) &&
    run.contextSnapshot?.issueId === issue.id && run.contextSnapshot.explicitUserContinuation);
}
