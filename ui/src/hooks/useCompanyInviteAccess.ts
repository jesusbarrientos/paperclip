import { useQuery } from "@tanstack/react-query";
import { accessApi, type CurrentBoardAccess } from "@/api/access";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Whether a board may invite people to the organization on a self-hosted instance,
 * judged from the current board access snapshot.
 *
 * Mirrors the other client-side role gates (`ToolsAdminGate`, the run
 * ledger): local implicit boards and instance admins always pass; otherwise
 * the active membership must be owner or admin, the roles that carry
 * the `users:invite` grant. Resolves to false while the snapshot is unknown.
 * The server stays authoritative; this only decides whether to offer a
 * shortcut that would otherwise end in a permission error.
 */
export function canInviteCompanyMembers(
  boardAccess: CurrentBoardAccess | undefined,
): boolean {
  if (!boardAccess) return false;
  if (boardAccess.source === "local_implicit" || boardAccess.isInstanceAdmin) return true;
  const membership = boardAccess.memberships?.find((item) => item.status === "active");
  return membership?.membershipRole === "owner" || membership?.membershipRole === "admin";
}

/**
 * Whether the signed-in board may invite people to the organization on a
 * self-hosted instance. Pass `enabled: false` on Cloud, where invitations live
 * in the stack's People settings and use a different rule
 * (see `useCloudInviteUrl`).
 */
export function useCanInviteCompanyMembers(enabled = true): boolean {
  const boardAccess = useQuery({
    queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess(),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  return enabled && canInviteCompanyMembers(boardAccess.data);
}
