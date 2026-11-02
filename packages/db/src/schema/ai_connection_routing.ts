import { foreignKey, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AiConnectionPoolConfig, AiConnectionRouterSelection } from "@paperclipai/shared";
import { agents } from "./agents.js";
import { toolConnections } from "./tool_access.js";

export const aiConnectionPools = pgTable("ai_connection_pools", {
  id: uuid("id").primaryKey().references(() => toolConnections.id, { onDelete: "cascade" }),
  pluginKey: text("plugin_key").notNull(),
  config: jsonb("config").$type<AiConnectionPoolConfig>().notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.id], foreignColumns: [toolConnections.id], name: "ai_connection_pools_company_connection_fk" }).onDelete("cascade"),
]);
export const aiConnectionRouterCursors = pgTable("ai_connection_router_cursors", {
  poolId: uuid("pool_id").primaryKey().references(() => aiConnectionPools.id, { onDelete: "cascade" }),
  lastMemberId: text("last_member_id"),
  version: integer("version").notNull().default(0),
}, (table) => [foreignKey({ columns: [table.poolId], foreignColumns: [aiConnectionPools.id], name: "ai_connection_router_cursors_company_pool_fk" }).onDelete("cascade")]);
export const aiConnectionTaskPins = pgTable("ai_connection_task_pins", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id").notNull().references(() => aiConnectionPools.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  taskKey: text("task_key").notNull(),
  selection: jsonb("selection").$type<AiConnectionRouterSelection>().notNull(),
  member: jsonb("member").$type<AiConnectionPoolConfig["members"][number]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ai_connection_task_pins_affinity_uq").on(table.poolId, table.agentId, table.taskKey),
  foreignKey({ columns: [table.poolId], foreignColumns: [aiConnectionPools.id], name: "ai_connection_task_pins_company_pool_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.agentId], foreignColumns: [agents.id], name: "ai_connection_task_pins_company_agent_fk" }).onDelete("cascade"),
]);
