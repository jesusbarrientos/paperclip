import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./test-embedded-postgres.js";

type SnapshotTable = {
  name: string;
  columns: Record<string, unknown>;
  indexes: Record<string, unknown>;
  foreignKeys: Record<string, unknown>;
};

const COMPANY_TABLES = ["company_logos", "company_onboarding_seeds", "company_transfer_runs"];
// Migration 0159 created these columns without the foreign key the schema declares.
const PREEXISTING_MISSING_FOREIGN_KEYS = [
  "tool_mcp_gateway_tokens|created_by_agent_id|agents|id",
  "tool_mcp_gateways|created_by_agent_id|agents|id",
];
const cleanups: Array<() => Promise<void>> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

async function latestSnapshotTables(): Promise<SnapshotTable[]> {
  const dir = new URL("./migrations/meta/", import.meta.url);
  const latest = (await fs.promises.readdir(dir)).filter((f) => f.endsWith("_snapshot.json")).sort().at(-1)!;
  const snapshot = JSON.parse(await fs.promises.readFile(new URL(latest, dir), "utf8"));
  return Object.values(snapshot.tables) as SnapshotTable[];
}

describeEmbeddedPostgres("remove company columns migration", () => {
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("leaves company_id only on the company metadata tables", async () => {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-remove-company-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1, onnotice: () => {} });
    cleanups.push(async () => sql.end());

    const rows = await sql<{ table_name: string }[]>`
      SELECT "table_name" FROM "information_schema"."columns"
      WHERE "table_schema" = 'public' AND "column_name" = 'company_id'
      ORDER BY "table_name"
    `;
    expect(rows.map((row) => row.table_name)).toEqual(COMPANY_TABLES);
  }, 60_000);

  // The migration drops constraints with CASCADE; this proves no foreign key or
  // index the schema still declares was lost along the way.
  it("matches the indexes and foreign keys of the latest schema snapshot", async () => {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-remove-company-drift-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1, onnotice: () => {} });
    cleanups.push(async () => sql.end());
    const tables = await latestSnapshotTables();

    const foreignKeys = new Set((await sql<{ signature: string }[]>`
      SELECT concat_ws('|', src.relname, (
        SELECT string_agg(a.attname, ',' ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ), dst.relname, (
        SELECT string_agg(a.attname, ',' ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum
      )) AS "signature"
      FROM pg_constraint c
      JOIN pg_class src ON src.oid = c.conrelid
      JOIN pg_class dst ON dst.oid = c.confrelid
      WHERE c.contype = 'f'
    `).map((row) => row.signature));
    const indexes = new Set((await sql<{ name: string }[]>`
      SELECT "indexname" AS "name" FROM "pg_indexes" WHERE "schemaname" = 'public'
    `).map((row) => row.name));

    type SnapshotForeignKey = { tableFrom: string; columnsFrom: string[]; tableTo: string; columnsTo: string[] };
    // Hand-written migrations name some constraints differently from drizzle, so
    // foreign keys are compared by shape. Postgres truncates index names to 63 bytes.
    const missingForeignKeys = tables.flatMap((table) => (Object.values(table.foreignKeys) as SnapshotForeignKey[])
      .map((fk) => [fk.tableFrom, fk.columnsFrom.join(","), fk.tableTo, fk.columnsTo.join(",")].join("|"))
      .filter((signature) => !foreignKeys.has(signature) && !PREEXISTING_MISSING_FOREIGN_KEYS.includes(signature)));
    const missingIndexes = tables.flatMap((table) => Object.keys(table.indexes).filter((name) => !indexes.has(name.slice(0, 63))));
    expect(missingForeignKeys).toEqual([]);
    expect(missingIndexes).toEqual([]);
  }, 60_000);

  it("rewrites company-scoped skill keys in skills and agent configs", async () => {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-skill-keys-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1, onnotice: () => {} });
    cleanups.push(async () => sql.end());
    const legacyKey = "company/0a1b2c3d-0000-4000-8000-000000000001/release-notes";
    await sql`
      INSERT INTO "company_skills" ("key", "slug", "name", "markdown")
      VALUES (${legacyKey}, 'release-notes', 'Release notes', '# Release notes')
    `;
    await sql`
      INSERT INTO "agents" ("name", "adapter_type", "adapter_config")
      VALUES ('Writer', 'process', ${sql.json({ paperclipSkillSync: { desiredSkills: [legacyKey, "paperclipai/paperclip/paperclip"] } })})
    `;

    const migration = await fs.promises.readFile(
      new URL("./migrations/0308_single_organization_skill_keys.sql", import.meta.url),
      "utf8",
    );
    for (const statement of migration.split("--> statement-breakpoint")) await sql.unsafe(statement);

    const [skill] = await sql<{ key: string }[]>`SELECT "key" FROM "company_skills"`;
    expect(skill!.key).toBe("company/release-notes");
    const [agent] = await sql<{ adapter_config: { paperclipSkillSync: { desiredSkills: string[] } } }[]>`
      SELECT "adapter_config" FROM "agents"
    `;
    expect(agent!.adapter_config.paperclipSkillSync.desiredSkills).toEqual([
      "company/release-notes",
      "paperclipai/paperclip/paperclip",
    ]);
  }, 60_000);

  it("leaves no database function writing the dropped company columns", async () => {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-remove-company-functions-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1, onnotice: () => {} });
    cleanups.push(async () => sql.end());

    const functions = await sql<{ name: string }[]>`
      SELECT p.proname AS "name" FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosrc ILIKE '%company_id%'
      ORDER BY p.proname
    `;
    expect(functions.map((row) => row.name)).toEqual([]);
  }, 60_000);
});
