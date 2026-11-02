import type {
  CompanySecret,
  CompanySecretUsageBinding,
  CompanySecretProviderConfig,
  SecretProviderConfigDiscoveryPreviewResult,
  RemoteSecretImportPreviewResult,
  RemoteSecretImportResult,
  SecretAccessEvent,
  SecretManagedMode,
  SecretProvider,
  SecretProviderConfigStatus,
  SecretProviderConfigHealthResponse,
  SecretProviderDescriptor,
  SecretStatus,
  SecretProposalView,
  SecretProposalStatus,
  ApproveSecretProposalInput,
  RejectSecretProposalInput,
  UserSecretCoverageSummary,
  UserSecretDefinition,
} from "@paperclipai/shared";
import { api } from "./client";

export interface SecretUsageResponse {
  secretId: string;
  bindings: CompanySecretUsageBinding[];
}

/** One "My secrets" row: a company definition paired with the current user's own value (if set). */
export interface MyUserSecretEntry {
  definition: UserSecretDefinition;
  secret: CompanySecret | null;
}

export interface CreateUserSecretDefinitionInput {
  key: string;
  name: string;
  description?: string | null;
  status?: Exclude<SecretStatus, "deleted">;
  provider?: SecretProvider;
  managedMode?: SecretManagedMode;
  providerConfigId?: string | null;
  providerMetadata?: Record<string, unknown> | null;
  usageGuidance?: string | null;
}

export interface UpdateUserSecretDefinitionInput {
  name?: string;
  description?: string | null;
  status?: SecretStatus;
  providerConfigId?: string | null;
  providerMetadata?: Record<string, unknown> | null;
  usageGuidance?: string | null;
}

/** Owner-supplied value for a user secret. Either `value` (managed) or `externalRef`. */
export interface UpsertMyUserSecretInput {
  definitionId?: string;
  definitionKey?: string;
  value?: string | null;
  externalRef?: string | null;
  providerVersionRef?: string | null;
  providerConfigId?: string | null;
}

export interface CreateSecretInput {
  name: string;
  key?: string;
  provider?: SecretProvider;
  managedMode?: SecretManagedMode;
  value?: string | null;
  description?: string | null;
  externalRef?: string | null;
  providerVersionRef?: string | null;
  providerConfigId?: string | null;
  providerMetadata?: Record<string, unknown> | null;
}

export interface SecretProviderHealthResponse {
  providers: Array<{
    provider: SecretProvider;
    status: "ok" | "warn" | "error";
    message: string;
    warnings?: string[];
    backupGuidance?: string[];
    details?: Record<string, unknown>;
  }>;
}

export interface UpdateSecretInput {
  name?: string;
  key?: string;
  status?: SecretStatus;
  description?: string | null;
  externalRef?: string | null;
  providerMetadata?: Record<string, unknown> | null;
}

export interface RotateSecretInput {
  value?: string | null;
  externalRef?: string | null;
  providerVersionRef?: string | null;
  providerConfigId?: string | null;
}

export interface CreateSecretProviderConfigInput {
  provider: SecretProvider;
  displayName: string;
  status?: SecretProviderConfigStatus;
  isDefault?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateSecretProviderConfigInput {
  displayName?: string;
  status?: SecretProviderConfigStatus;
  isDefault?: boolean;
  config?: Record<string, unknown>;
}

export interface RemoteImportPreviewInput {
  providerConfigId: string;
  query?: string | null;
  nextToken?: string | null;
  pageSize?: number;
}

export interface RemoteImportSelectionInput {
  externalRef: string;
  name?: string | null;
  key?: string | null;
  description?: string | null;
  providerVersionRef?: string | null;
  providerMetadata?: Record<string, unknown> | null;
}

export interface RemoteImportInput {
  providerConfigId: string;
  secrets: RemoteImportSelectionInput[];
}

export interface SecretProviderConfigDiscoveryPreviewInput {
  provider: SecretProvider;
  config?: Record<string, unknown>;
  query?: string | null;
  nextToken?: string | null;
  pageSize?: number;
}

export const secretsApi = {
  list: () => api.get<CompanySecret[]>(`/secrets`),
  providers: () =>
    api.get<SecretProviderDescriptor[]>(`/secret-providers`),
  providerHealth: () =>
    api.get<SecretProviderHealthResponse>(`/secret-providers/health`),
  providerConfigs: () =>
    api.get<CompanySecretProviderConfig[]>(`/secret-provider-configs`),
  providerConfigDiscoveryPreview: (
    data: SecretProviderConfigDiscoveryPreviewInput,
  ) =>
    api.post<SecretProviderConfigDiscoveryPreviewResult>(
      `/secret-provider-configs/discovery/preview`,
      data,
    ),
  createProviderConfig: (data: CreateSecretProviderConfigInput) =>
    api.post<CompanySecretProviderConfig>(`/secret-provider-configs`, data),
  updateProviderConfig: (id: string, data: UpdateSecretProviderConfigInput) =>
    api.patch<CompanySecretProviderConfig>(`/secret-provider-configs/${id}`, data),
  disableProviderConfig: (id: string) =>
    api.patch<CompanySecretProviderConfig>(`/secret-provider-configs/${id}`, { status: "disabled" }),
  removeProviderConfig: (id: string) =>
    api.delete<CompanySecretProviderConfig>(`/secret-provider-configs/${id}`),
  setDefaultProviderConfig: (id: string) =>
    api.post<CompanySecretProviderConfig>(`/secret-provider-configs/${id}/default`, {}),
  checkProviderConfigHealth: (id: string) =>
    api.post<SecretProviderConfigHealthResponse>(`/secret-provider-configs/${id}/health`, {}),
  create: (data: CreateSecretInput) =>
    api.post<CompanySecret>(`/secrets`, data),
  update: (id: string, data: UpdateSecretInput) =>
    api.patch<CompanySecret>(`/secrets/${id}`, data),
  rotate: (id: string, data: RotateSecretInput) =>
    api.post<CompanySecret>(`/secrets/${id}/rotate`, data),
  disable: (id: string) =>
    api.patch<CompanySecret>(`/secrets/${id}`, { status: "disabled" satisfies SecretStatus }),
  enable: (id: string) =>
    api.patch<CompanySecret>(`/secrets/${id}`, { status: "active" satisfies SecretStatus }),
  archive: (id: string) =>
    api.patch<CompanySecret>(`/secrets/${id}`, { status: "archived" satisfies SecretStatus }),
  remove: (id: string) => api.delete<{ ok: true }>(`/secrets/${id}`),
  usage: (id: string) => api.get<SecretUsageResponse>(`/secrets/${id}/usage`),
  accessEvents: (id: string) => api.get<SecretAccessEvent[]>(`/secrets/${id}/access-events`),

  // --- User-specific secrets ---------------------------------------------
  // Admin: shared definitions each member fills in with their own value.
  listUserSecretDefinitions: () =>
    api.get<UserSecretDefinition[]>(`/user-secret-definitions`),
  createUserSecretDefinition: (data: CreateUserSecretDefinitionInput) =>
    api.post<UserSecretDefinition>(`/user-secret-definitions`, data),
  updateUserSecretDefinition: (
    definitionId: string,
    data: UpdateUserSecretDefinitionInput,
  ) =>
    api.patch<UserSecretDefinition>(
      `/user-secret-definitions/${definitionId}`,
      data,
    ),
  removeUserSecretDefinition: (definitionId: string) =>
    api.delete<{ ok: true }>(`/user-secret-definitions/${definitionId}`),
  userSecretDefinitionCoverage: (definitionId: string) =>
    api.get<UserSecretCoverageSummary>(
      `/user-secret-definitions/${definitionId}/coverage`,
    ),

  // Current user ("My secrets"): each definition paired with my own value.
  listMyUserSecrets: () =>
    api.get<MyUserSecretEntry[]>(`/me/user-secrets`),
  createMyUserSecret: (data: UpsertMyUserSecretInput) =>
    api.post<CompanySecret>(`/me/user-secrets`, data),
  updateMyUserSecret: (
    secretId: string,
    data: Partial<UpsertMyUserSecretInput> & { status?: SecretStatus },
  ) => api.patch<CompanySecret>(`/me/user-secrets/${secretId}`, data),
  rotateMyUserSecret: (secretId: string, data: UpsertMyUserSecretInput) =>
    api.post<CompanySecret>(`/me/user-secrets/${secretId}/rotate`, data),
  removeMyUserSecret: (secretId: string) =>
    api.delete<{ ok: true }>(`/me/user-secrets/${secretId}`),
  remoteImportPreview: (data: RemoteImportPreviewInput) =>
    api.post<RemoteSecretImportPreviewResult>(
      `/secrets/remote-import/preview`,
      data,
    ),
  remoteImport: (data: RemoteImportInput) =>
    api.post<RemoteSecretImportResult>(`/secrets/remote-import`, data),

  // --- Secret & binding proposals (PAP-14731) -----------------------------
  // Board-facing review surface. Agents propose credentials/bindings; humans
  // approve or reject them here. Values are never returned by these routes.
  listProposals: (status: SecretProposalStatus = "pending") =>
    api.get<SecretProposalView[]>(
      `/secret-proposals?status=${encodeURIComponent(status)}`,
    ),
  approveProposal: (proposalId: string, data: ApproveSecretProposalInput = {}) =>
    api.post<SecretProposalView>(
      `/secret-proposals/${proposalId}/approve`,
      data,
    ),
  rejectProposal: (proposalId: string, data: RejectSecretProposalInput) =>
    api.post<SecretProposalView>(
      `/secret-proposals/${proposalId}/reject`,
      data,
    ),
};
