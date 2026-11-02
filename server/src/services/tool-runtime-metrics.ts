import { sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { toolRuntimeMetricCounters } from "@paperclipai/db";

export const TOOL_RUNTIME_AUDIT_WRITE_FAILURE_METRIC = "audit_write_failed";

function minuteBucket(date: Date): Date {
  const bucket = new Date(date);
  bucket.setSeconds(0, 0);
  return bucket;
}

export async function incrementToolRuntimeMetricCounter(
  db: Db,
  input: {
    metric: string;
    at?: Date;
  },
) {
  const at = input.at ?? new Date();
  await db
    .insert(toolRuntimeMetricCounters)
    .values({
      metric: input.metric,
      bucketStartAt: minuteBucket(at),
      count: 1,
      createdAt: at,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: [
        toolRuntimeMetricCounters.metric,
        toolRuntimeMetricCounters.bucketStartAt,
      ],
      set: {
        count: sql`${toolRuntimeMetricCounters.count} + 1`,
        updatedAt: at,
      },
    });
}

export async function recordToolRuntimeAuditWriteFailure(db: Db) {
  try {
    await incrementToolRuntimeMetricCounter(db, {
      metric: TOOL_RUNTIME_AUDIT_WRITE_FAILURE_METRIC,
    });
  } catch (error) {
    console.error("[tool-runtime-metrics] Failed to record audit write failure counter", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
