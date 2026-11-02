import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("./client", () => ({
  api: mockApi,
  detachInflightGet: vi.fn(),
}));

import { toolsApi } from "./tools";

describe("toolsApi.listActivity", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.get.mockResolvedValue({ events: [], nextCursor: null });
  });

  it("uses the omitted-window contract for all-time activity", async () => {
    await toolsApi.listActivity({ window: "all", limit: 50 });

    expect(mockApi.get).toHaveBeenCalledWith(
      "/tool-gateway/audit?limit=50",
    );
  });

  it("sends bounded activity windows explicitly", async () => {
    await toolsApi.listActivity({ window: "30d", limit: 50 });

    expect(mockApi.get).toHaveBeenCalledWith(
      "/tool-gateway/audit?window=30d&limit=50",
    );
  });
});
