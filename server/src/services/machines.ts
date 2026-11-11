import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { environments, machines } from "@paperclipai/db";
import {
  MACHINE_SANDBOX_PROVIDER,
  type Machine,
  type MachineDaemonHello,
  type MachinePairingClaimResponse,
  type MachinePairingDescription,
  type MachinePairingStart,
} from "@paperclipai/shared";
import { conflict, forbidden, notFound } from "../errors.js";
import { isMachineConnected } from "./machine-connections.js";

const PAIRING_TTL_MS = 15 * 60_000;

type MachineRow = typeof machines.$inferSelect;

export interface MachineViewer {
  userId: string | null;
  isInstanceAdmin: boolean;
}

export function hashMachineSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function newSecret(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function toMachine(row: MachineRow): Machine {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.ownerUserId,
    shared: row.shared,
    status: row.status,
    platform: row.platform,
    arch: row.arch,
    hostname: row.hostname,
    daemonVersion: row.daemonVersion,
    capabilities: row.capabilities ?? null,
    workspaceRoot: row.workspaceRoot,
    environmentId: row.environmentId,
    connected: row.status === "authorized" && isMachineConnected(row.id),
    lastSeenAt: row.lastSeenAt,
    authorizedAt: row.authorizedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function canViewMachine(row: MachineRow, viewer: MachineViewer) {
  if (viewer.isInstanceAdmin) return true;
  if (row.shared) return true;
  return row.ownerUserId !== null && row.ownerUserId === viewer.userId;
}

/** Personal machines run only their owner's work; shared ones serve every board user. */
export function canUseMachine(row: MachineRow, viewer: MachineViewer) {
  if (row.status !== "authorized") return false;
  if (row.shared) return true;
  return row.ownerUserId !== null && row.ownerUserId === viewer.userId;
}

export function canManageMachine(row: MachineRow, viewer: MachineViewer) {
  if (viewer.isInstanceAdmin) return true;
  return row.ownerUserId !== null && row.ownerUserId === viewer.userId;
}

export function machineService(db: Db) {
  async function getRow(machineId: string) {
    return db.select().from(machines).where(eq(machines.id, machineId)).then((rows) => rows[0] ?? null);
  }

  async function requirePairing(machineId: string, token: string) {
    const row = await getRow(machineId);
    if (!row || !row.pairingTokenHash || row.pairingTokenHash !== hashMachineSecret(token)) {
      throw notFound("Machine pairing not found");
    }
    return row;
  }

  async function ensureEnvironment(row: MachineRow): Promise<string> {
    if (row.environmentId) return row.environmentId;
    const [environment] = await db
      .insert(environments)
      .values({
        name: `Machine: ${row.name} (${row.id.slice(0, 8)})`,
        description: "Runs on a registered Paperclip machine. Managed by the machine registry.",
        driver: "sandbox",
        config: { provider: MACHINE_SANDBOX_PROVIDER, machineId: row.id, reuseLease: false },
        metadata: { machineManaged: true, machineId: row.id },
      })
      .returning({ id: environments.id });
    await db
      .update(machines)
      .set({ environmentId: environment!.id, updatedAt: new Date() })
      .where(eq(machines.id, row.id));
    return environment!.id;
  }

  return {
    getRow,

    async list(viewer: MachineViewer): Promise<Machine[]> {
      const rows = await db
        .select()
        .from(machines)
        .where(
          viewer.isInstanceAdmin
            ? or(eq(machines.status, "authorized"), eq(machines.status, "revoked"))
            : and(
                eq(machines.status, "authorized"),
                viewer.userId
                  ? or(eq(machines.shared, true), eq(machines.ownerUserId, viewer.userId))
                  : eq(machines.shared, true),
              ),
        )
        .orderBy(desc(machines.createdAt));
      return rows.filter((row) => canViewMachine(row, viewer)).map(toMachine);
    },

    async get(machineId: string, viewer: MachineViewer): Promise<Machine> {
      const row = await getRow(machineId);
      if (!row || !canViewMachine(row, viewer)) throw notFound("Machine not found");
      return toMachine(row);
    },

    async startPairing(input: MachinePairingStart) {
      const token = newSecret("pcmp");
      const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
      const [row] = await db
        .insert(machines)
        .values({
          name: input.name,
          platform: input.platform,
          arch: input.arch,
          hostname: input.hostname ?? null,
          status: "pending",
          pairingTokenHash: hashMachineSecret(token),
          pairingExpiresAt: expiresAt,
        })
        .returning();
      return { machine: row!, token, expiresAt };
    },

    async describePairing(
      machineId: string,
      token: string,
      viewer: MachineViewer & { signedIn: boolean },
    ): Promise<MachinePairingDescription> {
      const row = await requirePairing(machineId, token);
      return {
        machineId: row.id,
        name: row.name,
        platform: row.platform,
        arch: row.arch,
        hostname: row.hostname,
        status: row.status,
        expiresAt: row.pairingExpiresAt?.toISOString() ?? null,
        requiresSignIn: !viewer.signedIn,
        canApproveShared: viewer.isInstanceAdmin,
      };
    },

    async approvePairing(machineId: string, token: string, input: { userId: string; isInstanceAdmin: boolean; shared: boolean }) {
      const row = await requirePairing(machineId, token);
      if (row.status !== "pending") throw conflict(`Machine pairing is already ${row.status}`);
      if (!row.pairingExpiresAt || row.pairingExpiresAt.getTime() < Date.now()) {
        throw conflict("Machine pairing expired. Start pairing again from the machine.");
      }
      if (input.shared && !input.isInstanceAdmin) {
        throw forbidden("Only an instance admin can register a shared machine");
      }
      const now = new Date();
      const [updated] = await db
        .update(machines)
        .set({
          status: "authorized",
          shared: input.shared,
          ownerUserId: input.userId,
          authorizedByUserId: input.userId,
          authorizedAt: now,
          updatedAt: now,
        })
        .where(and(eq(machines.id, row.id), eq(machines.status, "pending")))
        .returning();
      if (!updated) throw conflict("Machine pairing changed while approving");
      await ensureEnvironment(updated);
      return toMachine((await getRow(row.id))!);
    },

    async claimPairing(machineId: string, token: string): Promise<MachinePairingClaimResponse> {
      const row = await requirePairing(machineId, token);
      if (row.status === "revoked") return { status: "revoked" };
      if (row.status === "pending") {
        if (!row.pairingExpiresAt || row.pairingExpiresAt.getTime() < Date.now()) return { status: "expired" };
        return { status: "pending" };
      }
      if (row.credentialIssuedAt) return { status: "already_claimed" };
      const credential = newSecret("pcm");
      const now = new Date();
      const [updated] = await db
        .update(machines)
        .set({
          credentialHash: hashMachineSecret(credential),
          credentialIssuedAt: now,
          pairingTokenHash: null,
          pairingExpiresAt: null,
          updatedAt: now,
        })
        .where(and(eq(machines.id, row.id), isNull(machines.credentialIssuedAt)))
        .returning({ id: machines.id });
      if (!updated) return { status: "already_claimed" };
      return { status: "authorized", machineId: row.id, credential };
    },

    async authenticateCredential(credential: string): Promise<MachineRow | null> {
      if (!credential) return null;
      const row = await db
        .select()
        .from(machines)
        .where(eq(machines.credentialHash, hashMachineSecret(credential)))
        .then((rows) => rows[0] ?? null);
      if (!row || row.status !== "authorized") return null;
      return row;
    },

    async recordHello(machineId: string, hello: MachineDaemonHello) {
      const now = new Date();
      await db
        .update(machines)
        .set({
          platform: hello.platform,
          arch: hello.arch,
          hostname: hello.hostname,
          daemonVersion: hello.daemonVersion,
          capabilities: hello.capabilities,
          workspaceRoot: hello.workspaceRoot,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(machines.id, machineId));
    },

    async touch(machineId: string) {
      await db.update(machines).set({ lastSeenAt: new Date() }).where(eq(machines.id, machineId));
    },

    async rename(machineId: string, name: string, viewer: MachineViewer) {
      const row = await getRow(machineId);
      if (!row || !canViewMachine(row, viewer)) throw notFound("Machine not found");
      if (!canManageMachine(row, viewer)) throw forbidden("Only the owner or an instance admin can rename this machine");
      const [updated] = await db
        .update(machines)
        .set({ name, updatedAt: new Date() })
        .where(eq(machines.id, machineId))
        .returning();
      if (updated!.environmentId) {
        await db
          .update(environments)
          .set({ name: `Machine: ${name} (${updated!.id.slice(0, 8)})`, updatedAt: new Date() })
          .where(eq(environments.id, updated!.environmentId));
      }
      return toMachine(updated!);
    },

    async revoke(machineId: string, viewer: MachineViewer) {
      const row = await getRow(machineId);
      if (!row || !canViewMachine(row, viewer)) throw notFound("Machine not found");
      if (!canManageMachine(row, viewer)) throw forbidden("Only the owner or an instance admin can revoke this machine");
      const now = new Date();
      const [updated] = await db
        .update(machines)
        .set({ status: "revoked", revokedAt: now, credentialHash: null, pairingTokenHash: null, updatedAt: now })
        .where(eq(machines.id, machineId))
        .returning();
      if (updated!.environmentId) {
        await db
          .update(environments)
          .set({ status: "archived", updatedAt: now })
          .where(eq(environments.id, updated!.environmentId));
      }
      return toMachine(updated!);
    },

    /** Resolve the machine behind a machine-managed environment, if any. */
    async findByEnvironmentId(environmentId: string) {
      return db
        .select()
        .from(machines)
        .where(eq(machines.environmentId, environmentId))
        .then((rows) => rows[0] ?? null);
    },
  };
}

export type MachineService = ReturnType<typeof machineService>;
