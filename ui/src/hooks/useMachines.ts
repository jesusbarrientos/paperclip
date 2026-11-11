import { useQuery } from "@tanstack/react-query";
import { accessApi } from "@/api/access";
import { machinesApi, workContextsApi } from "@/api/machines";
import { queryKeys } from "@/lib/queryKeys";

export function useMachines(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.machines.list(),
    queryFn: () => machinesApi.list(),
    enabled: options.enabled ?? true,
  });
}

export function useIssueWorkContext(issueId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.workContexts.detail(issueId ?? ""),
    queryFn: () => workContextsApi.get(issueId!),
    enabled: Boolean(issueId),
  });
}

export function useCurrentBoardAccess() {
  return useQuery({
    queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess(),
    retry: false,
    staleTime: 30_000,
  });
}
