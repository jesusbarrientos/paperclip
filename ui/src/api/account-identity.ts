import { useQuery, type QueryClient } from "@tanstack/react-query";
import { authApi } from "./auth";
import { queryKeys } from "../lib/queryKeys";

const sessionQueryOptions = {
  queryKey: queryKeys.auth.session,
  queryFn: () => authApi.getSession(),
  retry: false,
} as const;

/**
 * The signed-in account, as the cache currently understands it.
 *
 * `settled` means the session query *answered*, not merely that it stopped
 * being pending. `null` is a real answer — `authApi.getSession` returns it for
 * a 401, meaning "signed out" — but a session request that *failed* throws
 * rather than returning null. Treating that failure as `null` would key
 * account-scoped data to `anonymous` while the request still carried the
 * user's cookie. So: settled on success only.
 */
export function useAccountIdentity(): { userId: string | null; settled: boolean; failed: boolean } {
  const { data: session, isSuccess, isError } = useQuery(sessionQueryOptions);
  return { userId: session?.user.id ?? null, settled: isSuccess, failed: isError };
}

/**
 * Resolve the account identity for an imperative path, fetching the session if
 * the cache has no answer yet.
 *
 * Not `getQueryData` with a `?? null` fallback: an empty or errored session
 * entry would read as "signed out" and key an authenticated response to
 * `anonymous`. If the identity cannot be obtained the caller must fail rather
 * than guess.
 */
export async function resolveAccountUserId(queryClient: QueryClient): Promise<string | null> {
  const state = queryClient.getQueryState<Awaited<ReturnType<typeof authApi.getSession>>>(
    queryKeys.auth.session,
  );
  // An invalidated entry still reports `success` while holding the previous
  // account until its refetch lands (InviteLanding invalidates the session
  // right after a sign-in and resolves an identity in the next breath).
  if (state?.status === "success" && !state.isInvalidated) {
    return state.data?.user.id ?? null;
  }
  const session = await queryClient.fetchQuery({ ...sessionQueryOptions, staleTime: 0 });
  return session?.user.id ?? null;
}
