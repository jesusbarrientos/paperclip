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
