import { sql } from "drizzle-orm";
import { companyMemberships, type createDb } from "@paperclipai/db";

type Db = ReturnType<typeof createDb>;

// The access tables are instance-level and no longer reference companies, so
// TRUNCATE companies CASCADE does not reach them on its own.
export async function resetOrganizationState(db: Db): Promise<void> {
  await db.execute(sql.raw(
    'TRUNCATE "companies", "company_memberships", "principal_permission_grants", "invites", "join_requests" CASCADE',
  ));
}

// Fixtures that seed several companies re-insert the same principal; with one
// membership per principal, a repeat insert means "member with this role".
export const membershipUpsert = {
  target: [companyMemberships.principalType, companyMemberships.principalId],
  set: {
    status: sql`excluded.status`,
    membershipRole: sql`excluded.membership_role`,
    updatedAt: sql`now()`,
  },
};

// Tables are no longer partitioned by company, so files that seeded one company
// per case need a full reset. Snapshot after migrations and shared seeding;
// tables that already hold rows then (migration seeds) are left intact.
export async function captureEmptyTablesTruncateStatement(db: Db): Promise<string> {
  const tables = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const empty: string[] = [];
  for (const { tablename } of tables) {
    const [row] = await db.execute<{ empty: boolean }>(
      sql.raw(`select not exists (select 1 from "${tablename}") as empty`),
    );
    if (row?.empty) empty.push(tablename);
  }
  return `TRUNCATE ${empty.map((name) => `"${name}"`).join(", ")} CASCADE`;
}

export async function captureEmptyTablesReset(db: Db): Promise<() => Promise<void>> {
  const statement = await captureEmptyTablesTruncateStatement(db);
  return async () => {
    await db.execute(sql.raw(statement));
  };
}
