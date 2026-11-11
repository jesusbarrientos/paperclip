import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth";
import { machinesApi } from "@/api/machines";
import { platformLabel } from "@/lib/machines";
import { queryKeys } from "@/lib/queryKeys";

function PairingCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="block p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        {children}
      </Card>
    </div>
  );
}

function isExpired(expiresAt: string | null) {
  return expiresAt !== null && new Date(expiresAt).getTime() < Date.now();
}

export function MachinePairingPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const machineId = (params.machineId ?? "").trim();
  const token = (searchParams.get("token") ?? "").trim();
  const [shared, setShared] = useState(false);
  const currentPath = useMemo(
    () => `/machines/pair/${encodeURIComponent(machineId)}${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    [machineId, token],
  );

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const pairingQuery = useQuery({
    queryKey: queryKeys.machines.pairing(machineId, token),
    queryFn: () => machinesApi.describePairing(machineId, token),
    enabled: machineId.length > 0 && token.length > 0,
    retry: false,
  });

  const approve = useMutation({
    mutationFn: () => machinesApi.approvePairing(machineId, token, shared),
    onSuccess: async () => {
      await pairingQuery.refetch();
    },
  });

  if (!machineId || !token) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">Invalid machine pairing URL.</div>;
  }

  if (sessionQuery.isLoading || pairingQuery.isLoading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading pairing request…</div>;
  }

  if (pairingQuery.error) {
    const notFound = pairingQuery.error instanceof ApiError && pairingQuery.error.status === 404;
    return (
      <PairingCard title="Pairing request unavailable">
        <p className="mt-2 text-sm text-muted-foreground">
          {notFound
            ? "This pairing link is invalid or was already used. Run `paperclipai machine pair` again on the machine to get a new link."
            : pairingQuery.error instanceof Error
              ? pairingQuery.error.message
              : "The pairing request could not be loaded."}
        </p>
      </PairingCard>
    );
  }

  const pairing = pairingQuery.data;
  if (!pairing) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">Pairing request unavailable.</div>;
  }

  if (pairing.status === "authorized") {
    return (
      <PairingCard title={approve.isSuccess ? "Machine approved" : "Machine already approved"}>
        <p className="mt-2 text-sm text-muted-foreground">
          {pairing.name} is paired with this instance. Return to the terminal on that machine: it finishes pairing on
          its own. Then start the daemon with <span className="font-mono text-foreground">paperclipai machine run</span>.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/organization/settings/instance/machines">View machines</Link>
        </Button>
      </PairingCard>
    );
  }

  if (pairing.status === "revoked") {
    return (
      <PairingCard title="Machine revoked">
        <p className="mt-2 text-sm text-muted-foreground">
          This machine was revoked. Run <span className="font-mono text-foreground">paperclipai machine pair</span> again
          to request a new approval.
        </p>
      </PairingCard>
    );
  }

  if (isExpired(pairing.expiresAt)) {
    return (
      <PairingCard title="Pairing request expired">
        <p className="mt-2 text-sm text-muted-foreground">
          Run <span className="font-mono text-foreground">paperclipai machine pair</span> again on the machine to get a
          new approval link.
        </p>
      </PairingCard>
    );
  }

  if (pairing.requiresSignIn || !sessionQuery.data) {
    return (
      <PairingCard title="Sign in required">
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in, then return to this page to approve the machine. It will run work only for the account that approves
          it.
        </p>
        <Button asChild className="mt-4">
          <Link to={`/auth?next=${encodeURIComponent(currentPath)}`}>Sign in / Create account</Link>
        </Button>
      </PairingCard>
    );
  }

  return (
    <PairingCard title="Approve this machine?">
      <p className="mt-2 text-sm text-muted-foreground">
        A Paperclip machine daemon is asking to run work for you. Approve it only if you started the pairing on this
        computer.
      </p>

      <div className="mt-5 space-y-3 text-sm">
        <div>
          <div className="text-muted-foreground">Name</div>
          <div className="text-foreground">{pairing.name}</div>
        </div>
        {pairing.hostname ? (
          <div>
            <div className="text-muted-foreground">Hostname</div>
            <div className="font-mono text-foreground">{pairing.hostname}</div>
          </div>
        ) : null}
        <div>
          <div className="text-muted-foreground">Platform</div>
          <div className="text-foreground">{platformLabel(pairing)}</div>
        </div>
      </div>

      {pairing.canApproveShared ? (
        <label className="mt-5 flex items-start gap-2 text-sm">
          <Checkbox
            checked={shared}
            onCheckedChange={(checked) => setShared(checked === true)}
            aria-label="Shared machine (available to everyone)"
          />
          <span>
            <span className="font-medium">Shared machine (available to everyone)</span>
            <span className="block text-muted-foreground">
              Leave this off to keep it personal: only you can run work on it.
            </span>
          </span>
        </label>
      ) : null}

      {approve.error ? (
        <p className="mt-4 text-sm text-destructive">
          {approve.error instanceof Error ? approve.error.message : "Could not approve the machine."}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
          {approve.isPending ? "Approving…" : "Approve machine"}
        </Button>
      </div>
    </PairingCard>
  );
}
