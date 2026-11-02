// @vitest-environment jsdom

import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { McpConnectPage, McpDevicePage } from "./McpConnect";

const route = vi.hoisted(() => ({ id: "request-one", unavailable: false, canWrite: true, requestedWrite: true, clientName: "Assistant", clientOrigin: null as string | null, setupUrl: "https://my.paperclip.app/orgs/new" }));
vi.mock("@/lib/router", () => ({
  useParams: () => ({ id: route.id }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/CompanyPatternIcon", () => ({
  CompanyPatternIcon: ({ companyName, logoUrl }: { companyName: string; logoUrl?: string | null }) => <img alt={`${companyName} logo`} src={logoUrl ?? undefined} />,
}));
vi.mock("../api/client", () => ({ api: {
  get: vi.fn(async () => ({
    id: route.id, clientName: route.clientName, clientOrigin: route.clientOrigin, redirectOrigin: "https://assistant.example.test",
    requestedWrite: route.requestedWrite, offlineAccess: true, requiresSignIn: false,
    companies: route.unavailable ? [] : [
      { id: "company-one", name: "Acme Research", logoUrl: "/api/assets/acme-logo/content", canWrite: route.canWrite },
    ], setupUrl: route.setupUrl,
  })),
  post: vi.fn(() => new Promise(() => {})),
} }));

beforeEach(() => {
  Object.assign(route, { id: "request-one", unavailable: false, canWrite: true, requestedWrite: true, clientName: "Assistant", clientOrigin: null, setupUrl: "https://my.paperclip.app/orgs/new" });
  vi.clearAllMocks();
});

function setup(device = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = () => flushSync(() => root.render(<QueryClientProvider client={client}>{device ? <McpDevicePage initialCode="MIST-YPED" /> : <McpConnectPage />}</QueryClientProvider>));
  render();
  return {
    client, container, render,
    connect: () => Array.from(container.querySelectorAll("button")).find(item => item.textContent === "Connect organization")!,
    checkbox: () => container.querySelector('[role="checkbox"]') as HTMLButtonElement,
    cleanup: () => { flushSync(() => root.unmount()); container.remove(); client.clear(); },
  };
}

it("lets a person correct an invalid device code without reloading", async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Invalid code"));
  const page = setup(true);
  try {
    await vi.waitFor(() => expect(page.container.textContent).toContain("Invalid code"));
    const edit = Array.from(page.container.querySelectorAll("button")).find(item => item.textContent === "Enter a different code")!;
    flushSync(() => edit.click());
    expect(page.container.querySelector<HTMLInputElement>("#device-code")?.value).toBe("MIST-YPED");
    expect(page.container.querySelector("form")).not.toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  } finally { page.cleanup(); }
});

it("identifies the receiving app and registered callback origin before approval", async () => {
  route.clientName = "Claude";
  route.clientOrigin = "https://claude.ai";
  const page = setup();
  try {
    await vi.waitFor(() => expect(page.container.querySelector("h1")?.textContent).toBe("Connect Claude to Paperclip"));
    expect(page.container.textContent).toContain("https://claude.ai");
    expect(page.container.textContent).toContain("https://assistant.example.test");
    expect(page.container.querySelector('img[src^="https://assistant.example.test"]')).toBeNull();
    expect(page.container.querySelector('img[src="/brands/claude-color.svg"]')).not.toBeNull();
    expect(page.container.querySelector('a[href="https://my.paperclip.app/orgs/new"]')).toBeNull();
    expect(page.connect().disabled).toBe(false);
    expect(page.container.querySelector('a[href="https://assistant.example.test"]')).toBeNull();
  } finally { page.cleanup(); }
});

it("shows the organization and preserves a write opt-out across refetches", async () => {
  const page = setup();
  try {
    await vi.waitFor(() => expect(page.container.textContent).toContain("Acme Research"));
    expect(page.container.querySelector('img[alt="Acme Research logo"]')?.getAttribute("src")).toBe("/api/assets/acme-logo/content");
    expect(page.checkbox().getAttribute("aria-checked")).toBe("true");
    flushSync(() => page.checkbox().click());
    expect(page.checkbox().getAttribute("aria-checked")).toBe("false");
    await page.client.invalidateQueries({ queryKey: ["mcp-request", route.id] });
    expect(page.checkbox().getAttribute("aria-checked")).toBe("false");
    flushSync(() => page.connect().click());
    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith("/mcp/requests/request-one/consent", { decision: "approve", allowWrites: false }));
    route.id = "request-two";
    page.render();
    await vi.waitFor(() => expect(page.checkbox().getAttribute("aria-checked")).toBe("true"));
  } finally { page.cleanup(); }
});

it("blocks approval once the account loses access to the organization", async () => {
  const page = setup();
  try {
    await vi.waitFor(() => expect(page.container.textContent).toContain("Acme Research"));
    route.canWrite = false;
    await page.client.invalidateQueries({ queryKey: ["mcp-request", route.id] });
    await vi.waitFor(() => expect(page.checkbox().disabled).toBe(true));
    expect(page.checkbox().getAttribute("aria-checked")).toBe("false");
    route.unavailable = true;
    await page.client.invalidateQueries({ queryKey: ["mcp-request", route.id] });
    await vi.waitFor(() => expect(page.container.textContent).toContain("no access to the organization"));
    expect(page.connect().disabled).toBe(true);
    expect(Array.from(page.container.querySelectorAll("button")).find(item => item.textContent === "Cancel")!.disabled).toBe(false);
    expect(api.post).not.toHaveBeenCalled();
  } finally { page.cleanup(); }
});

it.each([
  { requestedWrite: true, canWrite: true, allowWrites: true },
  { requestedWrite: true, canWrite: false, allowWrites: false },
  { requestedWrite: false, canWrite: true, allowWrites: false },
])("submits only allowed requested access: %j", async ({ requestedWrite, canWrite, allowWrites }) => {
  Object.assign(route, { requestedWrite, canWrite });
  const page = setup();
  try {
    await vi.waitFor(() => expect(page.container.textContent).toContain("Acme Research"));
    if (requestedWrite) {
      expect(page.checkbox().getAttribute("aria-checked")).toBe(String(allowWrites));
      expect(page.checkbox().disabled).toBe(!canWrite);
    } else expect(page.checkbox()).toBeNull();
    flushSync(() => page.connect().click());
    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith("/mcp/requests/request-one/consent", { decision: "approve", allowWrites }));
  } finally { page.cleanup(); }
});

it("denies without granting the default write permission", async () => {
  const page = setup();
  try {
    await vi.waitFor(() => expect(page.checkbox()?.getAttribute("aria-checked")).toBe("true"));
    flushSync(() => Array.from(page.container.querySelectorAll("button")).find(button => button.textContent === "Cancel")!.click());
    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith("/mcp/requests/request-one/consent", { decision: "deny", allowWrites: false }));
  } finally { page.cleanup(); }
});

it("does not fetch client-selected favicons or trust names for branding", async () => {
  route.clientName = "Claude";
  route.clientOrigin = "https://unrecognized.example.test";
  const page = setup();
  try {
    await vi.waitFor(() => expect(page.container.textContent).toContain(route.clientOrigin));
    expect(page.container.textContent).toContain("https://assistant.example.test");
    expect(page.container.querySelector('img[src^="https://"]')).toBeNull();
    expect(page.container.querySelector('img[src="/brands/claude-color.svg"]')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  } finally { page.cleanup(); }
});
