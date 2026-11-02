import {
  foreignKey,
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  jsonb,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { issues } from "./issues.js";
import { workAssessments } from "./work_assessments.js";

export const statusDecisions = pgTable(
  "status_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id").notNull(),
    runId: uuid("run_id").notNull(),
    assessmentId: uuid("assessment_id").notNull(),
    decisionVersion: bigint("decision_version", { mode: "number" }).notNull(),
    policyVersion: text("policy_version").notNull(),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    reasonCode: text("reason_code").notNull(),
    decisionJson: jsonb("decision_json").$type<Record<string, unknown>>().notNull(),
    decisionDigest: text("decision_digest").notNull(),
    applicationState: text("application_state").notNull().default("proposed"),
    supersedesDecisionId: uuid("supersedes_decision_id"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIssueIdUq: unique("status_decisions_company_issue_id_uq").on(
      table.issueId,
      table.id,
    ),
    companyIssueRunAssessmentIdUq: unique(
      "status_decisions_company_issue_run_assessment_id_uq",
    ).on(
      table.issueId,
      table.runId,
      table.assessmentId,
      table.id,
    ),
    issueCompanyFk: foreignKey({
      columns: [table.issueId],
      foreignColumns: [issues.id],
      name: "status_decisions_issue_company_fk",
    }),
    assessmentOwnerFk: foreignKey({
      columns: [table.issueId, table.runId, table.assessmentId],
      foreignColumns: [
        workAssessments.issueId,
        workAssessments.runId,
        workAssessments.id,
      ],
      name: "status_decisions_assessment_owner_fk",
    }),
    supersedesOwnerFk: foreignKey({
      columns: [table.issueId, table.supersedesDecisionId],
      foreignColumns: [table.issueId, table.id],
      name: "status_decisions_supersedes_owner_fk",
    }),
    issueVersionUq: uniqueIndex("status_decisions_company_issue_version_uq").on(
      table.issueId,
      table.decisionVersion,
    ),
    assessmentUq: uniqueIndex("status_decisions_company_assessment_uq").on(
      table.assessmentId,
    ),
    issueDigestUq: uniqueIndex("status_decisions_company_issue_digest_uq").on(
      table.issueId,
      table.decisionDigest,
    ),
  }),
);
