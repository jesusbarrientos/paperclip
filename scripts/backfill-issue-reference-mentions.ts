import { createDb } from "../packages/db/src/index.js";
import { loadConfig } from "../server/src/config.js";
import { issueReferenceService } from "../server/src/services/issue-references.js";

async function main() {
  const config = loadConfig();
  const dbUrl =
    process.env.DATABASE_URL?.trim()
    || config.databaseUrl
    || `postgres://paperclip:paperclip@127.0.0.1:${config.embeddedPostgresPort}/paperclip`;

  const db = createDb(dbUrl);
  const refs = issueReferenceService(db);
  console.log("Backfilling issue reference mentions...");
  await refs.syncAll();
  console.log("Issue reference backfill complete.");
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Issue reference backfill failed: ${message}`);
  process.exitCode = 1;
});
