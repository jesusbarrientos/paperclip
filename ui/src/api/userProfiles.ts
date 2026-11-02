import type { UserProfileResponse } from "@paperclipai/shared";
import { api } from "./client";

export const userProfilesApi = {
  get: (userSlug: string) =>
    api.get<UserProfileResponse>(
      `/users/${encodeURIComponent(userSlug)}/profile`,
    ),
};
