import type {
  CatalogSkill,
  CatalogSkillFileDetail,
  CatalogSkillKind,
  CompanySkill,
  CompanySkillCategoryCount,
  CompanySkillComment,
  CompanySkillCommentCreateRequest,
  CompanySkillCommentUpdateRequest,
  CompanySkillCreateRequest,
  CompanySkillDetail,
  CompanySkillFileDetail,
  CompanySkillFileDeleteRequest,
  CompanySkillFileDeleteResult,
  CompanySkillForkPrecheckResult,
  CompanySkillForkRequest,
  CompanySkillForkResult,
  CompanySkillImportResult,
  CompanySkillInstallCatalogRequest,
  CompanySkillInstallCatalogResult,
  CompanySkillListQuery,
  CompanySkillListItem,
  CompanySkillProjectBrowseRequest,
  CompanySkillProjectBrowseResult,
  CompanySkillProjectScanRequest,
  CompanySkillProjectScanResult,
  CompanySkillStarResult,
  CompanySkillTestInput,
  CompanySkillTestInputCreateRequest,
  CompanySkillTestInputUpdateRequest,
  CompanySkillTestRun,
  CompanySkillTestRunCreateRequest,
  CompanySkillTestRunDetail,
  CompanySkillTestRunListQuery,
  CompanySkillTestRunTemplate,
  CompanySkillTestRunTemplateCreateRequest,
  CompanySkillTestRunTemplateUpdateRequest,
  CompanySkillUpdateRequest,
  CompanySkillUpdateStatus,
  CompanySkillVersion,
  CompanySkillVersionCreateRequest,
} from "@paperclipai/shared";
import { api } from "./client";

export interface CatalogListQuery {
  kind?: CatalogSkillKind;
  category?: string;
  q?: string;
}

export const companySkillsApi = {
  list: (query: CompanySkillListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.sort) params.set("sort", query.sort);
    if (query.scope) params.set("scope", query.scope);
    for (const category of query.categories ?? []) params.append("categories[]", category);
    for (const include of query.include ?? []) params.append("include[]", include);
    const search = params.toString();
    return api.get<CompanySkillListItem[]>(`/skills${search ? `?${search}` : ""}`);
  },
  categories: () =>
    api.get<CompanySkillCategoryCount[]>(`/skills/categories`),
  detail: (skillId: string) =>
    api.get<CompanySkillDetail>(
      `/skills/${encodeURIComponent(skillId)}`,
    ),
  versions: (skillId: string) =>
    api.get<CompanySkillVersion[]>(
      `/skills/${encodeURIComponent(skillId)}/versions`,
    ),
  version: (skillId: string, versionId: string) =>
    api.get<CompanySkillVersion>(
      `/skills/${encodeURIComponent(skillId)}/versions/${encodeURIComponent(versionId)}`,
    ),
  createVersion: (skillId: string, payload: CompanySkillVersionCreateRequest = {}) =>
    api.post<CompanySkillVersion>(
      `/skills/${encodeURIComponent(skillId)}/versions`,
      payload,
    ),
  // --- Skill Studio test inputs (PAP-12960 P1 API) ---
  testInputs: (skillId: string) =>
    api.get<CompanySkillTestInput[]>(
      `/skills/${encodeURIComponent(skillId)}/test-inputs`,
    ),
  createTestInput: (skillId: string, payload: CompanySkillTestInputCreateRequest) =>
    api.post<CompanySkillTestInput>(
      `/skills/${encodeURIComponent(skillId)}/test-inputs`,
      payload,
    ),
  updateTestInput: (
    skillId: string,
    inputId: string,
    payload: CompanySkillTestInputUpdateRequest,
  ) =>
    api.patch<CompanySkillTestInput>(
      `/skills/${encodeURIComponent(skillId)}/test-inputs/${encodeURIComponent(inputId)}`,
      payload,
    ),
  deleteTestInput: (skillId: string, inputId: string) =>
    api.delete<CompanySkillTestInput>(
      `/skills/${encodeURIComponent(skillId)}/test-inputs/${encodeURIComponent(inputId)}`,
    ),
  // --- Skill Studio cross-skill run templates ---
  testRunTemplates: () =>
    api.get<CompanySkillTestRunTemplate[]>(
      `/skill-test-run-templates`,
    ),
  createTestRunTemplate: (payload: CompanySkillTestRunTemplateCreateRequest) =>
    api.post<CompanySkillTestRunTemplate>(
      `/skill-test-run-templates`,
      payload,
    ),
  updateTestRunTemplate: (templateId: string, payload: CompanySkillTestRunTemplateUpdateRequest) =>
    api.patch<CompanySkillTestRunTemplate>(
      `/skill-test-run-templates/${encodeURIComponent(templateId)}`,
      payload,
    ),
  deleteTestRunTemplate: (templateId: string) =>
    api.delete<CompanySkillTestRunTemplate>(
      `/skill-test-run-templates/${encodeURIComponent(templateId)}`,
    ),
  // --- Skill Studio test runs ---
  testRuns: (skillId: string, query: CompanySkillTestRunListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.inputId) params.set("inputId", query.inputId);
    const search = params.toString();
    return api.get<CompanySkillTestRun[]>(
      `/skills/${encodeURIComponent(skillId)}/test-runs${search ? `?${search}` : ""}`,
    );
  },
  testRunDetail: (skillId: string, runId: string) =>
    api.get<CompanySkillTestRunDetail>(
      `/skills/${encodeURIComponent(skillId)}/test-runs/${encodeURIComponent(runId)}`,
    ),
  createTestRun: (skillId: string, payload: CompanySkillTestRunCreateRequest) =>
    api.post<CompanySkillTestRun>(
      `/skills/${encodeURIComponent(skillId)}/test-runs`,
      payload,
    ),
  cancelTestRun: (skillId: string, runId: string) =>
    api.post<CompanySkillTestRun>(
      `/skills/${encodeURIComponent(skillId)}/test-runs/${encodeURIComponent(runId)}/cancel`,
      {},
    ),
  deleteTestRun: (skillId: string, runId: string) =>
    api.delete<CompanySkillTestRun>(
      `/skills/${encodeURIComponent(skillId)}/test-runs/${encodeURIComponent(runId)}`,
    ),
  star: (skillId: string) =>
    api.post<CompanySkillStarResult>(
      `/skills/${encodeURIComponent(skillId)}/star`,
      {},
    ),
  unstar: (skillId: string) =>
    api.delete<CompanySkillStarResult>(
      `/skills/${encodeURIComponent(skillId)}/star`,
    ),
  fork: (skillId: string, payload: CompanySkillForkRequest = {}) =>
    api.post<CompanySkillForkResult>(
      `/skills/${encodeURIComponent(skillId)}/fork`,
      payload,
    ),
  forkPrecheck: (skillId: string) =>
    api.get<CompanySkillForkPrecheckResult>(
      `/skills/${encodeURIComponent(skillId)}/fork-precheck`,
    ),
  comments: (skillId: string) =>
    api.get<CompanySkillComment[]>(
      `/skills/${encodeURIComponent(skillId)}/comments`,
    ),
  createComment: (skillId: string, payload: CompanySkillCommentCreateRequest) =>
    api.post<CompanySkillComment>(
      `/skills/${encodeURIComponent(skillId)}/comments`,
      payload,
    ),
  updateComment: (skillId: string, commentId: string, payload: CompanySkillCommentUpdateRequest) =>
    api.patch<CompanySkillComment>(
      `/skills/${encodeURIComponent(skillId)}/comments/${encodeURIComponent(commentId)}`,
      payload,
    ),
  deleteComment: (skillId: string, commentId: string) =>
    api.delete<CompanySkillComment>(
      `/skills/${encodeURIComponent(skillId)}/comments/${encodeURIComponent(commentId)}`,
    ),
  updateStatus: (skillId: string) =>
    api.get<CompanySkillUpdateStatus>(
      `/skills/${encodeURIComponent(skillId)}/update-status`,
    ),
  file: (skillId: string, relativePath: string) =>
    api.get<CompanySkillFileDetail>(
      `/skills/${encodeURIComponent(skillId)}/files?path=${encodeURIComponent(relativePath)}`,
    ),
  updateFile: (skillId: string, path: string, content: string, format: Pick<CompanySkillFileDetail, "encoding" | "executable"> = {}) =>
    api.patch<CompanySkillFileDetail>(
      `/skills/${encodeURIComponent(skillId)}/files`,
      { path, content, ...format },
    ),
  deleteFile: (skillId: string, payload: CompanySkillFileDeleteRequest) =>
    api.deleteWithBody<CompanySkillFileDeleteResult>(
      `/skills/${encodeURIComponent(skillId)}/files`,
      payload,
    ),
  create: (payload: CompanySkillCreateRequest) =>
    api.post<CompanySkill>(
      `/skills`,
      payload,
    ),
  update: (skillId: string, payload: CompanySkillUpdateRequest) =>
    api.patch<CompanySkill>(
      `/skills/${encodeURIComponent(skillId)}`,
      payload,
    ),
  importFromSource: (source: string) =>
    api.post<CompanySkillImportResult>(
      `/skills/import`,
      { source },
    ),
  browseProject: (payload: CompanySkillProjectBrowseRequest) =>
    api.post<CompanySkillProjectBrowseResult>(
      `/skills/browse-project`,
      payload,
    ),
  scanProjects: (payload: CompanySkillProjectScanRequest = {}) =>
    api.post<CompanySkillProjectScanResult>(
      `/skills/scan-projects`,
      payload,
    ),
  installUpdate: (skillId: string) =>
    api.post<CompanySkill>(
      `/skills/${encodeURIComponent(skillId)}/install-update`,
      {},
    ),
  delete: (skillId: string) =>
    api.delete<CompanySkill>(
      `/skills/${encodeURIComponent(skillId)}`,
    ),
  catalogList: (query: CatalogListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.kind) params.set("kind", query.kind);
    if (query.category) params.set("category", query.category);
    if (query.q) params.set("q", query.q);
    const search = params.toString();
    return api.get<CatalogSkill[]>(`/skills/catalog${search ? `?${search}` : ""}`);
  },
  catalogDetail: (catalogRef: string) =>
    api.get<CatalogSkill>(`/skills/catalog/${encodeURIComponent(catalogRef)}`),
  catalogFile: (catalogRef: string, relativePath: string = "SKILL.md") =>
    api.get<CatalogSkillFileDetail>(
      `/skills/catalog/${encodeURIComponent(catalogRef)}/files?path=${encodeURIComponent(relativePath)}`,
    ),
  installCatalog: (payload: CompanySkillInstallCatalogRequest) =>
    api.post<CompanySkillInstallCatalogResult>(
      `/skills/install-catalog`,
      payload,
    ),
};
