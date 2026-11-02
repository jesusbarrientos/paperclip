import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type Context,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Company } from "@paperclipai/shared";
import { ApiError } from "../api/client";
import { organizationApi, type OrganizationCreateInput } from "../api/organization";
import { queryKeys } from "../lib/queryKeys";

export interface OrganizationContextValue {
  /** `null` while loading, after an error, and when the instance has no organization yet. */
  organization: Company | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  createOrganization: (data: OrganizationCreateInput) => Promise<Company>;
}

// A hot refresh can replace consumers before a mounted provider is replaced, so
// the context identity lives in Vite's per-module data.
const OrganizationContext: Context<OrganizationContextValue | null> =
  import.meta.hot?.data?.organizationContext ?? createContext<OrganizationContextValue | null>(null);
if (import.meta.hot?.data) import.meta.hot.data.organizationContext = OrganizationContext;

export const organizationQueryOptions = {
  queryKey: queryKeys.organization,
  queryFn: async (): Promise<Company | null> => {
    try {
      return await organizationApi.get();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
  retry: 1,
} as const;

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(organizationQueryOptions);

  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.organization });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (input: OrganizationCreateInput) => organizationApi.create(input),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKeys.organization, created);
    },
  });
  const { mutateAsync } = createMutation;
  const createOrganization = useCallback(
    (input: OrganizationCreateInput) => mutateAsync(input),
    [mutateAsync],
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organization: data ?? null,
      loading: isLoading,
      error: (error as Error | null) ?? null,
      reload,
      createOrganization,
    }),
    [data, isLoading, error, reload, createOrganization],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return ctx;
}

/**
 * Non-throwing variant of {@link useOrganization} for surfaces that can render
 * without the provider (e.g. exported/standalone markdown).
 */
export function useOptionalOrganization(): OrganizationContextValue | null {
  return useContext(OrganizationContext);
}
