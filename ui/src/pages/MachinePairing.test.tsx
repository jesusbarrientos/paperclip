// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MachinePairingDescription } from "@paperclipai/shared";
import { ApiError } from "@/api/client";
import { MachinePairingPage } from "./MachinePairing";

const mocks = vi.hoisted(() => ({
  describePairing: vi.fn(),
  approvePairing: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/api/machines", () => ({
  machinesApi: { describePairing: mocks.describePairing, approvePairing: mocks.approvePairing },
}));
vi.mock("@/api/auth", () => ({ authApi: { getSession: mocks.getSession } }));

const TOKEN = "t".repeat(32);

function pairing(overrides: Partial<MachinePairingDescription> = {}): MachinePairingDescription {
  return {
    machineId: "m-1",
    name: "Studio Mac",
    platform: "darwin",
    arch: "arm64",
    hostname: "studio.local",
    status: "pending",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    requiresSignIn: false,
    canApproveShared: false,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function renderPage(path = `/machines/pair/m-1?token=${TOKEN}`) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/machines/pair/:machineId" element={<MachinePairingPage />} />
          </Routes>
        </MemoryRouter>
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

function button(text: string) {
  return [...container.querySelectorAll("button")].find((element) => element.textContent === text);
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.getSession.mockResolvedValue({ session: { id: "s", userId: "user-1" }, user: { id: "user-1" } });
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

describe("MachinePairingPage", () => {
  it("approves a personal machine and tells the user to return to the terminal", async () => {
    mocks.describePairing.mockResolvedValueOnce(pairing()).mockResolvedValue(pairing({ status: "authorized" }));
    mocks.approvePairing.mockResolvedValue({});
    await renderPage();
    await eventually(() => {
      expect(container.textContent).toContain("Studio Mac");
      expect(container.textContent).toContain("studio.local");
      expect(container.textContent).toContain("macOS · arm64");
      expect(container.textContent).not.toContain("Shared machine");
    });
    await act(async () => button("Approve machine")!.click());
    await eventually(() => {
      expect(mocks.approvePairing).toHaveBeenCalledWith("m-1", TOKEN, false);
      expect(container.textContent).toContain("Machine approved");
      expect(container.textContent).toContain("Return to the terminal");
    });
  });

  it("offers the shared option only to instance admins", async () => {
    mocks.describePairing.mockResolvedValue(pairing({ canApproveShared: true }));
    await renderPage();
    await eventually(() => expect(container.textContent).toContain("Shared machine (available to everyone)"));
  });

  it("asks for sign-in before approving", async () => {
    mocks.describePairing.mockResolvedValue(pairing({ requiresSignIn: true }));
    await renderPage();
    await eventually(() => {
      expect(container.textContent).toContain("Sign in required");
      const link = container.querySelector("a")!;
      expect(link.getAttribute("href")).toBe(
        `/auth?next=${encodeURIComponent(`/machines/pair/m-1?token=${TOKEN}`)}`,
      );
    });
  });

  it("reports expired and already-approved requests", async () => {
    mocks.describePairing.mockResolvedValue(pairing({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    await renderPage();
    await eventually(() => expect(container.textContent).toContain("Pairing request expired"));

    client.clear();
    mocks.describePairing.mockResolvedValue(pairing({ status: "authorized" }));
    await renderPage(`/machines/pair/m-1?token=${"u".repeat(32)}`);
    await eventually(() => expect(container.textContent).toContain("Machine already approved"));
  });

  it("explains an unknown or used link", async () => {
    mocks.describePairing.mockRejectedValue(new ApiError("Machine pairing not found", 404, {}));
    await renderPage();
    await eventually(() => expect(container.textContent).toContain("invalid or was already used"));
  });

  it("shows approval errors", async () => {
    mocks.describePairing.mockResolvedValue(pairing());
    mocks.approvePairing.mockRejectedValue(new ApiError("Machine pairing expired.", 409, {}));
    await renderPage();
    await eventually(() => expect(button("Approve machine")).toBeDefined());
    await act(async () => button("Approve machine")!.click());
    await eventually(() => expect(container.textContent).toContain("Machine pairing expired."));
  });
});
