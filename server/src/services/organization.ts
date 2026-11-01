import { asc, count } from "drizzle-orm";
import { companies, type Db } from "@paperclipai/db";
import { conflict } from "../errors.js";

export class MultipleOrganizationsError extends Error {
  constructor(readonly organizationCount: number) {
    super(
      `This instance holds ${organizationCount} organizations, but Paperclip now supports exactly one per instance. ` +
        "Archive or delete the extra companies in the database before starting the server.",
    );
    this.name = "MultipleOrganizationsError";
  }
}

export function organizationService(db: Pick<Db, "select">) {
  return {
    findId: async (): Promise<string | null> => {
      const row = await db
        .select({ id: companies.id })
        .from(companies)
        .orderBy(asc(companies.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      return row?.id ?? null;
    },

    count: async (): Promise<number> => {
      const [row] = await db.select({ value: count() }).from(companies);
      return Number(row?.value ?? 0);
    },
  };
}

export async function assertCanCreateOrganization(db: Pick<Db, "select">): Promise<void> {
  if ((await organizationService(db).count()) > 0) {
    throw conflict("This instance already has an organization", { code: "organization_exists" });
  }
}

export async function assertSingleOrganization(db: Pick<Db, "select">): Promise<void> {
  const total = await organizationService(db).count();
  if (total > 1) throw new MultipleOrganizationsError(total);
}
