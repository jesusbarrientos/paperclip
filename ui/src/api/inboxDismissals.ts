import type { InboxDismissal } from "@paperclipai/shared";
import { api } from "./client";

export const inboxDismissalsApi = {
  list: () => api.get<InboxDismissal[]>(`/inbox-dismissals`),
  dismiss: (itemKey: string) =>
    api.post<InboxDismissal>(`/inbox-dismissals`, { itemKey }),
  snooze: (itemKey: string, snoozedUntil: string) =>
    api.post<InboxDismissal>(`/inbox-dismissals`, {
      itemKey,
      kind: "snooze",
      snoozedUntil,
    }),
  restore: (itemKey: string) =>
    api.delete<void>(`/inbox-dismissals/${encodeURIComponent(itemKey)}`),
};
