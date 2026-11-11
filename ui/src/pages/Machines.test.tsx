// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Machine } from "@paperclipai/shared";
import { Machines } from "./Machines";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  rename: vi.fn(),
  revoke: vi.fn(),
  getCurrentBoardAccess: vi.fn(),
  setBreadcrumbs: vi.fn(),
  pushToast: vi.fn(),
}));
vi.mock("@/api/machines", () => ({
  machinesApi: { list: mocks.list, rename: mocks.rename, revoke: mocks.revoke },
  workContextsApi: {},
}));
vi.mock("@/api/access", () => ({ accessApi: { getCurrentBoardAccess: mocks.getCurrentBoardAccess } }));
vi.mock("@/context/BreadcrumbContext", () => ({ useBreadcrumbs: () => mocks }));
vi.mock("@/context/ToastContext", () => ({ useToast: () => mocks }));

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: "m-1",
    name: "Studio Mac",
    ownerUserId: "user-1",
    shared: false,
    status: "authorized",
    platform: "darwin",
    arch: "arm64",
    hostname: "studio.local",
    daemonVersion: "0.4.0",
    capabilities: { docker: true, devcontainerCli: true, runnerd: null, tools: ["node", "git"] },
    workspaceRoot: null,
    environmentId: null,
    connected: false,
    lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    authorizedAt: null,
    revokedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function renderPage() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Machines />
      </QueryClientProvider>,
    );
  });
}

async function eventually(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assertion();
  });
}

function button(text: string, scope: ParentNode = document.body) {
  return [...scope.querySelectorAll("button")].find((element) => element.textContent === text);
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.getCurrentBoardAccess.mockResolvedValue({
    user: null,
    userId: "user-1",
    isInstanceAdmin: false,
    source: "session",
    keyId: null,
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

describe("Machines", () => {
  it("explains how to pair when there are no machines", async () => {
    mocks.list.mockResolvedValue([]);
    await renderPage();
    await eventually(() => {
      expect(container.textContent).toContain("No machines yet");
      expect(container.textContent).toContain(`paperclipai machine pair --server ${window.location.origin}`);
      expect(container.textContent).toContain("paperclipai machine run");
    });
  });

  it("shows status, ownership and capabilities, and only offers management to the owner", async () => {
    mocks.list.mockResolvedValue([
      machine(),
      machine({ id: "m-2", name: "Build box", ownerUserId: "user-9", shared: true, connected: true }),
    ]);
    await renderPage();
    await eventually(() => {
      const own = container.querySelector('[data-testid="machine-row-m-1"]')!;
      expect(own.textContent).toContain("Personal");
      expect(own.textContent).toContain("Offline");
      expect(own.textContent).toContain("Last seen 2h ago");
      expect(own.textContent).toContain("macOS · arm64");
      expect(own.textContent).toContain("Docker");
      expect(own.textContent).toContain("Dev Container CLI");
      expect(own.textContent).toContain("node");
      expect(button("Revoke", own)).toBeDefined();

      const shared = container.querySelector('[data-testid="machine-row-m-2"]')!;
      expect(shared.textContent).toContain("Shared");
      expect(shared.textContent).toContain("Online");
      expect(button("Revoke", shared)).toBeUndefined();
    });
  });

  it("revokes a machine after confirmation", async () => {
    mocks.list.mockResolvedValue([machine()]);
    mocks.revoke.mockResolvedValue(machine({ status: "revoked" }));
    await renderPage();
    await eventually(() => expect(button("Revoke")).toBeDefined());
    await act(async () => button("Revoke")!.click());
    await eventually(() => expect(button("Revoke machine")).toBeDefined());
    expect(mocks.revoke).not.toHaveBeenCalled();
    await act(async () => button("Revoke machine")!.click());
    await eventually(() => expect(mocks.revoke).toHaveBeenCalledWith("m-1"));
  });

  it("surfaces a load failure", async () => {
    mocks.list.mockRejectedValue(new Error("boom"));
    await renderPage();
    await eventually(() => expect(container.textContent).toContain("boom"));
  });
});
