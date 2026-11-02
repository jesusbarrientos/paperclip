import type { SidebarOrderPreference, UpsertSidebarOrderPreference } from "@paperclipai/shared";
import { api } from "./client";

export const sidebarPreferencesApi = {
  getCompanyOrder: () => api.get<SidebarOrderPreference>("/sidebar-preferences/me"),
  updateCompanyOrder: (data: UpsertSidebarOrderPreference) =>
    api.put<SidebarOrderPreference>("/sidebar-preferences/me", data),
  getProjectOrder: () =>
    api.get<SidebarOrderPreference>(`/sidebar-preferences/me`),
  updateProjectOrder: (data: UpsertSidebarOrderPreference) =>
    api.put<SidebarOrderPreference>(`/sidebar-preferences/me`, data),
};
