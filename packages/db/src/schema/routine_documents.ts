import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { documents } from "./documents.js";
import { routines } from "./routines.js";

export const routineDocuments = pgTable(
  "routine_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routineId: uuid("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyRoutineKeyUq: uniqueIndex("routine_documents_company_routine_key_uq").on(
      table.routineId,
      table.key,
    ),
    documentUq: uniqueIndex("routine_documents_document_uq").on(table.documentId),
    companyRoutineUpdatedIdx: index("routine_documents_company_routine_updated_idx").on(
      table.routineId,
      table.updatedAt,
    ),
  }),
);
