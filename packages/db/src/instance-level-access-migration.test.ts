import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./test-embedded-postgres.js";

const MIGRATION_FILE = "0306_instance_level_access.sql";
const ACCESS_TABLES = [
  "agent_api_keys",
  "company_memberships",
  "invites",
  "join_requests",
  "principal_permission_grants",
];
const cleanups: Array<() => Promise<void>> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

async function singleOrganizationGuard() {
  const content = await fs.promises.readFile(new URL(`./migrations/${MIGRATION_FILE}`, import.meta.url), "utf8");
  return content.split("--> statement-breakpoint")[0]!;
}

describeEmbeddedPostgres("instance-level access migration", () => {
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  it("drops company_id from the access tables and keeps one membership per principal", async () => {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-instance-access-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1, onnotice: () => {} });
    cleanups.push(async () => sql.end());

    const columns = await sql<{ table_name: string }[]>`
      SELECT "table_name" FROM "information_schema"."columns"
      WHERE "column_name" = 'company_id' AND "table_name" IN ${sql(ACCESS_TABLES)}
    `;
    expect(columns).toEqual([]);

    await sql`
      INSERT INTO "company_memberships" ("principal_type", "principal_id", "status", "membership_role")
      VALUES ('user', 'owner-user', 'active', 'owner')
    `;
    await expect(sql`
      INSERT INTO "company_memberships" ("principal_type", "principal_id", "status", "membership_role")
      VALUES ('user', 'owner-user', 'active', 'member')
    `).rejects.toMatchObject({ code: "23505", constraint_name: "company_memberships_principal_unique_idx" });
  }, 30_000);

  it("refuses to migrate an instance that holds more than one company", async () => {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-instance-access-guard-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1, onnotice: () => {} });
    cleanups.push(async () => sql.end());
    const guard = await singleOrganizationGuard();

    await sql`INSERT INTO "companies" ("id", "name", "issue_prefix") VALUES (${randomUUID()}, 'First', 'FIR')`;
    await expect(sql.unsafe(guard)).resolves.toBeDefined();

    await sql`INSERT INTO "companies" ("id", "name", "issue_prefix") VALUES (${randomUUID()}, 'Second', 'SEC')`;
    await expect(sql.unsafe(guard)).rejects.toThrow(/exactly one organization per instance/);
  }, 30_000);
});
