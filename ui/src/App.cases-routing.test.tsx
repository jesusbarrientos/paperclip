// @vitest-environment jsdom

// Regression guard for PAP-13002: the experimental Cases UI links to `/cases`
// and `/cases/:id`. This drives the real <App> route table so removing either
// registration fails loudly instead of falling through to the plugin route.

import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// jsdom's CSS parser rejects the custom-property marker rule stitches inserts
// (`--sxs{--sxs:N}`), pulled into <App>'s eager import graph transitively via
// @codesandbox/sandpack-react. Substitute a benign, valid rule on parse failure
// so stitches' index bookkeeping stays intact and the module graph evaluates.
// (sandpack itself is never exercised by the routing under test.)
vi.hoisted(() => {
  const sheetProto = window.CSSStyleSheet.prototype as unknown as {
    insertRule: (rule: string, index?: number) => number;
    __pap13002Patched?: boolean;
  };
  if (!sheetProto.__pap13002Patched) {
    const original = sheetProto.insertRule;
    sheetProto.insertRule = function patched(this: CSSStyleSheet, rule: string, index?: number) {
      try {
        return original.call(this, rule, index);
      } catch {
        try {
          return original.call(this, ".pap13002-noop{}", index);
        } catch {
          return this.cssRules?.length ?? 0;
        }
      }
    };
    sheetProto.__pap13002Patched = true;
  }
});

// Real Layout renders the full authenticated shell (sidebar, data queries).
// For routing we only need it to render its nested routes.
vi.mock("./components/Layout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { Layout: () => <Outlet /> };
});

// The experimental gate would otherwise hide the page behind a feature flag.
vi.mock("./components/CasesExperimentalGate", () => ({
  CasesExperimentalGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Rendered by <App> outside <Routes> and needs DialogProvider; irrelevant here.
vi.mock("./components/OnboardingWizardVariant", () => ({
  OnboardingWizardVariant: () => null,
}));

// Sentinel pages so we can assert *which* route resolved.
vi.mock("./pages/Cases", () => ({ Cases: () => <div>CASES_LIST_PAGE</div> }));
vi.mock("./pages/CaseDetail", () => ({ CaseDetail: () => <div>CASE_DETAIL_PAGE</div> }));

// Cloud access is unrelated to the route-table regression. Let it fall through
// synchronously so this test does not poll its three query transitions.
vi.mock("./components/CloudAccessGate", async () => {
  const { Outlet } = await import("react-router-dom");
  return { CloudAccessGate: () => <Outlet /> };
});

vi.mock("./context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Paperclip", issuePrefix: "PAP" },
    loading: false,
    error: null,
    reload: async () => undefined,
  }),
  OrganizationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function renderAppAt(container: HTMLElement, path: string) {
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
 * yielded at most three macrotasks before asserting, which is ample on an idle
 * machine and not when the suite is running many workers in parallel — the
 * container was still empty and the assertion failed on a route that resolves
 * perfectly well. `vi.waitFor` retries against a time budget instead, so a
 * loaded worker gets more turns rather than a failure.
 *
 * The same fix #11499 applied to the sibling `App.activity-routing.test.tsx`,
 * which had the identical loop with five turns instead of three.
 */
async function waitForRoute(container: HTMLElement, text: string) {
  await vi.waitFor(() => expect(container.textContent).toContain(text));
}

describe("App Cases routing (PAP-13002)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("serves /cases as the list page", async () => {
    const root = await renderAppAt(container, "/cases");
    await waitForRoute(container, "CASES_LIST_PAGE");
    flushSync(() => root.unmount());
  });

  it("serves /cases/:id as the detail page", async () => {
    const root = await renderAppAt(container, "/cases/PAP-C5");
    await waitForRoute(container, "CASE_DETAIL_PAGE");
    flushSync(() => root.unmount());
  });
});
