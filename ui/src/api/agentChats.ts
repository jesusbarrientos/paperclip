import type { Issue } from "@paperclipai/shared";
import { api } from "./client";
export const agentChatsApi = {
  list: () => api.get<Issue[]>(`/chats`),
  get: (agentRef: string) =>
    api.get<Issue | null>(
      `/chats/${encodeURIComponent(agentRef)}`,
    ),
  ensure: (agentRef: string) =>
    api.post<Issue>(
      `/chats/${encodeURIComponent(agentRef)}`,
      {},
    ),
};
