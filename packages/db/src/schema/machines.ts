import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { MachineCapabilities, MachineStatus } from "@paperclipai/shared";
import { environments } from "./environments.js";

export const machines = pgTable(
  "machines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id"),
    shared: boolean("shared").notNull().default(false),
    status: text("status").$type<MachineStatus>().notNull().default("pending"),
    platform: text("platform"),
    arch: text("arch"),
    hostname: text("hostname"),
    daemonVersion: text("daemon_version"),
    capabilities: jsonb("capabilities").$type<MachineCapabilities>(),
    workspaceRoot: text("workspace_root"),
    environmentId: uuid("environment_id").references(() => environments.id, { onDelete: "set null" }),
    pairingTokenHash: text("pairing_token_hash"),
    pairingExpiresAt: timestamp("pairing_expires_at", { withTimezone: true }),
    credentialHash: text("credential_hash"),
    credentialIssuedAt: timestamp("credential_issued_at", { withTimezone: true }),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    authorizedByUserId: text("authorized_by_user_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("machines_owner_idx").on(table.ownerUserId),
    credentialHashIdx: uniqueIndex("machines_credential_hash_uq")
      .on(table.credentialHash)
      .where(sql`${table.credentialHash} is not null`),
    environmentIdx: uniqueIndex("machines_environment_uq")
      .on(table.environmentId)
      .where(sql`${table.environmentId} is not null`),
  }),
);
