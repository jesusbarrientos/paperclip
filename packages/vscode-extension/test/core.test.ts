import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ApiError, normalizeServerUrl, PaperclipApi } from "../src/core/api-client.js";
import { waitForChallengeApproval, SignInError } from "../src/core/auth.js";
import { CommentThread } from "../src/core/chat-model.js";
import { ClientSessionHeartbeat } from "../src/core/client-session.js";
import { daemonActionFor, describeLocalMachine, pairInvocation, shellLine } from "../src/core/daemon.js";
import { buildLiveEventsUrl, LiveEventStream, type SocketLike } from "../src/core/live-events.js";
import { readLocalMachine } from "../src/core/machine-config.js";
import { requestChoices, RunTranscript } from "../src/core/transcript.js";
import {
  computeReadonlyGlobs,
  mergeReadonlyInclude,
  parseWorkspaceFile,
  planFolderSwitch,
  resolveContextFolders,
} from "../src/core/workspace-file.js";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("PaperclipApi", () => {
  it("sends the bearer token and surfaces the server error message", async () => {
    const fetch = vi.fn(async () => jsonResponse(409, { error: "A run is in progress" }));
    const api = new PaperclipApi({ serverUrl: "https://pc.example.com/", token: "pcb_x", fetch });
    const failure = await api.setExecutionLocation("i1", { kind: "server" }).catch((error) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.isConflict).toBe(true);
    expect(failure.message).toBe("A run is in progress");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://pc.example.com/api/issues/i1/execution-location");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer pcb_x");
  });

  it("rejects non-http server URLs", () => {
    expect(() => normalizeServerUrl("ftp://host")).toThrow();
  });
});

describe("waitForChallengeApproval", () => {
  const challenge = {
    id: "c1",
    token: "t",
    boardApiToken: "pcb_board",
    approvalPath: "/cli-auth/c1",
    approvalUrl: null,
    pollPath: "/cli-auth/challenges/c1",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    suggestedPollIntervalMs: 500,
  };

  it("returns the board key once approved", async () => {
    const statuses = ["pending", "approved"];
    const fetch = vi.fn(async () => jsonResponse(200, { status: statuses.shift() }));
    const token = await waitForChallengeApproval({ fetch, serverUrl: "http://pc", challenge, sleep: async () => {} });
    expect(token).toBe("pcb_board");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("stops when the challenge is cancelled", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { status: "cancelled" }));
    await expect(
      waitForChallengeApproval({ fetch, serverUrl: "http://pc", challenge, sleep: async () => {} }),
    ).rejects.toBeInstanceOf(SignInError);
  });
});

describe("CommentThread", () => {
  it("replaces the optimistic comment with the server copy by clientRequestId", () => {
    const thread = new CommentThread(() => "Agent");
    thread.addPending("req-1", "hola");
    expect(thread.messages()).toMatchObject([{ pending: true, body: "hola" }]);
    thread.upsert([
      {
        id: "c1",
        issueId: "i1",
        clientRequestId: "req-1",
        authorType: "user",
        authorAgentId: null,
        authorUserId: "u1",
        body: "hola",
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(thread.messages()).toHaveLength(1);
    expect(thread.messages()[0]).toMatchObject({ id: "c1", pending: false });
  });
});

describe("ClientSessionHeartbeat", () => {
  it("beats on start and on every interval, then closes the session", async () => {
    let tick: (() => void) | null = null;
    const api = {
      touchClientSession: vi.fn(async () => ({ ok: true })),
      closeClientSession: vi.fn(async () => ({ pausedIssueIds: ["i1"] })),
    };
    const heartbeat = new ClientSessionHeartbeat({
      api,
      clientSessionId: "s1",
      setTimer: (fn) => {
        tick = fn;
        return 1;
      },
      clearTimer: () => {
        tick = null;
      },
    });
    heartbeat.start();
    tick!();
    expect(api.touchClientSession).toHaveBeenCalledTimes(2);
    await expect(heartbeat.close()).resolves.toEqual(["i1"]);
    expect(tick).toBeNull();
    expect(heartbeat.running).toBe(false);
  });

  it("reports network errors without throwing", async () => {
    const onError = vi.fn();
    const heartbeat = new ClientSessionHeartbeat({
      api: {
        touchClientSession: vi.fn(async () => {
          throw new Error("offline");
        }),
        closeClientSession: vi.fn(),
      },
      clientSessionId: "s1",
      onError,
    });
    await heartbeat.beat();
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe("daemon helpers", () => {
  const local = {
    machineId: "m1",
    serverUrl: "https://pc.example.com",
    name: "mac",
    workspaceRoot: null,
    paired: true,
    configPath: "/x",
  };

  it("asks to pair when the machine is paired with another server", () => {
    const state = describeLocalMachine(local, "https://other.example.com");
    expect(state.kind).toBe("other_server");
    expect(daemonActionFor(state, null)).toBe("pair");
  });

  it("starts the daemon only when the server does not see it connected", () => {
    const state = describeLocalMachine(local, "https://pc.example.com/");
    expect(daemonActionFor(state, { connected: false, status: "authorized" })).toBe("start");
    expect(daemonActionFor(state, { connected: true, status: "authorized" })).toBe("none");
    expect(daemonActionFor(state, { connected: false, status: "revoked" })).toBe("pair");
  });

  it("quotes arguments for the terminal", () => {
    expect(shellLine(pairInvocation("/opt/my tools/paperclipai", "https://pc", "Jesús's Mac"), "darwin")).toBe(
      "'/opt/my tools/paperclipai' machine pair --server https://pc --name 'Jesús'\\''s Mac'",
    );
  });
});

describe("readLocalMachine", () => {
  it("reads public fields and never exposes the credential", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pc-vscode-"));
    const file = path.join(dir, "config.json");
    fs.writeFileSync(file, JSON.stringify({ machineId: "m1", serverUrl: "http://pc", credential: "pcm_secret" }));
    const machine = readLocalMachine(file);
    expect(machine).toMatchObject({ machineId: "m1", paired: true });
    expect(JSON.stringify(machine)).not.toContain("pcm_secret");
    expect(readLocalMachine(path.join(dir, "missing.json"))).toBeNull();
  });
});

describe("live events", () => {
  it("only sends afterSeq for run subscriptions", () => {
    expect(buildLiveEventsUrl("https://pc", { issueId: "i1" }, 5)).toBe("wss://pc/api/events/ws?issueId=i1");
    expect(buildLiveEventsUrl("http://pc", { runId: "r1" }, 5)).toBe("ws://pc/api/events/ws?runId=r1&afterSeq=5");
  });

  it("resumes a run subscription from the last delivered seq and drops duplicates", () => {
    const sockets: { url: string; handlers: Record<string, (value?: unknown) => void> }[] = [];
    const timers: (() => void)[] = [];
    const events: unknown[] = [];
    const stream = new LiveEventStream({
      serverUrl: "http://pc",
      token: "pcb",
      filter: { runId: "r1" },
      afterSeq: 0,
      onEvent: (event) => events.push(event),
      setTimer: (fn) => timers.push(fn),
      clearTimer: () => {},
      createSocket: (url) => {
        const handlers: Record<string, (value?: unknown) => void> = {};
        sockets.push({ url, handlers });
        const socket: SocketLike = {
          on: (event: string, listener: (value?: unknown) => void) => {
            handlers[event] = listener;
            return socket;
          },
          close: () => {},
        } as SocketLike;
        return socket;
      },
    });
    stream.start();
    const frame = (seq: number) => JSON.stringify({ id: 0, type: "heartbeat.run.event", payload: { runId: "r1", seq } });
    sockets[0]!.handlers.message!(frame(1));
    sockets[0]!.handlers.message!(frame(2));
    sockets[0]!.handlers.close!(1006);
    timers.shift()!();
    expect(sockets[1]!.url).toContain("afterSeq=2");
    sockets[1]!.handlers.message!(frame(2));
    sockets[1]!.handlers.message!(frame(3));
    expect(events).toHaveLength(3);
    stream.stop();
  });
});

describe("RunTranscript", () => {
  const prp = (seq: number, eventType: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    runId: "r1",
    seq,
    eventType: "prp",
    payload: { prpEvent: { eventType, payload, ...extra } },
  });

  it("streams assistant text and ignores replayed seqs", () => {
    const transcript = new RunTranscript("r1");
    transcript.apply(prp(1, "item.delta", { item: { id: "a", kind: "agent_message" }, text: "Ho" }));
    transcript.apply(prp(2, "item.delta", { item: { id: "a", kind: "agent_message" }, text: "la" }));
    expect(transcript.apply(prp(2, "item.delta", { item: { id: "a", kind: "agent_message" }, text: "la" }))).toBe(false);
    expect(transcript.snapshot().entries).toMatchObject([{ kind: "assistant", text: "Hola", streaming: true }]);
  });

  it("keeps a resolved request resolved when a later delivery receipt arrives", () => {
    const transcript = new RunTranscript("r1");
    transcript.apply(prp(1, "runtime_request.created", { request: { requestId: "q1", prompt: "Run rm?" } }));
    expect(requestChoices(transcript.pendingRequests()[0]!)).toEqual([
      { key: "accept", label: "Approve" },
      { key: "decline", label: "Deny" },
    ]);
    transcript.apply(prp(2, "runtime_request.resolved", { request: { requestId: "q1", action: "accept" } }));
    transcript.apply(prp(3, "runtime_request.delivered", { request: { requestId: "q1" } }));
    expect(transcript.pendingRequests()).toHaveLength(0);
  });

  it("expires pending requests when the run ends", () => {
    const transcript = new RunTranscript("r1");
    transcript.apply(prp(1, "runtime_request.created", { request: { requestId: "q1" } }));
    transcript.setRunStatus("cancelled", "Interrupted");
    expect(transcript.snapshot().entries).toMatchObject([
      { kind: "request", status: "expired" },
      { kind: "error", text: "Interrupted" },
    ]);
  });
});

describe("workspace file", () => {
  it("parses JSONC workspace files", () => {
    const file = parseWorkspaceFile('{\n // comment\n "folders": [{ "path": "/a", },],\n}');
    expect(file.folders).toEqual([{ path: "/a" }]);
  });

  it("never touches folder 0 when switching", () => {
    expect(planFolderSwitch(["/control", "/old"], [{ path: "/new" }])).toEqual({
      start: 1,
      deleteCount: 1,
      add: [{ path: "/new" }],
    });
    expect(planFolderSwitch(["/control", "/same"], [{ path: "/same" }])).toBeNull();
  });

  it("keeps the user's own read-only globs when the lock changes", () => {
    const managed = computeReadonlyGlobs(["/w/issues/a [1]"], "darwin");
    expect(managed).toEqual(["/w/issues/a [[]1[]]/**"]);
    const locked = mergeReadonlyInclude({ "/mine/**": true }, [], managed);
    expect(locked).toEqual({ "/mine/**": true, [managed[0]!]: true });
    expect(mergeReadonlyInclude(locked, managed, [])).toEqual({ "/mine/**": true });
  });

  it("finds one worktree per repository under the context path", () => {
    const tree: Record<string, string[] | "file"> = {
      "/ctx": ["api", "web", ".cache"],
      "/ctx/api": [".git"],
      "/ctx/web": [".git"],
      "/ctx/api/.git": "file",
      "/ctx/web/.git": "file",
      "/ctx/.cache": [],
    };
    const reader = {
      exists: (target: string) => target in tree,
      isDirectory: (target: string) => Array.isArray(tree[target]),
      list: (target: string) => (tree[target] as string[]) ?? [],
    };
    expect(resolveContextFolders("/ctx", reader)).toEqual(["/ctx/api", "/ctx/web"]);
    expect(resolveContextFolders(null, reader)).toEqual([]);
  });
});
