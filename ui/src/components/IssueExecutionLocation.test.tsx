// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Machine, WorkContextState } from "@paperclipai/shared";
import { IssueExecutionLocation } from "./IssueExecutionLocation";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  setLocation: vi.fn(),
  run: vi.fn(),
  handoff: vi.fn(),
  sync: vi.fn(),
  getCurrentBoardAccess: vi.fn(),
}));
vi.mock("@/api/machines", () => ({
  machinesApi: { list: mocks.list },
  workContextsApi: { get: mocks.get, setLocation: mocks.setLocation, run: mocks.run, handoff: mocks.handoff, sync: mocks.sync },
}));
vi.mock("@/api/access", () => ({ accessApi: { getCurrentBoardAccess: mocks.getCurrentBoardAccess } }));

const ISSUE_ID = "11111111-1111-4111-8111-111111111111";

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: "m-1",
    name: "Studio Mac",
    ownerUserId: "user-1",
    shared: false,
    status: "authorized",
    platform: "darwin",
    arch: "arm64",
    hostname: null,
    daemonVersion: null,
    capabilities: null,
    workspaceRoot: null,
    environmentId: null,
    connected: true,
    lastSeenAt: null,
    authorizedAt: null,
    revokedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function state(overrides: Partial<WorkContextState> = {}): WorkContextState {
  return { context: null, machine: null, run: null, pendingRuntimeRequestCount: 0, pendingInteractionCount: 0, ...overrides };
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function render(hasAssignee = true, issueStatus = "todo") {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <IssueExecutionLocation issueId={ISSUE_ID} issueStatus={issueStatus} hasAssignee={hasAssignee} />
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
  return [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.includes(text) || element.getAttribute("aria-label")?.includes(text),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.list.mockResolvedValue([machine()]);
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

describe("IssueExecutionLocation", () => {
  it("runs on the server by default", async () => {
    mocks.get.mockResolvedValue(state());
    mocks.run.mockResolvedValue({ runId: "r-1", state: state() });
    await render();
    await eventually(() => {
      expect(container.querySelector('[data-testid="execution-location-trigger"]')?.textContent).toContain("Server");
      expect(button("Run on")).toBeDefined();
    });
    await act(async () => button("Run on")!.click());
    await eventually(() => expect(mocks.run).toHaveBeenCalledWith(ISSUE_ID, { kind: "server" }));
  });

  it("keeps an offline machine selected and says the work waits there", async () => {
    const offline = machine({ connected: false });
    mocks.list.mockResolvedValue([offline]);
    mocks.get.mockResolvedValue(
      state({ context: { machineId: "m-1" } as WorkContextState["context"], machine: offline }),
    );
    await render();
    await eventually(() => {
      expect(container.querySelector('[data-testid="execution-location-trigger"]')?.textContent).toContain("Studio Mac");
      expect(container.textContent).toContain(
        "Studio Mac is offline — work stays on this machine until it reconnects or you move it.",
      );
    });
  });

  it("locks the location while a run is active and shows pending permission requests", async () => {
    mocks.get.mockResolvedValue(
      state({
        context: { machineId: "m-1", editLocked: true } as WorkContextState["context"],
        machine: machine(),
        run: { id: "r-1", status: "running", agentId: "a-1", executionMachineId: "m-1", startedAt: null },
        pendingRuntimeRequestCount: 2,
      }),
    );
    await render();
    await eventually(() => {
      expect(container.textContent).toContain("Run running on Studio Mac");
      expect(container.textContent).toContain("Edits locked");
      expect(container.textContent).toContain("2 permission requests pending");
      expect(button("Run on")).toBeUndefined();
      expect(button("Move work to")).toBeUndefined();
    });
  });

  it("names another user's machine the task already runs on", async () => {
    const foreign = machine({ id: "m-9", name: "Teammate box", ownerUserId: "user-2" });
    mocks.get.mockResolvedValue(
      state({ context: { machineId: "m-9" } as WorkContextState["context"], machine: foreign }),
    );
    await render();
    await eventually(() =>
      expect(container.querySelector('[data-testid="execution-location-trigger"]')?.textContent).toContain("Teammate box"),
    );
  });

  it("surfaces run errors", async () => {
    mocks.get.mockResolvedValue(state());
    mocks.run.mockRejectedValue(new Error("The issue has no assigned agent to run"));
    await render();
    await eventually(() => expect(button("Run on")).toBeDefined());
    await act(async () => button("Run on")!.click());
    await eventually(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toBe("The issue has no assigned agent to run"),
    );
  });

  it("keeps the synced state out of the panel and syncs on demand", async () => {
    const synced = state({
      context: { machineId: "m-1", syncState: "up_to_date", lastSnapshotSeq: 3 } as WorkContextState["context"],
      machine: machine(),
    });
    mocks.get.mockResolvedValue(synced);
    mocks.sync.mockResolvedValue({ state: synced });
    await render();
    await eventually(() => expect(button("Sync now · last snapshot 3")).toBeDefined());
    expect(container.textContent).not.toContain("snapshot 3");
    await act(async () => button("Sync now")!.click());
    await eventually(() => expect(mocks.sync).toHaveBeenCalledWith(ISSUE_ID));
  });

  it("shows a sync in progress and blocks location changes until it ends", async () => {
    mocks.get.mockResolvedValue(
      state({
        context: { machineId: "m-1", syncState: "syncing", lastSnapshotSeq: 3 } as WorkContextState["context"],
        machine: machine(),
      }),
    );
    await render();
    await eventually(() =>
      expect(container.querySelector('[role="status"]')?.textContent).toContain("Syncing files with Studio Mac"),
    );
    await act(async () => button("Studio Mac")!.click());
    await eventually(() => expect(document.body.textContent).not.toContain("online"));
  });

  it("lists the server and usable machines in the picker", async () => {
    mocks.get.mockResolvedValue(state());
    mocks.setLocation.mockResolvedValue(state());
    await render();
    await eventually(() => expect(button("Server")).toBeDefined());
    await act(async () => button("Server")!.click());
    await eventually(() => expect(document.body.textContent).toContain("online"));
    const option = [...document.body.querySelectorAll("button")].find((el) => el.textContent?.includes("Studio Mac"));
    await act(async () => option!.click());
    await eventually(() =>
      expect(mocks.setLocation).toHaveBeenCalledWith(ISSUE_ID, { kind: "machine", machineId: "m-1" }),
    );
  });

  it("shows a sync conflict with the paths the server reported", async () => {
    mocks.get.mockResolvedValue(
      state({
        context: {
          machineId: "m-1",
          syncState: "conflict",
          syncError: "local changes: notes.txt",
          lastSnapshotSeq: 3,
        } as WorkContextState["context"],
        machine: machine(),
      }),
    );
    await render();
    await eventually(() => expect(container.textContent).toContain("Sync conflict: local changes: notes.txt"));
  });

  it("does not offer a run on a done or cancelled issue", async () => {
    mocks.get.mockResolvedValue(state());
    await render(true, "done");
    await eventually(() => expect(button("Server")).toBeDefined());
    expect(button("Run on")).toBeUndefined();
    await render(true, "cancelled");
    await eventually(() => expect(button("Run on")).toBeUndefined());
  });

  it("asks for an assignee instead of offering a run", async () => {
    mocks.get.mockResolvedValue(state());
    await render(false);
    await eventually(() => {
      expect(container.textContent).toContain("Assign an agent to run this task.");
      expect(button("Run on")).toBeUndefined();
    });
  });
});
