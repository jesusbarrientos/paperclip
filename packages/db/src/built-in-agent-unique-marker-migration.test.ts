import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./test-embedded-postgres.js";

const UNIQUE_INDEX = "agents_company_built_in_agent_key_unique_idx";
const cleanups: Array<() => Promise<void>> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function markerObj(key: string) {
  // Return a plain object (not a JSON string) so `sql.json` stores it as a jsonb
  // object; a JSON string param + `::jsonb` would double-encode into a scalar.
  return { paperclipBuiltInAgent: { key, featureKeys: [key] } };
}

describeEmbeddedPostgres("built-in agent unique marker", () => {
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("allows one live built-in agent per key and ignores terminated ones", async () => {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-built-in-unique-marker-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1 });
    cleanups.push(async () => sql.end());

    await sql`
      INSERT INTO "agents" ("id", "name", "status", "metadata")
      VALUES (${randomUUID()}, 'Summarizer', 'idle', ${sql.json(markerObj("summarizer"))})
    `;
    await sql`
      INSERT INTO "agents" ("id", "name", "status", "metadata")
      VALUES (${randomUUID()}, 'Retired Summarizer', 'terminated', ${sql.json(markerObj("summarizer"))})
    `;
    await expect(
      sql`
        INSERT INTO "agents" ("id", "name", "status", "metadata")
        VALUES (${randomUUID()}, 'Summarizer Dupe', 'idle', ${sql.json(markerObj("summarizer"))})
      `,
    ).rejects.toMatchObject({ code: "23505", constraint_name: UNIQUE_INDEX });
  }, 30_000);
});
