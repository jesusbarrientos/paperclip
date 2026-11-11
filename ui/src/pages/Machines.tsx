import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Laptop } from "lucide-react";
import type { Machine } from "@paperclipai/shared";
import { ApiError } from "@/api/client";
import { machinesApi } from "@/api/machines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { useCurrentBoardAccess, useMachines } from "@/hooks/useMachines";
import {
  canManageMachine,
  capabilityLabels,
  machineOwnershipLabel,
  machineStatusDotClass,
  machineStatusLabel,
  platformLabel,
} from "@/lib/machines";
import { queryKeys } from "@/lib/queryKeys";
import { timeAgo } from "@/lib/timeAgo";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function instanceUrl() {
  return typeof window === "undefined" ? "<this instance URL>" : window.location.origin;
}

export function MachinePairingInstructions() {
  const url = instanceUrl();
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Pair a computer from its terminal, then keep the daemon running:</p>
      <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
        {`paperclipai machine pair --server ${url}\npaperclipai machine run`}
      </pre>
      <p>The pair command prints an approval link. Open it here, signed in, to approve the machine.</p>
    </div>
  );
}

function MachineRow({
  machine,
  canManage,
  userId,
  onRevoke,
}: {
  machine: Machine;
  canManage: boolean;
  userId: string | null;
  onRevoke: (machine: Machine) => void;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(machine.name);

  const rename = useMutation({
    mutationFn: (name: string) => machinesApi.rename(machine.id, name),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.machines.list() });
      pushToast({ title: "Machine renamed", tone: "success" });
    },
  });

  const capabilities = capabilityLabels(machine.capabilities);
  const tools = machine.capabilities?.tools ?? [];
  const revoked = machine.status === "revoked";
  const trimmedDraft = draft.trim();

  return (
    <div className="space-y-2 px-4 py-3" data-testid={`machine-row-${machine.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn("size-2 shrink-0 rounded-full", machineStatusDotClass(machine))}
          aria-hidden
        />
        {editing ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (trimmedDraft) rename.mutate(trimmedDraft);
            }}
          >
            <Input
              aria-label="Machine name"
              className="h-8 max-w-xs"
              value={draft}
              maxLength={80}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setEditing(false);
                  setDraft(machine.name);
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraft(machine.name);
                rename.reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!trimmedDraft || rename.isPending}>
              {rename.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        ) : (
          <span className="min-w-0 truncate text-sm font-medium">{machine.name}</span>
        )}
        <Badge variant="outline" className="font-normal">
          {machineOwnershipLabel(machine, userId)}
        </Badge>
        <span className="text-xs text-muted-foreground">{machineStatusLabel(machine)}</span>
        {!editing && canManage ? (
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(machine.name);
                setEditing(true);
              }}
            >
              Rename
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRevoke(machine)}>
              Revoke
            </Button>
          </div>
        ) : null}
      </div>
      {rename.error ? (
        <p className="text-sm text-destructive">{errorMessage(rename.error, "Could not rename the machine.")}</p>
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{platformLabel(machine)}</span>
        {machine.hostname ? <span className="font-mono">{machine.hostname}</span> : null}
        <span>
          {revoked
            ? machine.revokedAt
              ? `Revoked ${timeAgo(machine.revokedAt)}`
              : "Revoked"
            : machine.connected
              ? "Connected now"
              : machine.lastSeenAt
                ? `Last seen ${timeAgo(machine.lastSeenAt)}`
                : "Never connected"}
        </span>
        {machine.daemonVersion ? <span className="font-mono">daemon {machine.daemonVersion}</span> : null}
      </div>
      {capabilities.length > 0 || tools.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Capabilities">
          {capabilities.map((label) => (
            <Badge key={label} variant="secondary" className="font-normal">
              {label}
            </Badge>
          ))}
          {tools.map((tool) => (
            <Badge key={`tool:${tool}`} variant="outline" className="font-mono font-normal">
              {tool}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Machines() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const machinesQuery = useMachines();
  const accessQuery = useCurrentBoardAccess();
  const [machineToRevoke, setMachineToRevoke] = useState<Machine | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Settings", href: "/organization/settings" },
      { label: "Machines" },
    ]);
  }, [setBreadcrumbs]);

  const revoke = useMutation({
    mutationFn: (machineId: string) => machinesApi.revoke(machineId),
    onSuccess: async (machine) => {
      setMachineToRevoke(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.machines.list() });
      pushToast({ title: `${machine.name} revoked`, tone: "success" });
    },
  });

  const header = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Laptop className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Machines</h1>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Computers paired with this instance. When you start a task you choose where it runs: the server or one of
        these machines. Capabilities are shown to help you choose; they never route work on their own.
      </p>
    </div>
  );

  if (machinesQuery.isLoading) {
    return (
      <div className="max-w-6xl space-y-6">
        {header}
        <div className="text-sm text-muted-foreground">Loading machines…</div>
      </div>
    );
  }

  if (machinesQuery.error) {
    const message =
      machinesQuery.error instanceof ApiError && machinesQuery.error.status === 403
        ? "Organization access is required to see machines."
        : errorMessage(machinesQuery.error, "Failed to load machines.");
    return (
      <div className="max-w-6xl space-y-6">
        {header}
        <div className="text-sm text-destructive">{message}</div>
      </div>
    );
  }

  const machines = machinesQuery.data ?? [];
  const userId = accessQuery.data?.userId ?? null;

  return (
    <div className="max-w-6xl space-y-6">
      {header}

      {machines.length === 0 ? (
        <Card className="block space-y-3 p-6">
          <p className="text-sm font-medium">No machines yet</p>
          <MachinePairingInstructions />
        </Card>
      ) : (
        <>
          <Card className="block divide-y divide-border p-0">
            {machines.map((machine) => (
              <MachineRow
                key={machine.id}
                machine={machine}
                canManage={canManageMachine(machine, accessQuery.data)}
                userId={userId}
                onRevoke={(target) => {
                  revoke.reset();
                  setMachineToRevoke(target);
                }}
              />
            ))}
          </Card>
          <Card className="block space-y-3 p-4">
            <p className="text-sm font-medium">Pair another machine</p>
            <MachinePairingInstructions />
          </Card>
        </>
      )}

      <AlertDialog
        open={machineToRevoke !== null}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) setMachineToRevoke(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {machineToRevoke?.name ?? "this machine"}?</AlertDialogTitle>
            <AlertDialogDescription>
              The machine is disconnected and its credential stops working. Runs that target it fail until the
              task is moved elsewhere. Pairing it again needs a new approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revoke.error ? (
            <p className="text-sm text-destructive">{errorMessage(revoke.error, "Could not revoke the machine.")}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!machineToRevoke || revoke.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (machineToRevoke) revoke.mutate(machineToRevoke.id);
              }}
            >
              {revoke.isPending ? "Revoking…" : "Revoke machine"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
