import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type {
  SmokeRunStatus,
  SmokeRunStepPath,
  SmokeRunStepStatus,
  SmokeRunTrigger,
} from "@paperclipai/shared";
export const smokeRuns = pgTable(
  "smoke_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trigger: text("trigger").$type<SmokeRunTrigger>().notNull(),
    status: text("status").$type<SmokeRunStatus>().notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("smoke_runs_company_started_idx").on(table.startedAt),
    index("smoke_runs_company_status_idx").on(table.status),
  ],
);

export const smokeRunSteps = pgTable(
  "smoke_run_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => smokeRuns.id, { onDelete: "cascade" }),
    path: text("path").$type<SmokeRunStepPath>().notNull(),
    scenarioStep: text("scenario_step").notNull(),
    status: text("status").$type<SmokeRunStepStatus>().notNull(),
    detail: text("detail"),
    screenshotArtifactRef: jsonb("screenshot_artifact_ref").$type<Record<string, unknown>>(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("smoke_run_steps_company_run_idx").on(table.runId),
    index("smoke_run_steps_company_path_idx").on(table.path),
  ],
);
