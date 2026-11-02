import { pgTable, uuid, bigint, timestamp, index } from "drizzle-orm/pg-core";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { assets } from "./assets.js";

export const runnerApiResponseReservations = pgTable("runner_api_response_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
  reservedBytes: bigint("reserved_bytes", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({ }));
