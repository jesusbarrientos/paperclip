import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type QueryClient, type QueryKey, useQueryClient } from "@tanstack/react-query";
import {
  SharedPollingCoordinator,
  type SharedMessage,
  type SharedPollingSnapshot,
} from "../lib/cross-tab-poll";
import { filterLocalInboxArchivedQueryData } from "../lib/inboxArchiveCache";

type RefetchInterval = number | false;

export interface SharedPollingQueryOptions {
  resourceKey: string;
  queryKey: QueryKey;
  enabled?: boolean;
  refetchInterval?: RefetchInterval;
  /**
   * When true, non-leader tabs disable their active polling/query fetch for this
   * resource and render from broadcast/cache data. Use for interval-polled hot
   * endpoints. Leave false for one-shot reads where blank first paint is worse
   * than a duplicated initial fetch.
   */
  leaderOnly?: boolean;
}

export interface SharedPollingQueryState<TData> {
  isLeader: boolean;
  enabled: boolean;
  refetchInterval: RefetchInterval;
  publish: (data: TData | undefined, dataUpdatedAt: number) => void;
}

type RegistryEntry = {
  coordinator: SharedPollingCoordinator;
  refs: number;
};

let registry: RegistryEntry | null = null;

function acquireCoordinator(): SharedPollingCoordinator {
  if (registry) {
    registry.refs += 1;
    return registry.coordinator;
  }
  const coordinator = new SharedPollingCoordinator();
  coordinator.start();
  registry = { coordinator, refs: 1 };
  return coordinator;
}

function releaseCoordinator(): void {
  if (!registry) return;
  registry.refs -= 1;
  if (registry.refs > 0) return;
  registry.coordinator.stop();
  registry = null;
}

function resourceKey(key: string, queryKeyHash: string): string {
  return `${key}:${queryKeyHash}`;
}

export function applySharedPollingResult<TData>(
  queryClient: Pick<QueryClient, "getQueryState" | "setQueryData">,
  queryKey: QueryKey,
  message: SharedMessage,
): boolean {
  if (message.type !== "result") return false;
  const incomingUpdatedAt = message.dataUpdatedAt ?? message.at;
  if (incomingUpdatedAt <= 0) return false;
  const localUpdatedAt = queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
  if (localUpdatedAt >= incomingUpdatedAt) return false;
  const data = filterLocalInboxArchivedQueryData(queryKey, message.data as TData);
  queryClient.setQueryData(queryKey, data, { updatedAt: incomingUpdatedAt });
  return true;
}

export function useSharedPollingQuery<TData>({
  resourceKey: rawResourceKey,
  queryKey,
  enabled = true,
  refetchInterval = false,
  leaderOnly = false,
}: SharedPollingQueryOptions): SharedPollingQueryState<TData> {
  const queryClient = useQueryClient();
  const queryKeyHash = useMemo(() => JSON.stringify(queryKey), [queryKey]);
  const fullResourceKey = enabled ? resourceKey(rawResourceKey, queryKeyHash) : null;
  const queryKeyRef = useRef(queryKey);
  const [snapshot, setSnapshot] = useState<SharedPollingSnapshot>({ isLeader: true });

  // Coordinator notifications arrive as fresh snapshot objects, and
  // `subscribe` invokes its listener synchronously from inside the mount
  // effect. Passing `setSnapshot` straight through would schedule a nested
  // re-render for every notification — including value-equal ones — and those
  // wasted commits count toward React's nested-update limit. Under a hostile
  // mount cascade (many shared-polling hooks mounting while the backend is
  // cold) that budget is shared with every other effect-driven update, so
  // keep the previous state object whenever leadership did not change and
  // let React bail out instead.
  const applySnapshot = useCallback((next: SharedPollingSnapshot) => {
    setSnapshot((prev) => (prev.isLeader === next.isLeader ? prev : next));
  }, []);

  useEffect(() => {
    queryKeyRef.current = queryKey;
  }, [queryKey, queryKeyHash]);

  useEffect(() => {
    if (!fullResourceKey) {
      applySnapshot({ isLeader: true });
      return;
    }

    const coordinator = acquireCoordinator();
    const unsubscribeState = coordinator.subscribe(applySnapshot);
    const unsubscribeResource = coordinator.subscribeResource(fullResourceKey, (message) => {
      applySharedPollingResult(queryClient, queryKeyRef.current, message);
    });
    coordinator.request(fullResourceKey);

    return () => {
      unsubscribeResource();
      unsubscribeState();
      releaseCoordinator();
    };
  }, [applySnapshot, fullResourceKey, leaderOnly, queryClient, queryKeyHash]);

  const isLeader = !leaderOnly || snapshot.isLeader;
  const queryEnabled = enabled && (!leaderOnly || snapshot.isLeader);
  const coordinatedInterval = leaderOnly && !snapshot.isLeader ? false : refetchInterval;

  const publish = useCallback((data: TData | undefined, dataUpdatedAt: number) => {
    if (!fullResourceKey || data === undefined) return;
    registry?.coordinator.publish(fullResourceKey, data, dataUpdatedAt);
  }, [fullResourceKey]);

  return useMemo(
    () => ({
      isLeader,
      enabled: queryEnabled,
      refetchInterval: coordinatedInterval,
      publish,
    }),
    [coordinatedInterval, isLeader, publish, queryEnabled],
  );
}

export function usePublishSharedQueryData<TData>(
  shared: Pick<SharedPollingQueryState<TData>, "publish" | "isLeader">,
  data: TData | undefined,
  dataUpdatedAt: number,
): void {
  useEffect(() => {
    if (!shared.isLeader || dataUpdatedAt <= 0) return;
    shared.publish(data, dataUpdatedAt);
  }, [data, dataUpdatedAt, shared]);
}
