// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Company } from "@paperclipai/shared";
import { ApiError } from "../api/client";
import { OrganizationProvider, useOrganization, type OrganizationContextValue } from "./OrganizationContext";

const mockOrganizationApi = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../api/organization", () => ({ organizationApi: mockOrganizationApi }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ORGANIZATION = { id: "org-1", name: "Paperclip", issuePrefix: "PAP" } as Company;

describe("OrganizationProvider", () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let latest: OrganizationContextValue | null;

  function Probe() {
    latest = useOrganization();
    return null;
  }

  async function mount() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OrganizationProvider>
            <Probe />
          </OrganizationProvider>
        </QueryClientProvider>,
      );
    });
  }

  async function settled() {
    await act(async () => {
      await vi.waitFor(() => expect(latest?.loading).toBe(false));
    });
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
    latest = null;
    mockOrganizationApi.get.mockReset();
    mockOrganizationApi.create.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    queryClient.clear();
  });

  it("exposes the instance organization", async () => {
    mockOrganizationApi.get.mockResolvedValue(ORGANIZATION);
    await mount();
    await settled();
    expect(latest?.organization).toEqual(ORGANIZATION);
    expect(latest?.error).toBeNull();
    expect(latest?.loading).toBe(false);
  });

  it("treats a 404 as an instance with no organization yet, not as an error", async () => {
    mockOrganizationApi.get.mockRejectedValue(
      new ApiError("Organization not initialized", 404, { code: "organization_missing" }),
    );
    await mount();
    await settled();
    expect(latest?.organization).toBeNull();
    expect(latest?.error).toBeNull();
  });

  it("reports other failures as errors", async () => {
    mockOrganizationApi.get.mockRejectedValue(new ApiError("boom", 500, {}));
    await mount();
    await act(async () => {
      await vi.waitFor(() => expect(latest?.error).toBeInstanceOf(ApiError));
    });
    expect(latest?.organization).toBeNull();
  });

  it("caches the created organization so the shell leaves onboarding without a refetch", async () => {
    mockOrganizationApi.get.mockRejectedValue(new ApiError("missing", 404, {}));
    mockOrganizationApi.create.mockResolvedValue(ORGANIZATION);
    await mount();
    await settled();

    await act(async () => {
      await latest!.createOrganization({ name: "Paperclip" });
    });

    expect(mockOrganizationApi.create).toHaveBeenCalledWith({ name: "Paperclip" });
    await act(async () => {
      await vi.waitFor(() => expect(latest?.organization).toEqual(ORGANIZATION));
    });
    expect(mockOrganizationApi.get).toHaveBeenCalledTimes(1);
  });
});
