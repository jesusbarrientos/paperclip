import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
export const builtInManagedResources = pgTable(
  "built_in_managed_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleKey: text("bundle_key").notNull(),
    resourceKind: text("resource_kind").notNull(),
    resourceKey: text("resource_key").notNull(),
    resourceId: uuid("resource_id").notNull(),
    stockVersion: text("stock_version").notNull(),
    stockHash: text("stock_hash").notNull(),
    defaultsJson: jsonb("defaults_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    resourceIdx: index("built_in_managed_resources_resource_idx").on(table.resourceKind, table.resourceId),
    companyBundleResourceUq: uniqueIndex("built_in_managed_resources_company_bundle_resource_uq").on(
      table.bundleKey,
      table.resourceKind,
      table.resourceKey,
    ),
  }),
);
