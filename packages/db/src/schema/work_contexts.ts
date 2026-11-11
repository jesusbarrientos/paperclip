import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { WorkContextStatus, WorkContextSyncState } from "@paperclipai/shared";
import { issues } from "./issues.js";
import { machines } from "./machines.js";

export const workContexts = pgTable(
  "work_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    /** Null means the server's own environment resolution. */
    machineId: uuid("machine_id").references(() => machines.id, { onDelete: "set null" }),
    status: text("status").$type<WorkContextStatus>().notNull().default("active"),
    active: boolean("active").notNull().default(true),
    fencingToken: integer("fencing_token").notNull().default(1),
    editLocked: boolean("edit_locked").notNull().default(false),
    lockRunId: uuid("lock_run_id"),
    syncState: text("sync_state").$type<WorkContextSyncState>().notNull().default("up_to_date"),
    syncError: text("sync_error"),
    lastSnapshotSeq: integer("last_snapshot_seq").notNull().default(0),
    remotePath: text("remote_path"),
    clientSessionId: text("client_session_id"),
    clientSessionSeenAt: timestamp("client_session_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIssueUq: uniqueIndex("work_contexts_active_issue_uq")
      .on(table.issueId)
      .where(sql`${table.active}`),
    issueIdx: index("work_contexts_issue_idx").on(table.issueId),
    machineIdx: index("work_contexts_machine_idx").on(table.machineId),
    clientSessionIdx: index("work_contexts_client_session_idx").on(table.clientSessionId),
  }),
);
