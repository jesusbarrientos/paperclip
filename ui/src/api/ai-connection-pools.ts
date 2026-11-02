import type { AiConnectionPool, AiConnectionPoolConfig, AiConnectionUsage } from "@paperclipai/shared";
import { api } from "./client";
export type PoolInspection = Record<string, { reason: string; checkedAt: string | null; usage?: AiConnectionUsage }>;
export const aiConnectionPoolsApi = {
  list: () => api.get<AiConnectionPool[]>(`/ai-connection-pools`),
  save: (body: { pluginKey: string; id?: string; expectedRevision?: number; config: AiConnectionPoolConfig }) => api.post<AiConnectionPool>(`/ai-connection-pools`, body),
  inspect: (id: string) => api.get<PoolInspection>(`/ai-connection-pools/${id}/inspection`),
  remove: (id: string, expectedRevision: number) => api.delete(`/ai-connection-pools/${id}`, { expectedRevision }),
};
