import type {
  Project,
  ProjectClonedRepository,
  ProjectRepositoryOptions,
  ProjectWorkspace,
  WorkspaceOperation,
  WorkspaceRuntimeControlTarget,
} from "@paperclipai/shared";
import { api } from "./client";
import { sanitizeWorkspaceRuntimeControlTarget } from "./workspace-runtime-control";

function projectPath(id: string, suffix = "") {
  return `/projects/${encodeURIComponent(id)}${suffix}`;
}

export const projectsApi = {
  repositoryOptions: () => api.get<ProjectRepositoryOptions>(`/project-repositories`),
  setRepositories: (id: string, repositoryIds: string[]) => api.put<Project>(projectPath(id, "/repositories"), { repositoryIds }),
  list: (opts: { includeArchived?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (opts.includeArchived) params.set("includeArchived", "true");
    const query = params.toString();
    return api.get<Project[]>("/projects" + (query ? "?" + query : ""));
  },
  get: (id: string) => api.get<Project>(projectPath(id)),
  create: (data: Record<string, unknown>) =>
    api.post<Project>(`/projects`, data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Project>(projectPath(id), data),
  listClonedRepositories: (projectId: string) =>
    api.get<ProjectClonedRepository[]>(projectPath(projectId, "/cloned-repositories")),
  listWorkspaces: (projectId: string) =>
    api.get<ProjectWorkspace[]>(projectPath(projectId, "/workspaces")),
  createWorkspace: (projectId: string, data: Record<string, unknown>) =>
    api.post<ProjectWorkspace>(projectPath(projectId, "/workspaces"), data),
  updateWorkspace: (projectId: string, workspaceId: string, data: Record<string, unknown>) =>
    api.patch<ProjectWorkspace>(
      projectPath(projectId, `/workspaces/${encodeURIComponent(workspaceId)}`),
      data,
    ),
  controlWorkspaceRuntimeServices: (
    projectId: string,
    workspaceId: string,
    action: "start" | "stop" | "restart",
    target: WorkspaceRuntimeControlTarget = {},
  ) =>
    api.post<{ workspace: ProjectWorkspace; operation: WorkspaceOperation }>(
      projectPath(projectId, `/workspaces/${encodeURIComponent(workspaceId)}/runtime-services/${action}`),
      sanitizeWorkspaceRuntimeControlTarget(target),
    ),
  controlWorkspaceCommands: (
    projectId: string,
    workspaceId: string,
    action: "start" | "stop" | "restart" | "run",
    target: WorkspaceRuntimeControlTarget = {},
  ) =>
    api.post<{ workspace: ProjectWorkspace; operation: WorkspaceOperation }>(
      projectPath(projectId, `/workspaces/${encodeURIComponent(workspaceId)}/runtime-commands/${action}`),
      sanitizeWorkspaceRuntimeControlTarget(target),
    ),
  removeWorkspace: (projectId: string, workspaceId: string) =>
    api.delete<ProjectWorkspace>(projectPath(projectId, `/workspaces/${encodeURIComponent(workspaceId)}`)),
  remove: (id: string) => api.delete<Project>(projectPath(id)),
};
