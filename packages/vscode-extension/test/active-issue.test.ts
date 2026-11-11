import { describe, expect, it, vi } from "vitest";
import { ActiveIssue } from "../src/core/active-issue.js";
import { ApiError, type PaperclipApi } from "../src/core/api-client.js";
import type { SocketLike } from "../src/core/live-events.js";

const issue = {
  id: "i1",
  identifier: "PAP-1",
  title: "Fix it",
  status: "in_progress",
  projectId: null,
  assigneeAgentId: "a1",
  assigneeUserId: null,
};

function stateWithRun(status: string | null) {
  return {
    context: null,
    machine: null,
    run: status
      ? { id: "r1", status, agentId: "a1", executionMachineId: null, startedAt: null }
      : null,
    pendingRuntimeRequestCount: 0,
    pendingInteractionCount: 0,
  };
}

function setup(overrides: Partial<Record<keyof PaperclipApi, unknown>> = {}) {
  let handlers: Record<string, (value?: unknown) => void> = {};
  const api = {
    serverUrl: "http://pc",
    token: "pcb",
    getIssue: vi.fn(async () => issue),
    getWorkContext: vi.fn(async () => stateWithRun("running")),
    listComments: vi.fn(async () => []),
    listRunEvents: vi.fn(async () => []),
    getRun: vi.fn(async () => ({ id: "r1", agentId: "a1", status: "running" })),
    ...overrides,
  } as unknown as PaperclipApi;
  const onChange = vi.fn();
  const active = new ActiveIssue(issue, api, {
    agents: [{ id: "a1", name: "Builder" }],
    onChange,
    createSocket: () => {
      handlers = {};
      const socket = {
        on: (event: string, listener: (value?: unknown) => void) => {
          handlers[event] = listener;
          return socket;
        },
        close: () => {},
      } as unknown as SocketLike;
      return socket;
    },
  });
  const emit = (type: string, payload: Record<string, unknown>) =>
    handlers.message!(JSON.stringify({ id: 1, type, createdAt: "", payload }));
  return { api, active, emit, onChange };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ActiveIssue", () => {
  it("folds live run events into the transcript of the active run", async () => {
    const { active, emit } = setup();
    await active.start();
    emit("heartbeat.run.event", {
      runId: "r1",
      seq: 1,
      eventType: "prp",
      payload: { prpEvent: { eventType: "item.completed", payload: { item: { id: "m", kind: "agent_message", text: "Listo" } } } },
    });
    expect(active.snapshot().transcript?.entries).toMatchObject([{ kind: "assistant", text: "Listo" }]);
    active.dispose();
  });

  it("reloads comments when a comment activity arrives for the issue", async () => {
    const { api, active, emit } = setup();
    await active.start();
    vi.mocked(api.listComments).mockResolvedValueOnce([
      {
        id: "c1",
        issueId: "i1",
        authorType: "agent",
        authorAgentId: "a1",
        authorUserId: null,
        body: "Hecho",
        createdAt: new Date().toISOString(),
      },
    ]);
    emit("activity.logged", { action: "issue.comment_added", entityType: "issue", entityId: "i1" });
    await flush();
    expect(active.snapshot().messages).toMatchObject([{ authorLabel: "Builder", body: "Hecho" }]);
    active.dispose();
  });

  it("picks up the recovery hold the server sets after a run stops", async () => {
    const { api, active, emit } = setup();
    await active.start();
    const blocker = { runId: "r1", agentId: "a1", nextAction: "Inspect the run.", runError: "Cancelled", savedMessageCount: 1 };
    vi.mocked(api.getIssue).mockResolvedValueOnce({ ...issue, executionBlocker: blocker });
    emit("activity.logged", { action: "issue.execution_recovery_settled", entityType: "issue", entityId: "i1" });
    await flush();
    expect(active.snapshot().issue.executionBlocker).toEqual(blocker);
    active.dispose();
  });

  it("keeps showing interrupting until the server reports the run stopped", async () => {
    const cancelRun = vi.fn(async () => null);
    const { api, active } = setup({ cancelRun });
    await active.start();
    await active.interrupt();
    expect(cancelRun).toHaveBeenCalledWith("r1");
    expect(active.snapshot().interrupting).toBe(true);
    vi.mocked(api.getWorkContext).mockResolvedValueOnce(stateWithRun(null));
    await active.refreshAll();
    expect(active.snapshot().interrupting).toBe(false);
    active.dispose();
  });

  it("treats a 409 on resolve as another client having decided first", async () => {
    const resolveRuntimeRequest = vi.fn(async () => {
      throw new ApiError(409, "already resolved", null);
    });
    const { active, emit } = setup({ resolveRuntimeRequest });
    await active.start();
    emit("heartbeat.run.event", {
      runId: "r1",
      seq: 1,
      eventType: "prp",
      payload: { prpEvent: { eventType: "runtime_request.created", payload: { request: { requestId: "q1" } } } },
    });
    await active.resolveRequest("q1", "accept");
    expect(resolveRuntimeRequest).toHaveBeenCalledOnce();
    expect(active.snapshot().error).toBeNull();
    active.dispose();
  });
});
