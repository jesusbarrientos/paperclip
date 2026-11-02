import { and, count, eq, sql } from "drizzle-orm";
import {
  EXPORT_FIDELITY_REPORT_SCHEMA,
  buildExportFidelityWarnings,
  type ExportFidelityCounts,
  type ExportFidelityReport,
} from "@paperclipai/shared/portability-fidelity";
import type { Db } from "@paperclipai/db";
import {
  activityLog,
  approvals,
  costEvents,
  issueAttachments,
  issueDocuments,
  issueLabels,
  issueRelations,
  issueWorkProducts,
  issues,
  labels,
} from "@paperclipai/db";

export async function collectExportFidelityCounts(db: Db): Promise<ExportFidelityCounts> {
  const [
    labelDefinitions,
    issueLabelReferences,
    issueBlockerRelations,
    issueDocumentCount,
    issueWorkProductCount,
    issueAttachmentCount,
    approvalCount,
    costEventCount,
    activityLogEntries,
    issueMonitors,
  ] = await Promise.all([
    db.select({ count: count() }).from(labels).then(firstCount),
    db.select({ count: count() }).from(issueLabels).then(firstCount),
    db
      .select({ count: count() })
      .from(issueRelations)
      .where(eq(issueRelations.type, "blocks"))
      .then(firstCount),
    db.select({ count: count() }).from(issueDocuments).then(firstCount),
    db.select({ count: count() }).from(issueWorkProducts).then(firstCount),
    db.select({ count: count() }).from(issueAttachments).then(firstCount),
    db.select({ count: count() }).from(approvals).then(firstCount),
    db.select({ count: count() }).from(costEvents).then(firstCount),
    db.select({ count: count() }).from(activityLog).then(firstCount),
    db
      .select({ count: count() })
      .from(issues)
      .where(sql`(${issues.monitorNextCheckAt} is not null or ${issues.monitorScheduledBy} is not null)`)
      .then(firstCount),
  ]);
  return {
    labelDefinitions,
    issueLabelReferences,
    issueBlockerRelations,
    issueDocuments: issueDocumentCount,
    issueWorkProducts: issueWorkProductCount,
    issueAttachments: issueAttachmentCount,
    approvals: approvalCount,
    costEvents: costEventCount,
    activityLogEntries,
    issueMonitors,
  };
}

export function buildExportFidelityReport(counts: ExportFidelityCounts): ExportFidelityReport {
  return {
    schema: EXPORT_FIDELITY_REPORT_SCHEMA,
    counts,
    warnings: buildExportFidelityWarnings(counts),
    generatedAt: new Date().toISOString(),
  };
}

function firstCount(rows: Array<{ count: number }>): number {
  return rows[0]?.count ?? 0;
}
