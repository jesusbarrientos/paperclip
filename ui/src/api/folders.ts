import type {
  CreateFolderRequest,
  EnsureMySkillFolderRequest,
  Folder,
  FolderKind,
  FolderListResult,
  MoveFolderItemRequest,
  MoveFolderRequest,
  UpdateFolderRequest,
} from "@paperclipai/shared";
import { api } from "./client";

export const foldersApi = {
  list: (kind: FolderKind) =>
    api.get<FolderListResult>(`/folders?kind=${kind}`),
  create: (payload: CreateFolderRequest) =>
    api.post<Folder>(`/folders`, payload),
  ensureMy: (payload: EnsureMySkillFolderRequest = {}) =>
    api.post<Folder>(`/folders/ensure-my`, payload),
  update: (folderId: string, payload: UpdateFolderRequest) =>
    api.patch<Folder>(
      `/folders/${encodeURIComponent(folderId)}`,
      payload,
    ),
  moveFolder: (folderId: string, payload: MoveFolderRequest) =>
    api.post<Folder>(
      `/folders/${encodeURIComponent(folderId)}/move`,
      payload,
    ),
  moveItem: (payload: MoveFolderItemRequest) =>
    api.post<MoveFolderItemRequest>(
      `/folders/items/move`,
      payload,
    ),
  delete: (folderId: string) =>
    api.delete<{ deleted: Folder }>(
      `/folders/${encodeURIComponent(folderId)}`,
    ),
};
