import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { assets } from "@paperclipai/db";

export function assetService(db: Db) {
  return {
    create: (data: Omit<typeof assets.$inferInsert, "companyId">) =>
      db
        .insert(assets)
        .values({ ...data })
        .returning()
        .then((rows) => rows[0]),

    getById: (id: string) =>
      db
        .select()
        .from(assets)
        .where(eq(assets.id, id))
        .then((rows) => rows[0] ?? null),
  };
}

