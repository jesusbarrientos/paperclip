// @vitest-environment jsdom

// Regression guard for the Audit hub: Activity remains the canonical root,
// while Runs, Costs, and Budgets live beneath it. Legacy routes must keep
// resolving with their query filters intact; `/audit`
// specifically retains the historical Agent Actions preset. This drives the
// real <App> route table so removing either registration fails loudly.

import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const streamlinedUiState = vi.hoisted(() => ({ enabled: true, loaded: true }));

vi.mock("./hooks/useStreamlinedUiEnabled", () => ({
  useStreamlinedUiEnabled: () => streamlinedUiState,
}));

// jsdom's CSS parser rejects the custom-property marker rule stitches inserts
// (`--sxs{--sxs:N}`), pulled into <App>'s eager import graph transitively via
// @codesandbox/sandpack-react. Substitute a benign, valid rule on parse failure
// so stitches' index bookkeeping stays intact and the module graph evaluates.
vi.hoisted(() => {
  const sheetProto = window.CSSStyleSheet.prototype as unknown as {
    insertRule: (rule: string, index?: number) => number;
    __papActivityRoutingPatched?: boolean;
  };
  if (!sheetProto.__papActivityRoutingPatched) {
    const original = sheetProto.insertRule;
    sheetProto.insertRule = function patched(this: CSSStyleSheet, rule: string, index?: number) {
      try {
        return original.call(this, rule, index);
      } catch {
        try {
          return original.call(this, ".pap16302-noop{}", index);
        } catch {
          return this.cssRules?.length ?? 0;
        }
      }
    };
    sheetProto.__papActivityRoutingPatched = true;
  }
});

// Real Layout renders the full authenticated shell (sidebar, data queries).
// For routing we only need it to render its nested routes.
vi.mock("./components/Layout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { Layout: () => <Outlet /> };
});

vi.mock("./components/Layout.production", async () => {
  const { Outlet } = await import("react-router-dom");
  return { Layout: () => <Outlet /> };
});

// Rendered by <App> outside <Routes> and needs DialogProvider; irrelevant here.
vi.mock("./components/OnboardingWizardVariant", () => ({
  OnboardingWizardVariant: () => null,
}));

// Cloud access is unrelated to the route-table regression. Let it fall through
// synchronously so this test does not poll its query transitions.
vi.mock("./components/CloudAccessGate", async () => {
  const { Outlet } = await import("react-router-dom");
  return { CloudAccessGate: () => <Outlet /> };
});

// Sentinel page that also reports the resolved path + query, so we can assert
// the merged route *and* the preset mode a redirect carried into it.
vi.mock("./pages/audit/CompanyActivity", () => ({
  CompanyActivity: () => {
    const location = useLocation();
    return <div>{`ACTIVITY_PAGE@${location.pathname}${location.search}`}</div>;
  },
}));

vi.mock("./pages/audit/AuditHub", () => ({
  AuditHub: ({ section }: { section: string }) => {
    const location = useLocation();
    return <div>{`AUDIT_${section.toUpperCase()}@${location.pathname}${location.search}`}</div>;
  },
}));

vi.mock("./pages/Issues", () => ({
  Issues: () => {
    const location = useLocation();
    return <div>{`TASKS_PAGE@${location.pathname}`}</div>;
  },
}));

vi.mock("./pages/audit/CompanyActivity.production", () => ({
  CompanyActivity: () => {
    const location = useLocation();
    return <div>{`PRODUCTION_ACTIVITY@${location.pathname}${location.search}`}</div>;
  },
}));

vi.mock("./pages/Costs.production", () => ({
  Costs: () => {
    const location = useLocation();
    return <div>{`PRODUCTION_COSTS@${location.pathname}${location.search}`}</div>;
  },
}));

vi.mock("./pages/NotFound", () => ({
  NotFoundPage: () => <div>NOT_FOUND</div>,
}));

vi.mock("./pages/PluginPage", () => ({
  PluginPage: () => <div>PRODUCTION_PLUGIN_FALLBACK</div>,
}));

vi.mock("./context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Paperclip", issuePrefix: "PAP" },
    loading: false,
    error: null,
    reload: async () => undefined,
  }),
  OrganizationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function renderAppAt(container: HTMLElement, path: string) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
  });
  return root;
}

/**
 * Waits on the condition, not on a fixed number of turns. The previous version
 * yielded at most five macrotasks before asserting, which is ample on an idle
 * machine and not when the suite is running many workers in parallel — the
 * container was still empty and the assertion failed on a route that resolves
 * perfectly well. `vi.waitFor` retries against a time budget instead, so a
 * loaded worker gets more turns rather than a failure.
 */
async function waitForRoute(container: HTMLElement, text: string) {
  await vi.waitFor(() => expect(container.textContent).toContain(text));
}

describe("App Activity routing (PAP-16302)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    streamlinedUiState.enabled = true;
    streamlinedUiState.loaded = true;
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("serves the merged Activity page at /activity", async () => {
    const root = renderAppAt(container, "/activity");
    await waitForRoute(container, "ACTIVITY_PAGE@/activity");
    flushSync(() => root.unmount());
  });

  it("serves organization and entity-scoped run history beneath Activity", async () => {
    const root = renderAppAt(
      container,
      "/activity/runs?entityType=routine&entityId=routine-1",
    );
    await waitForRoute(
      container,
      "AUDIT_RUNS@/activity/runs?entityType=routine&entityId=routine-1",
    );
    flushSync(() => root.unmount());
  });

  it("redirects /audit to Activity with the agent-actions mode preset", async () => {
    const root = renderAppAt(container, "/audit");
    await waitForRoute(container, "ACTIVITY_PAGE@/activity?mode=agents");
    flushSync(() => root.unmount());
  });

  it("serves each canonical Audit section under Activity", async () => {
    const root = renderAppAt(container, "/activity/runs?agentId=agent-1");
    await waitForRoute(container, "AUDIT_RUNS@/activity/runs?agentId=agent-1");
    flushSync(() => root.unmount());
  });

  it("redirects legacy costs and preserves its deep-link filters", async () => {
    const root = renderAppAt(container, "/costs?range=30d#usage");
    await waitForRoute(container, "AUDIT_COSTS@/activity/costs?range=30d");
    flushSync(() => root.unmount());
  });

  it("redirects legacy Audit sections to their canonical destination", async () => {
    const root = renderAppAt(container, "/audit/budgets?projectId=project-1");
    await waitForRoute(
      container,
      "AUDIT_BUDGETS@/activity/budgets?projectId=project-1",
    );
    flushSync(() => root.unmount());
  });

  it("redirects the /tasks post-login target to the real task list", async () => {
    const root = renderAppAt(container, "/tasks");
    await waitForRoute(container, "TASKS_PAGE@/issues");
    expect(container.textContent).not.toContain("/tasks/dashboard");
    flushSync(() => root.unmount());
  });

  it("redirects a legacy section to the Audit hub", async () => {
    const root = renderAppAt(container, "/runs?runStatus=succeeded");
    await waitForRoute(container, "AUDIT_RUNS@/activity/runs?runStatus=succeeded");
    flushSync(() => root.unmount());
  });

  it("uses the production Activity and Costs routes when Streamlined UI is disabled", async () => {
    streamlinedUiState.enabled = false;
    const activityRoot = renderAppAt(container, "/activity");
    await waitForRoute(container, "PRODUCTION_ACTIVITY@/activity");
    flushSync(() => activityRoot.unmount());

    const costsRoot = renderAppAt(container, "/costs?range=30d");
    await waitForRoute(container, "PRODUCTION_COSTS@/costs?range=30d");
    flushSync(() => costsRoot.unmount());
  });

  it("omits streamlined-only Audit routes when Streamlined UI is disabled", async () => {
    streamlinedUiState.enabled = false;
    const root = renderAppAt(container, "/activity/runs");
    await waitForRoute(container, "PRODUCTION_PLUGIN_FALLBACK");
    expect(container.textContent).not.toContain("AUDIT_RUNS");
    flushSync(() => root.unmount());
  });

  it("does not mount streamlined routes before the experiment setting loads", async () => {
    streamlinedUiState.loaded = false;
    const root = renderAppAt(container, "/activity");
    expect(container.textContent).not.toContain("ACTIVITY_PAGE");
    expect(container.textContent).not.toContain("PRODUCTION_ACTIVITY");

    streamlinedUiState.enabled = false;
    streamlinedUiState.loaded = true;
    flushSync(() => {
      root.render(
        <MemoryRouter initialEntries={["/activity"]}>
          <App />
        </MemoryRouter>,
      );
    });
    await waitForRoute(container, "PRODUCTION_ACTIVITY@/activity");
    flushSync(() => root.unmount());
  });
});
