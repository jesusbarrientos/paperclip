import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
export const agentMemberships = pgTable(
  "agent_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    state: text("state").notNull().default("joined"),
    starredAt: timestamp("starred_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserStarredIdx: index("agent_memberships_company_user_starred_idx").on(
      table.userId,
      table.starredAt,
    ),
    agentIdx: index("agent_memberships_agent_idx").on(table.agentId),
    companyUserAgentUq: uniqueIndex("agent_memberships_company_user_agent_uq").on(
      table.userId,
      table.agentId,
    ),
  }),
);
