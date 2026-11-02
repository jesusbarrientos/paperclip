import type { SlackSearchStatus, SlackToolCapabilities } from "@paperclipai/shared";
import { api } from "./client";
const root = (endpointId: string) => `/slack/endpoints/${endpointId}`;
export const slackToolsApi = {
  capabilities: (endpointId: string) => api.get<SlackToolCapabilities>(`${root(endpointId)}/capabilities`),
  search: (endpointId: string) => api.get<SlackSearchStatus>(`${root(endpointId)}/search`),
  configure: (endpointId: string, input: {clientId: string; clientSecret: string}) => api.put<SlackSearchStatus>(`${root(endpointId)}/search`, input),
  connect: (endpointId: string) => api.post<{url: string}>(`${root(endpointId)}/search/connect`, {}),
  disconnect: (endpointId: string) => api.delete<SlackSearchStatus>(`${root(endpointId)}/search`),
};
