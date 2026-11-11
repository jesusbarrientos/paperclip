import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  Lock,
  Monitor,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
} from "lucide-react";
import type { Machine, WorkContextState } from "@paperclipai/shared";
import { ApiError } from "@/api/client";
import { workContextsApi } from "@/api/machines";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentBoardAccess, useIssueWorkContext, useMachines } from "@/hooks/useMachines";
import {
  SERVER_LOCATION_KEY,
  canUseMachine,
  currentLocationKey,
  executionLocationView,
  locationFromKey,
  machineStatusDotClass,
  type LocationKey,
} from "@/lib/machines";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { PropertyRow } from "./issue-properties/primitives";
import { PropertyPicker } from "./issue-properties/property-picker";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function locationOptions(machines: Machine[], userId: string | null, state: WorkContextState | undefined) {
  const usable = machines.filter((machine) => canUseMachine(machine, userId));
  const current = state?.machine;
  if (current && !usable.some((machine) => machine.id === current.id)) usable.push(current);
  return usable;
}

function LocationIcon({ machine, isServer }: { machine: Pick<Machine, "connected" | "status"> | null; isServer: boolean }) {
  if (isServer) return <Server className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  if (!machine) return <Monitor className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  return (
    <span className="relative inline-flex shrink-0" aria-hidden>
      <Monitor className="size-3.5 text-muted-foreground" />
      <span className={cn("absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full", machineStatusDotClass(machine))} />
    </span>
  );
}

function RowAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function IssueExecutionLocation({
  issueId,
  issueStatus,
  hasAssignee,
  inline,
}: {
  issueId: string;
  issueStatus: string;
  hasAssignee: boolean;
  inline?: boolean;
}) {
  const queryClient = useQueryClient();
  const stateQuery = useIssueWorkContext(issueId);
  const machinesQuery = useMachines();
  const accessQuery = useCurrentBoardAccess();
  const [moveTarget, setMoveTarget] = useState<LocationKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const state = stateQuery.data;
  const runActive = Boolean(state?.run);

  useEffect(() => {
    if (!runActive) setMoveTarget(null);
  }, [runActive]);

  const applyState = (next: WorkContextState) => {
    queryClient.setQueryData(queryKeys.workContexts.detail(issueId), next);
    void queryClient.invalidateQueries({ queryKey: queryKeys.workContexts.detail(issueId) });
  };

  const setLocation = useMutation({
    mutationFn: (key: LocationKey) => workContextsApi.setLocation(issueId, locationFromKey(key)),
    onSuccess: applyState,
  });
  const runHere = useMutation({
    mutationFn: (key: LocationKey) => workContextsApi.run(issueId, locationFromKey(key)),
    onSuccess: (result) => applyState(result.state),
  });
  const moveHere = useMutation({
    mutationFn: (key: LocationKey) => workContextsApi.handoff(issueId, locationFromKey(key)),
    onSuccess: (result) => {
      setMoveTarget(null);
      applyState(result.state);
    },
    onError: (error) => {
      const conflictState =
        error instanceof ApiError ? (error.body as { state?: WorkContextState } | null)?.state : undefined;
      if (conflictState) queryClient.setQueryData(queryKeys.workContexts.detail(issueId), conflictState);
    },
  });

  const syncNow = useMutation({
    mutationFn: () => workContextsApi.sync(issueId),
    onSuccess: (result) => applyState(result.state),
  });

  const userId = accessQuery.data?.userId ?? null;
  const options = useMemo(
    () => locationOptions(machinesQuery.data ?? [], userId, state),
    [machinesQuery.data, userId, state],
  );
  const machinesById = useMemo(() => new Map(options.map((machine) => [machine.id, machine])), [options]);

  const persistedKey = currentLocationKey(state);
  const selectedKey: LocationKey = runActive
    ? (moveTarget ?? persistedKey)
    : setLocation.isPending && setLocation.variables
      ? setLocation.variables
      : persistedKey;
  const view = executionLocationView(state, selectedKey, { hasAssignee });

  const machineFor = (key: LocationKey) => {
    const location = locationFromKey(key);
    return location.kind === "machine" ? (machinesById.get(location.machineId) ?? null) : null;
  };
  const labelFor = (key: LocationKey) => {
    if (key === SERVER_LOCATION_KEY) return "Server";
    return machineFor(key)?.name ?? "Unknown machine";
  };

  const selectedMachine = machineFor(selectedKey);
  const runMachineKey = state?.run?.executionMachineId
    ? `machine:${state.run.executionMachineId}`
    : view.currentKey;
  const pendingTarget = setLocation.isPending
    ? setLocation.variables
    : runHere.isPending
      ? runHere.variables
      : moveHere.isPending
        ? moveHere.variables
        : undefined;
  const syncing = state?.context?.syncState === "syncing" || syncNow.isPending;
  const busy = setLocation.isPending || runHere.isPending || moveHere.isPending || syncing;
  const error = setLocation.error ?? runHere.error ?? moveHere.error ?? syncNow.error;
  const contextMachine = state?.context?.machineId ? (state.machine ?? null) : null;
  const canRun = view.canRunHere && issueStatus !== "done" && issueStatus !== "cancelled";
  const lastSnapshotSeq = state?.context?.lastSnapshotSeq ?? 0;
  const activity =
    pendingTarget !== undefined
      ? `${moveHere.isPending ? "Stopping the run and moving the work to" : "Bringing the files to"} ${labelFor(pendingTarget)}…`
      : syncing && contextMachine
        ? `Syncing files with ${contextMachine.name}…`
        : null;
  const syncLabel =
    activity ?? (lastSnapshotSeq > 0 ? `Sync now · last snapshot ${lastSnapshotSeq}` : "Sync now · no snapshot yet");

  const selectLocation = (key: LocationKey) => {
    setLocation.reset();
    runHere.reset();
    moveHere.reset();
    syncNow.reset();
    if (view.canPersistSelection) {
      if (key !== persistedKey) setLocation.mutate(key);
    } else {
      setMoveTarget(key);
    }
  };

  if (stateQuery.isLoading) {
    return (
      <PropertyRow label="Runs on">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </PropertyRow>
    );
  }

  if (stateQuery.error) {
    return (
      <PropertyRow label="Runs on">
        <span className="text-sm text-destructive">
          {errorMessage(stateQuery.error, "Could not load the execution location.")}
        </span>
      </PropertyRow>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-1.5" data-testid="issue-execution-location">
        <PropertyPicker
          inline={inline}
          label="Runs on"
          open={pickerOpen && !busy}
          onOpenChange={(open) => setPickerOpen(open && !busy)}
          triggerContent={
            <span className="inline-flex min-w-0 items-center gap-1.5" data-testid="execution-location-trigger">
              <LocationIcon machine={selectedMachine} isServer={selectedKey === SERVER_LOCATION_KEY} />
              <span className={cn("truncate text-sm", busy && "opacity-60")}>{labelFor(selectedKey)}</span>
            </span>
          }
          triggerClassName="min-w-0 max-w-full"
          popoverClassName="w-fit min-w-(--sz-11rem)"
          extra={
            <span className="inline-flex shrink-0 items-center gap-0.5">
              {canRun ? (
                <RowAction
                  label={runHere.isPending ? "Starting…" : `Run on ${labelFor(selectedKey)}`}
                  disabled={busy}
                  onClick={() => runHere.mutate(selectedKey)}
                >
                  <Play className="size-3" />
                </RowAction>
              ) : null}
              {view.canMoveHere ? (
                <RowAction
                  label={moveHere.isPending ? "Moving…" : `Move work to ${labelFor(selectedKey)}`}
                  disabled={busy}
                  onClick={() => moveHere.mutate(selectedKey)}
                >
                  <ArrowRightLeft className="size-3" />
                </RowAction>
              ) : null}
              {activity || (contextMachine?.connected && !runActive) ? (
                <RowAction label={syncLabel} disabled={busy} onClick={() => syncNow.mutate()}>
                  <RefreshCw className={cn("size-3", activity && "motion-safe:animate-spin")} />
                </RowAction>
              ) : null}
              {activity ? (
                <span className="sr-only" role="status">
                  {activity}
                </span>
              ) : null}
            </span>
          }
        >
          <div className="max-h-48 overflow-y-auto overscroll-contain">
            {[SERVER_LOCATION_KEY, ...options.map((machine) => `machine:${machine.id}`)].map((key) => {
              const machine = machineFor(key);
              const unavailable = machine !== null && machine.status !== "authorized";
              return (
                <button
                  key={key}
                  type="button"
                  disabled={unavailable}
                  className={cn(
                    "flex w-full items-center gap-2 whitespace-nowrap rounded px-2 py-1.5 text-xs hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50",
                    key === selectedKey && "bg-accent",
                  )}
                  onClick={() => {
                    setPickerOpen(false);
                    selectLocation(key);
                  }}
                >
                  <LocationIcon machine={machine} isServer={key === SERVER_LOCATION_KEY} />
                  <span className="truncate">{labelFor(key)}</span>
                  {machine ? (
                    <span className="ml-auto pl-3 text-muted-foreground">
                      {machine.status === "revoked" ? "revoked" : machine.connected ? "online" : "offline"}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </PropertyPicker>

        {contextMachine && (state?.context?.syncState === "error" || state?.context?.syncState === "conflict") ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3 shrink-0" aria-hidden />
            {state.context.syncState === "conflict" ? "Sync conflict" : "Sync failed"}
            {state.context.syncError ? `: ${state.context.syncError}` : ""}
          </p>
        ) : null}

        {state?.run ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              Run {state.run.status.replace(/_/g, " ")} on {labelFor(runMachineKey)}
            </span>
            {state.context?.editLocked ? (
              <span className="inline-flex items-center gap-1" title="Files are locked while the run is active">
                <Lock className="size-3" aria-hidden />
                Edits locked
              </span>
            ) : null}
          </p>
        ) : null}

        {state && state.pendingRuntimeRequestCount > 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="size-3" aria-hidden />
            {state.pendingRuntimeRequestCount === 1
              ? "1 permission request pending"
              : `${state.pendingRuntimeRequestCount} permission requests pending`}
          </p>
        ) : null}

        {selectedMachine && selectedMachine.status === "authorized" && !selectedMachine.connected ? (
          <p className="text-xs text-muted-foreground">
            {selectedMachine.name} is offline — work stays on this machine until it reconnects or you move it.
          </p>
        ) : null}

        {view.runActive && !view.canMoveHere ? (
          <p className="text-xs text-muted-foreground">Pick another location to move the running work.</p>
        ) : null}

        {!hasAssignee ? (
          <p className="text-xs text-muted-foreground">Assign an agent to run this task.</p>
        ) : null}

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {errorMessage(error, "The execution location could not be updated.")}
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
