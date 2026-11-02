import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
export const userInboxAgentPolicies = pgTable(
  "user_inbox_agent_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    mode: text("mode").$type<"open" | "allowlist" | "disabled">().notNull().default("open"),
    allowedAgentIds: jsonb("allowed_agent_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserUq: uniqueIndex("user_inbox_agent_policies_company_user_uq").on(
      table.userId,
    ),
    allowedAgentIdsIdx: index("user_inbox_agent_policies_allowed_agent_ids_idx").using(
      "gin",
      table.allowedAgentIds,
    ),
    modeCheck: check(
      "user_inbox_agent_policies_mode_check",
      sql`${table.mode} in ('open', 'allowlist', 'disabled')`,
    ),
  }),
);
