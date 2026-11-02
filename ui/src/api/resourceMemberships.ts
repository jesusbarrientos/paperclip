import type {
  ResourceMemberships,
  ResourceMembershipUpdateResult,
  UpdateResourceMembership,
} from "@paperclipai/shared";
import { api } from "./client";

export const resourceMembershipsApi = {
  listMine: () =>
    api.get<ResourceMemberships>(`/resource-memberships/me`),
  updateProject: (projectId: string, data: UpdateResourceMembership) =>
    api.put<ResourceMembershipUpdateResult>(
      `/resource-memberships/me/projects/${projectId}`,
      data,
    ),
  updateAgent: (agentId: string, data: UpdateResourceMembership) =>
    api.put<ResourceMembershipUpdateResult>(
      `/resource-memberships/me/agents/${agentId}`,
      data,
    ),
};
