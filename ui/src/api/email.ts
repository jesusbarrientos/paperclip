import { api } from "./client";
import type {
  EmailConnectionInput,
  EmailCredentialOption,
  ToolConnection,
  EmailEndpointSummary,
  EmailPublicationSummary,
  EmailThreadSummary,
  EmailSendInput,
  EmailEndpointSetupInput,
  EmailAddressCheckInput,
  EmailAddressCheckResult,
} from "@paperclipai/shared";
export const emailApi = {
  credentials: () => api.get<EmailCredentialOption[]>(`/email/connections`),
  checkAddress: (connectionId: string, input: EmailAddressCheckInput, signal?: AbortSignal) =>
    api.post<EmailAddressCheckResult>(
      `/email/connections/${connectionId}/check-address`, input, { signal },
    ),
  connect: (input: EmailConnectionInput) =>
    api.post<ToolConnection>(
      `/email/connections`,
      input,
    ),
  inspectSaved: (connectionId: string) =>
    api.post<{
      scope: { scope_type: string };
      inboxes: { inbox_id: string }[];
      domains: { domain_id: string; domain: string; status: string }[];
    }>(`/email/connections/${connectionId}/inspect`, {}),
  list: () =>
    api.get<EmailEndpointSummary[]>(`/email/inboxes`),
  setup: (input: EmailEndpointSetupInput) =>
    api.post<EmailEndpointSummary>(
      `/email/inboxes`,
      input,
    ),
  inspect: (apiKey: string) =>
    api.post<{
      scope: { scope_type: string };
      inboxes: { inbox_id: string }[];
      domains: { domain_id: string; domain: string; status: string }[];
    }>(`/email/inspect`, { apiKey }),
  control: (id: string, action: "pause" | "resume" | "remove") =>
    api.post<EmailEndpointSummary>(`/email/inboxes/${id}/control`, { action }),
  reconnect: (
    id: string,
    apiKey: string,
    receiveMode: "websocket" | "webhook",
  ) =>
    api.post<EmailEndpointSummary>(`/email/inboxes/${id}/reconnect`, {
      apiKey,
      receiveMode,
    }),
  resolve: (
    id: string,
    outcome: "sent" | "failed",
    providerMessageId?: string,
  ) =>
    api.post<EmailPublicationSummary>(
      `/email/deliveries/${id}/resolve`,
      { outcome, providerMessageId },
    ),
  thread: (issueId: string) =>
    api.get<EmailThreadSummary | null>(
      `/email/tasks/${issueId}`,
    ),
  send: (input: EmailSendInput) =>
    api.post<EmailPublicationSummary>(
      `/email/send`,
      input,
    ),
};
