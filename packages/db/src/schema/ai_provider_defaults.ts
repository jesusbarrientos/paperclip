import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AiProvider } from "@paperclipai/shared";
import { connectionGrants } from "./tool_access.js";

/** One selected personal account per provider, independent of sign-in method.
 * Legacy per-method defaults remain intact for older server versions. */
export const aiProviderDefaults = pgTable("ai_provider_defaults", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  provider: text("provider").$type<AiProvider>().notNull(),
  grantId: uuid("grant_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ai_provider_defaults_owner_provider_uq").on(t.userId, t.provider),
  foreignKey({ columns: [t.grantId], foreignColumns: [connectionGrants.id], name: "ai_provider_defaults_company_grant_fk" }),
  check("ai_provider_defaults_provider_check", sql`${t.provider} in ('anthropic','openai','openrouter','xai')`),
]);
