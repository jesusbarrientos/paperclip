// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { InstanceAccess } from "./InstanceAccess";

const mocks = vi.hoisted(() => ({
  searchAdminUsers: vi.fn(), promoteInstanceAdmin: vi.fn(), demoteInstanceAdmin: vi.fn(),
  setBreadcrumbs: vi.fn(), pushToast: vi.fn(),
}));
vi.mock("@/api/access", () => ({ accessApi: mocks }));
vi.mock("@/context/BreadcrumbContext", () => ({ useBreadcrumbs: () => mocks }));
vi.mock("@/context/ToastContext", () => ({ useToast: () => mocks }));

const member = {
  id: "member", name: "Member", email: "member@example.com", isInstanceAdmin: false,
  activeCompanyMembershipCount: 1,
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function renderPage() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <InstanceAccess />
      </QueryClientProvider>,
    );
  });
}

async function eventually(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    assertion();
  });
}

function button(text: string) {
  return [...container.querySelectorAll("button")].find((element) => element.textContent === text);
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.searchAdminUsers.mockResolvedValue([member]);
  mocks.promoteInstanceAdmin.mockResolvedValue({});
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

describe("InstanceAccess", () => {
  it("shows organization membership and promotes the selected user", async () => {
    await renderPage();
    await eventually(() => {
      expect(container.textContent).toContain("Organization member");
      expect(button("Promote to instance admin")).toBeDefined();
    });
    await act(async () => button("Promote to instance admin")!.click());
    await eventually(() => expect(mocks.promoteInstanceAdmin).toHaveBeenCalledWith(member.id));
  });

  it("explains when instance administration is forbidden", async () => {
    mocks.searchAdminUsers.mockRejectedValue(new ApiError("Forbidden", 403, {}));
    await renderPage();
    await eventually(() => expect(container.textContent).toContain("Instance admin access is required"));
  });
});
