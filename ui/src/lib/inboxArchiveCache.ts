import { useSyncExternalStore } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { Issue } from "@paperclipai/shared";
import { queryKeys } from "./queryKeys";

export type InboxIssueCacheSnapshot = Array<readonly [QueryKey, Issue[] | undefined]>;

export const INBOX_ARCHIVE_CONFIRMATION_GRACE_MS = 5_000;
const INBOX_ARCHIVE_MAX_GUARD_MS = 30_000;
const EMPTY_ARCHIVED_ISSUE_IDS: ReadonlySet<string> = new Set();

type InboxArchiveGuardState = {
  issueIds: ReadonlySet<string>;
  listeners: Set<() => void>;
  confirmationTimers: Map<string, ReturnType<typeof setTimeout>>;
  maximumTimers: Map<string, ReturnType<typeof setTimeout>>;
};

const inboxArchiveGuard: InboxArchiveGuardState = {
  issueIds: EMPTY_ARCHIVED_ISSUE_IDS,
  listeners: new Set(),
  confirmationTimers: new Map(),
  maximumTimers: new Map(),
};

function publishInboxArchiveGuard(state: InboxArchiveGuardState, issueIds: Set<string>) {
  state.issueIds = issueIds.size > 0 ? issueIds : EMPTY_ARCHIVED_ISSUE_IDS;
  for (const listener of state.listeners) listener();
}

function clearArchiveGuardTimer(
  timers: Map<string, ReturnType<typeof setTimeout>>,
  issueId: string,
) {
  const timer = timers.get(issueId);
  if (timer) clearTimeout(timer);
  timers.delete(issueId);
}

export function beginLocalInboxArchive(issueId: string) {
  const state = inboxArchiveGuard;
  clearArchiveGuardTimer(state.confirmationTimers, issueId);
  clearArchiveGuardTimer(state.maximumTimers, issueId);

  const issueIds = new Set(state.issueIds);
  issueIds.add(issueId);
  publishInboxArchiveGuard(state, issueIds);
}

export function boundLocalInboxArchive(issueId: string) {
  const state = inboxArchiveGuard;
  if (!state.issueIds.has(issueId)) return;

  clearArchiveGuardTimer(state.maximumTimers, issueId);
  state.maximumTimers.set(issueId, setTimeout(() => {
    clearLocalInboxArchive(issueId);
  }, INBOX_ARCHIVE_MAX_GUARD_MS));
}

export function confirmLocalInboxArchive(issueId: string) {
  const state = inboxArchiveGuard;
  if (!state.issueIds.has(issueId)) return;

  clearArchiveGuardTimer(state.confirmationTimers, issueId);
  state.confirmationTimers.set(issueId, setTimeout(() => {
    clearLocalInboxArchive(issueId);
  }, INBOX_ARCHIVE_CONFIRMATION_GRACE_MS));
}

export function clearLocalInboxArchive(issueId: string) {
  const state = inboxArchiveGuard;
  clearArchiveGuardTimer(state.confirmationTimers, issueId);
  clearArchiveGuardTimer(state.maximumTimers, issueId);
  if (!state.issueIds.has(issueId)) return;

  const issueIds = new Set(state.issueIds);
  issueIds.delete(issueId);
  publishInboxArchiveGuard(state, issueIds);
}

export function getLocalInboxArchiveIssueIds(): ReadonlySet<string> {
  return inboxArchiveGuard.issueIds;
}

export function useLocalInboxArchiveIssueIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      inboxArchiveGuard.listeners.add(listener);
      return () => {
        inboxArchiveGuard.listeners.delete(listener);
      };
    },
    () => getLocalInboxArchiveIssueIds(),
    () => EMPTY_ARCHIVED_ISSUE_IDS,
  );
}

export function filterLocalInboxArchivedIssues(
  issues: Issue[],
): Issue[] {
  const issueIds = getLocalInboxArchiveIssueIds();
  if (issueIds.size === 0) return issues;
  return issues.filter((issue) => !issueIds.has(issue.id));
}

function isInboxIssueQueryKey(queryKey: QueryKey): boolean {
  return queryKey[0] === "issues"
    && queryKey[1] === "list"
    && ["compact", "mine-by-me", "touched-by-me", "unread-touched-by-me"].includes(String(queryKey[2]));
}

export function filterLocalInboxArchivedQueryData<TData>(queryKey: QueryKey, data: TData): TData {
  if (!isInboxIssueQueryKey(queryKey) || !Array.isArray(data)) return data;
  return filterLocalInboxArchivedIssues(data as Issue[]) as TData;
}

function inboxIssueQueryPrefixes() {
  return [
    [...queryKeys.issues.list(), "compact"],
    queryKeys.issues.listMineByMe(),
    queryKeys.issues.listTouchedByMe(),
    queryKeys.issues.listUnreadTouchedByMe(),
  ] as const;
}

function resolveRestoreIndex(currentData: Issue[], previousData: Issue[], previousIndex: number) {
  for (let index = previousIndex - 1; index >= 0; index -= 1) {
    const beforeIndex = currentData.findIndex((issue) => issue.id === previousData[index]?.id);
    if (beforeIndex >= 0) return beforeIndex + 1;
  }

  for (let index = previousIndex + 1; index < previousData.length; index += 1) {
    const afterIndex = currentData.findIndex((issue) => issue.id === previousData[index]?.id);
    if (afterIndex >= 0) return afterIndex;
  }

  return Math.min(previousIndex, currentData.length);
}

export async function cancelInboxIssueQueries(queryClient: QueryClient) {
  await Promise.all(
    inboxIssueQueryPrefixes().map((queryKey) =>
      queryClient.cancelQueries({ queryKey }),
    ),
  );
}

export function snapshotInboxIssueCaches(
  queryClient: QueryClient,
): InboxIssueCacheSnapshot {
  return inboxIssueQueryPrefixes().flatMap((queryKey) =>
    queryClient.getQueriesData<Issue[]>({ queryKey }),
  );
}

export function removeIssueFromInboxCaches(
  queryClient: QueryClient,
  issueId: string,
) {
  for (const queryKey of inboxIssueQueryPrefixes()) {
    queryClient.setQueriesData<Issue[]>(
      { queryKey },
      (cached) => cached?.filter((issue) => issue.id !== issueId),
    );
  }
}

export function restoreIssueToInboxCaches(
  queryClient: QueryClient,
  snapshot: InboxIssueCacheSnapshot,
  issueId: string,
) {
  for (const [queryKey, previousData] of snapshot) {
    if (!previousData) continue;

    const previousIndex = previousData.findIndex((issue) => issue.id === issueId);
    if (previousIndex < 0) continue;

    const issueToRestore = previousData[previousIndex];
    queryClient.setQueryData<Issue[]>(queryKey, (currentData) => {
      if (currentData?.some((issue) => issue.id === issueId)) return currentData;

      const nextData = [...(currentData ?? [])];
      nextData.splice(resolveRestoreIndex(nextData, previousData, previousIndex), 0, issueToRestore);
      return nextData;
    });
  }
}

export function invalidateInboxIssueQueries(queryClient: QueryClient) {
  return Promise.all([
    ...inboxIssueQueryPrefixes().map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
    queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges() }),
  ]);
}

export function getIssuePresenceInActiveInboxCaches(
  queryClient: QueryClient,
  issueId: string,
): "absent" | "present" | "unknown" {
  const activeQueries = inboxIssueQueryPrefixes().flatMap((queryKey) =>
    queryClient.getQueryCache().findAll({ queryKey })
      .filter((query) => query.getObserversCount() > 0),
  );
  if (activeQueries.length === 0) return "unknown";

  const isPresent = activeQueries.some((query) => {
    const data = query.state.data;
    return Array.isArray(data) && data.some((issue) => (issue as Issue).id === issueId);
  });
  return isPresent ? "present" : "absent";
}
