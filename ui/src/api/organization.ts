import type {
  Company,
  CompanyPortabilityExportRequest,
  CompanyPortabilityExportPreviewResult,
  CompanyPortabilityExportResult,
  CompanyPortabilityImportRequest,
  CompanyPortabilityImportResult,
  CompanyPortabilityPreviewRequest,
  CompanyPortabilityPreviewResult,
  UpdateCompanyBranding,
} from "@paperclipai/shared";
import type { ExportFidelityReport } from "@paperclipai/shared/portability-fidelity";
import {
  companyImportTransferApplyPath,
  companyImportTransferPartPath,
  companyImportTransferPath,
  companyImportTransferPreviewPath,
  COMPANY_IMPORT_TRANSFERS_ROUTE_PATH,
  type CompanyImportTransferCreated,
  type CompanyImportTransferDeclaration,
  type CompanyImportTransferPartUploadResult,
  type CompanyImportTransferStatus,
} from "@paperclipai/shared/company-import-transfer";
import { api, type RequestOptions } from "./client";

const ORGANIZATION_PATH = "/organization";

export type OrganizationPortabilityPreviewMeta = Omit<CompanyPortabilityPreviewRequest, "source">;
export type OrganizationPortabilityImportMeta = Omit<CompanyPortabilityImportRequest, "source">;

function importPackageForm(
  file: File,
  meta: OrganizationPortabilityPreviewMeta | OrganizationPortabilityImportMeta,
): FormData {
  const form = new FormData();
  form.append("package", file);
  form.append("meta", JSON.stringify(meta));
  return form;
}

export type OrganizationImportJobState = "running" | "succeeded" | "failed";

/** 202 body from the async import opt-in (and the 409 body when a job is already running). */
export interface OrganizationImportJobAccepted {
  job: { id: string; status: OrganizationImportJobState };
  statusUrl: string;
  retryAfterMs?: number;
}

export interface OrganizationImportJobStatus {
  job: {
    id: string;
    status: OrganizationImportJobState;
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string;
    error?: { message: string };
    result?: {
      agentCount?: number;
      warningCount?: number;
      companyAction?: unknown;
    };
    /** Board-created jobs carry the full result for parity with the sync response. */
    importResult?: CompanyPortabilityImportResult;
  };
  retryAfterMs?: number;
}

export type OrganizationCreateInput = {
  name: string;
  description?: string | null;
  budgetMonthlyCents?: number;
};

export type OrganizationUpdateInput = Partial<
  Pick<
    Company,
    | "name"
    | "description"
    | "budgetMonthlyCents"
    | "requireBoardApprovalForNewAgents"
    | "interactionResolverGovernance"
    | "feedbackDataSharingEnabled"
    | "logoAssetId"
  >
>;

export const organizationApi = {
  /** Rejects with a 404 `ApiError` (code `organization_missing`) until onboarding creates it. */
  get: () => api.get<Company>(ORGANIZATION_PATH),
  /** Only valid while the instance has no organization yet. */
  create: (data: OrganizationCreateInput) => api.post<Company>(ORGANIZATION_PATH, data),
  update: (data: OrganizationUpdateInput) => api.patch<Company>(ORGANIZATION_PATH, data),
  updateBranding: (data: UpdateCompanyBranding) =>
    api.patch<Company>(`${ORGANIZATION_PATH}/branding`, data),
  exportBundle: (data: CompanyPortabilityExportRequest) =>
    api.post<CompanyPortabilityExportResult>(`${ORGANIZATION_PATH}/exports`, data),
  exportPreview: (data: CompanyPortabilityExportRequest, options?: RequestOptions) =>
    api.post<CompanyPortabilityExportPreviewResult>(`${ORGANIZATION_PATH}/exports/preview`, data, options),
  exportFidelity: () => api.get<ExportFidelityReport>(`${ORGANIZATION_PATH}/export/fidelity`),
  importPreview: (data: CompanyPortabilityPreviewRequest) =>
    api.post<CompanyPortabilityPreviewResult>(`${ORGANIZATION_PATH}/import/preview`, data),
  importPreviewPackage: (file: File, meta: OrganizationPortabilityPreviewMeta) =>
    api.postForm<CompanyPortabilityPreviewResult>(
      `${ORGANIZATION_PATH}/import/preview`,
      importPackageForm(file, meta),
    ),
  importBundle: (data: CompanyPortabilityImportRequest) =>
    api.post<CompanyPortabilityImportResult>(`${ORGANIZATION_PATH}/import`, data),
  // `?async=1` rather than the `x-paperclip-cloud-*` header: the Cloud harness
  // strips that inbound header, so it never reaches the server from a browser.
  importBundleAsync: (data: CompanyPortabilityImportRequest) =>
    api.post<OrganizationImportJobAccepted>(`${ORGANIZATION_PATH}/import?async=1`, data),
  importBundlePackageAsync: (file: File, meta: OrganizationPortabilityImportMeta) =>
    api.postForm<OrganizationImportJobAccepted>(
      `${ORGANIZATION_PATH}/import?async=1`,
      importPackageForm(file, meta),
    ),
  getImportJob: (jobId: string) =>
    api.get<OrganizationImportJobStatus>(
      `${ORGANIZATION_PATH}/import/jobs/${encodeURIComponent(jobId)}`,
    ),
  // Re-declaring the same zip resumes the prior transfer: transfers are
  // content-addressed and keep their uploaded parts.
  importTransferCreate: (manifest: CompanyImportTransferDeclaration) =>
    api.post<CompanyImportTransferCreated>(
      `${ORGANIZATION_PATH}${COMPANY_IMPORT_TRANSFERS_ROUTE_PATH}`,
      manifest,
    ),
  importTransferUploadPart: (transferId: string, index: number, bytes: Blob) =>
    api.putRaw<CompanyImportTransferPartUploadResult>(
      `${ORGANIZATION_PATH}${companyImportTransferPartPath(transferId, index)}`,
      bytes,
    ),
  importTransferStatus: (transferId: string) =>
    api.get<CompanyImportTransferStatus>(
      `${ORGANIZATION_PATH}${companyImportTransferPath(transferId)}`,
    ),
  importTransferPreview: (transferId: string, meta: OrganizationPortabilityPreviewMeta) =>
    api.post<CompanyPortabilityPreviewResult>(
      `${ORGANIZATION_PATH}${companyImportTransferPreviewPath(transferId)}`,
      meta,
    ),
  importTransferApply: (transferId: string, meta: OrganizationPortabilityImportMeta) =>
    api.post<OrganizationImportJobAccepted>(
      `${ORGANIZATION_PATH}${companyImportTransferApplyPath(transferId)}?async=1`,
      meta,
    ),
};
