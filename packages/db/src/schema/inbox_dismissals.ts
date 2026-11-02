import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
export const inboxDismissals = pgTable(
  "inbox_dismissals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    itemKey: text("item_key").notNull(),
    kind: text("kind").$type<"dismiss" | "snooze">().notNull().default("dismiss"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyItemIdx: index("inbox_dismissals_company_item_idx").on(table.itemKey),
    companyUserItemUnique: uniqueIndex("inbox_dismissals_company_user_item_idx").on(
      table.userId,
      table.itemKey,
    ),
  }),
);
