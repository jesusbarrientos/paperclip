import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { inboxDismissals } from "@paperclipai/db";
import type { InboxDismissalKind } from "@paperclipai/shared";

export function inboxDismissalService(db: Db) {
  async function upsert(
    userId: string,
    itemKey: string,
    input: { kind: InboxDismissalKind; dismissedAt?: Date; snoozedUntil?: Date | null },
  ) {
    const now = new Date();
    const dismissedAt = input.dismissedAt ?? now;
    const snoozedUntil = input.kind === "snooze" ? input.snoozedUntil ?? null : null;
    const [row] = await db
      .insert(inboxDismissals)
      .values({
        userId,
        itemKey,
        kind: input.kind,
        dismissedAt,
        snoozedUntil,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [inboxDismissals.userId, inboxDismissals.itemKey],
        set: {
          kind: input.kind,
          dismissedAt,
          snoozedUntil,
          updatedAt: now,
        },
      })
      .returning();
    return row;
  }

  return {
    list: async (userId: string) =>
      db
        .select()
        .from(inboxDismissals)
        .where(eq(inboxDismissals.userId, userId))
        .orderBy(desc(inboxDismissals.updatedAt)),

    dismiss: async (
      userId: string,
      itemKey: string,
      dismissedAt: Date = new Date(),
    ) => upsert(userId, itemKey, { kind: "dismiss", dismissedAt }),

    snooze: async (
      userId: string,
      itemKey: string,
      snoozedUntil: Date,
      dismissedAt: Date = new Date(),
    ) => upsert(userId, itemKey, { kind: "snooze", dismissedAt, snoozedUntil }),

    restore: async (userId: string, itemKey: string) => {
      const [row] = await db
        .delete(inboxDismissals)
        .where(and(
          eq(inboxDismissals.userId, userId),
          eq(inboxDismissals.itemKey, itemKey),
        ))
        .returning();
      return row ?? null;
    },
  };
}
