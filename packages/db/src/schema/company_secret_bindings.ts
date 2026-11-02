import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companySecrets } from "./company_secrets.js";

export const companySecretBindings = pgTable(
  "company_secret_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    secretId: uuid("secret_id").notNull().references(() => companySecrets.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    configPath: text("config_path").notNull(),
    versionSelector: text("version_selector").notNull().default("latest"),
    required: boolean("required").notNull().default(true),
    label: text("label"),
    projectionClass: text("projection_class").notNull().default("unclassified"),
    projectionAllowlistKey: text("projection_allowlist_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    secretIdx: index("company_secret_bindings_secret_idx").on(table.secretId),
    targetPathUq: uniqueIndex("company_secret_bindings_target_path_uq").on(
      table.targetType,
      table.targetId,
      table.configPath,
    ),
  }),
);
