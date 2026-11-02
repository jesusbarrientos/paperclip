import type { AiConnectionList, AiConnectionUsage, CreateAiConnection, AiConnectionLoginIntent, LocalAiLoginAttempt, LocalAiLoginStatus } from "@paperclipai/shared";
import { api } from "./client";
export const aiConnectionsApi = {
  probeUsage: (connectionId: string, grantId?: string) => api.get<AiConnectionUsage>(`/ai-connections/${connectionId}/usage${grantId ? `?grantId=${encodeURIComponent(grantId)}` : ""}`),
  startLocalLogin: (input: AiConnectionLoginIntent & { restart?: boolean }) => api.post<LocalAiLoginAttempt>(`/ai-connections/local/attempts`, input),
  checkLocalLogin: (input: AiConnectionLoginIntent & { localSessionId?: string }) => api.post<LocalAiLoginStatus>(`/ai-connections/local/check`, input),
  cancelLocalLogin: (sessionId: string) => api.delete(`/ai-connections/local/attempts/${sessionId}`),
  connectLocal: (input: AiConnectionLoginIntent & { localSessionId?: string }) => api.post<{ connectionId: string; grantId: string }>(`/ai-connections/local`, input),
  activeRuns: (connectionId: string) => api.get<Array<{ id: string; agentId: string; agentName: string; status: string }>>(`/ai-connections/${connectionId}/active-runs`),
  list: (agentId?: string) => api.get<AiConnectionList>(`/ai-connections${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ""}`),
  create: (input: CreateAiConnection) => api.post<{ connectionId: string; grantId: string }>(`/ai-connections`, input),
  setDefault: (grantId: string) => api.put(`/ai-connections/default`, { grantId }),
  loginResult: (sessionId: string) => api.get<{ connectionId: string; grantId: string }>(`/ai-connections/login/${encodeURIComponent(sessionId)}`),
};
