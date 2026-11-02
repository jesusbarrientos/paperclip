import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { definePlugin } from "../src/define-plugin.js";
import {
  createRequest,
  createSuccessResponse,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcNotification,
  parseMessage,
  serializeMessage,
  type JsonRpcNotification,
  type JsonRpcResponse,
  type PluginInvocationContext,
} from "../src/protocol.js";
import { isWorkerEntrypoint, startWorkerRpcHost } from "../src/worker-rpc-host.js";

describe("isWorkerEntrypoint", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const tempRoot of tempRoots.splice(0)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  function createTempRoot(): string {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-sdk-worker-"));
    tempRoots.push(tempRoot);
    return tempRoot;
  }

  it("matches an entrypoint reached through a symlinked directory", () => {
    const tempRoot = createTempRoot();
    const realDir = path.join(tempRoot, "real");
    const linkDir = path.join(tempRoot, "link");
    fs.mkdirSync(realDir);
    fs.symlinkSync(realDir, linkDir, "dir");

    const workerPath = path.join(realDir, "worker.js");
    fs.writeFileSync(workerPath, "");

    expect(
      isWorkerEntrypoint(
        path.join(linkDir, "worker.js"),
        pathToFileURL(workerPath).toString(),
      ),
    ).toBe(true);
  });

  it("does not match a different entrypoint", () => {
    const tempRoot = createTempRoot();
    const workerPath = path.join(tempRoot, "worker.js");
    const otherPath = path.join(tempRoot, "other.js");
    fs.writeFileSync(workerPath, "");
    fs.writeFileSync(otherPath, "");

    expect(
      isWorkerEntrypoint(
        otherPath,
        pathToFileURL(workerPath).toString(),
      ),
    ).toBe(false);
  });
});

describe("worker performAction context", () => {
  it("defaults the actor to system without host actor context", async () => {
    const hostToWorker = new PassThrough();
    const workerToHost = new PassThrough();
    const hostReadline = createInterface({ input: workerToHost });
    const pending = new Map<string, (response: JsonRpcResponse) => void>();
    let nextRequestId = 1;
    const plugin = definePlugin({
      async setup(ctx) {
        ctx.actions.register("inspect", async (_params, context) => ({
          actor: context.actor
        }));
      },
    });
    const worker = startWorkerRpcHost({
      plugin,
      stdin: hostToWorker,
      stdout: workerToHost,
    });

    function callWorker(method: string, params: unknown) {
      const id = `host-${nextRequestId++}`;
      const result = new Promise<unknown>((resolve, reject) => {
        pending.set(id, (response) => {
          if ("error" in response && response.error) {
            reject(new Error(response.error.message));
            return;
          }
          resolve((response as { result?: unknown }).result);
        });
      });
      hostToWorker.write(serializeMessage(createRequest(method, params, id)));
      return result;
    }

    hostReadline.on("line", (line) => {
      const message = parseMessage(line);
      if (!isJsonRpcResponse(message)) return;
      pending.get(String(message.id))?.(message);
      pending.delete(String(message.id));
    });

    try {
      await expect(callWorker("initialize", {
        manifest: {
          id: "paperclip.test-worker-context",
          apiVersion: 1,
          version: "1.0.0",
          displayName: "Worker Context Test",
          description: "Test plugin",
          author: "Paperclip",
          categories: ["automation"],
          capabilities: [],
          entrypoints: {},
        },
        config: {},
        databaseNamespace: null,
      })).resolves.toMatchObject({ ok: true });

      await expect(callWorker("performAction", {
        key: "inspect",
        params: {},
      })).resolves.toEqual({
        actor: {
          type: "system",
          userId: null,
          agentId: null,
          runId: null
        }
      });
    } finally {
      worker.stop();
      hostReadline.close();
      hostToWorker.destroy();
      workerToHost.destroy();
    }
  });
});

describe("worker invocation propagation", () => {
  it("keeps overlapping invocation ids local to each getData invocation", async () => {
    const hostToWorker = new PassThrough();
    const workerToHost = new PassThrough();
    const hostReadline = createInterface({ input: workerToHost });
    const pending = new Map<string, (response: JsonRpcResponse) => void>();
    const nestedInvocationIds: string[] = [];
    let releaseA: (() => void) | null = null;
    let nextRequestId = 1;

    const plugin = definePlugin({
      async setup(ctx) {
        ctx.data.register("probe", async (params) => {
          if (params.label === "a") {
            await new Promise<void>((resolve) => {
              releaseA = resolve;
            });
          }
          const config = await ctx.config.get();
          return { label: params.label, config };
        });
      },
    });

    const worker = startWorkerRpcHost({
      plugin,
      stdin: hostToWorker,
      stdout: workerToHost,
    });

    function callWorker(method: string, params: unknown, invocation?: PluginInvocationContext) {
      const id = `host-${nextRequestId++}`;
      const request = {
        ...createRequest(method, params, id),
        ...(invocation ? { paperclipInvocation: invocation } : {}),
      };
      const result = new Promise<unknown>((resolve, reject) => {
        pending.set(id, (response) => {
          if ("error" in response && response.error) {
            reject(new Error(response.error.message));
            return;
          }
          resolve((response as { result?: unknown }).result);
        });
      });
      hostToWorker.write(serializeMessage(request));
      return result;
    }

    hostReadline.on("line", (line) => {
      const message = parseMessage(line);
      if (isJsonRpcResponse(message)) {
        pending.get(String(message.id))?.(message);
        pending.delete(String(message.id));
        return;
      }

      if (!isJsonRpcRequest(message)) return;
      if (message.method !== "config.get") return;

      const invocationId = (message as { paperclipInvocationId?: string }).paperclipInvocationId ?? "";
      nestedInvocationIds.push(invocationId);
      hostToWorker.write(serializeMessage(createSuccessResponse(message.id, {
        invocationId,
      })));

      if (invocationId === "invocation-b") {
        releaseA?.();
      }
    });

    try {
      await callWorker("initialize", {
        manifest: {
          id: "paperclip.scope-test",
          apiVersion: 1,
          version: "1.0.0",
          displayName: "Scope test",
          description: "Scope test",
          author: "Paperclip",
          categories: ["automation"],
          capabilities: [],
          entrypoints: { worker: "dist/worker.js" },
        },
        config: {},
        instanceInfo: { instanceId: "test", hostVersion: "0.0.0" },
        apiVersion: 1,
      });

      const requestA = callWorker(
        "getData",
        { key: "probe", params: { label: "a" } },
        { id: "invocation-a" },
      );
      const requestB = callWorker(
        "getData",
        { key: "probe", params: { label: "b" } },
        { id: "invocation-b" },
      );

      await expect(requestB).resolves.toEqual({
        label: "b",
        config: { invocationId: "invocation-b" },
      });
      await expect(requestA).resolves.toEqual({
        label: "a",
        config: { invocationId: "invocation-a" },
      });

      expect(nestedInvocationIds).toEqual(["invocation-b", "invocation-a"]);
    } finally {
      worker.stop();
      hostReadline.close();
      hostToWorker.destroy();
      workerToHost.destroy();
    }
  });
});

describe("worker configChanged", () => {
  // Spin up a worker-rpc-host wired to in-memory streams and expose a
  // request/response `callWorker` plus `initialize`/`stop` helpers.
  function makeWorker(plugin: ReturnType<typeof definePlugin>) {
    const hostToWorker = new PassThrough();
    const workerToHost = new PassThrough();
    const hostReadline = createInterface({ input: workerToHost });
    const pending = new Map<string, (response: JsonRpcResponse) => void>();
    let nextRequestId = 1;

    const worker = startWorkerRpcHost({
      plugin,
      stdin: hostToWorker,
      stdout: workerToHost,
    });

    function callWorker(method: string, params: unknown) {
      const id = `host-${nextRequestId++}`;
      const result = new Promise<unknown>((resolve, reject) => {
        pending.set(id, (response) => {
          if ("error" in response && response.error) {
            reject(
              Object.assign(new Error(response.error.message), {
                code: response.error.code,
              }),
            );
            return;
          }
          resolve((response as { result?: unknown }).result);
        });
      });
      hostToWorker.write(serializeMessage(createRequest(method, params, id)));
      return result;
    }

    hostReadline.on("line", (line) => {
      const message = parseMessage(line);
      if (!isJsonRpcResponse(message)) return;
      pending.get(String(message.id))?.(message);
      pending.delete(String(message.id));
    });

    async function initialize() {
      return await callWorker("initialize", {
        manifest: {
          id: "paperclip.config-guard-test",
          apiVersion: 1,
          version: "1.0.0",
          displayName: "Config Guard Test",
          description: "Test plugin",
          author: "Paperclip",
          categories: ["automation"],
          capabilities: [],
          entrypoints: {},
        },
        config: {},
        databaseNamespace: null,
      });
    }

    function stop() {
      worker.stop();
      hostReadline.close();
      hostToWorker.destroy();
      workerToHost.destroy();
    }

    return { callWorker, initialize, stop };
  }

  it.each([false, true])("advertises and dispatches stop-only only with an explicit hook: %s", async supported => {
    let releases = 0, stops = 0;
    const worker = makeWorker(definePlugin({ async setup() {},
      async onEnvironmentReleaseLease() { releases++; return { providerLeaseId: "allocation", state: "destroyed" }; },
      ...(supported ? { async onEnvironmentStopLease() { stops++; return { providerLeaseId: "allocation", state: "stopped" as const }; } } : {}),
    }));
    try {
      const initialized = await worker.initialize() as { supportedMethods: string[] };
      expect(initialized.supportedMethods.includes("environmentStopLease")).toBe(supported);
      const stopped = worker.callWorker("environmentStopLease", { driverKey: "fixture", environmentId: "environment", providerLeaseId: "allocation", config: {} });
      if (supported) await expect(stopped).resolves.toEqual({ providerLeaseId: "allocation", state: "stopped" });
      else await expect(stopped).rejects.toThrow();
      expect(stops).toBe(supported ? 1 : 0);
      expect(releases).toBe(0);
    } finally { worker.stop(); }
  });

  it("delivers every configChanged update to onConfigChanged", async () => {
    const applied: Array<{ token: unknown }> = [];
    const plugin = definePlugin({
      async setup() {},
      async onConfigChanged(newConfig) {
        applied.push({
          token: newConfig.slackBotToken,
        });
      },
    });
    const { callWorker, initialize, stop } = makeWorker(plugin);

    try {
      await initialize();

      await callWorker("configChanged", {
        config: { slackBotToken: "xoxb-A" }
      });
      await expect(
        callWorker("configChanged", {
          config: { slackBotToken: "xoxb-B" }
        }),
      ).resolves.toBeNull();

      expect(applied).toEqual([
        { token: "xoxb-A" },
        { token: "xoxb-B" },
      ]);
    } finally {
      stop();
    }
  });
});

describe("worker provider tracer", () => {
  it("default plugin tracer is a no-op that starts and ends a span without throwing", async () => {
    const { NOOP_PLUGIN_TRACER } = await import("../src/types.js");
    const span = NOOP_PLUGIN_TRACER.startSpan("pack", { attributes: { a: 1 } });
    expect(() => {
      span.setAttribute("b", 2);
      span.setStatus({ code: 1 });
      span.end();
    }).not.toThrow();
  });

  // Drive a plugin data handler that opens a provider span, and capture the
  // worker→host traffic. The host injects a `traceparent` on the invocation, so
  // the worker must emit one `span.record` request that echoes the invocation id
  // and carries the span name and attributes.
  async function runSpanProbe(invocation: PluginInvocationContext) {
    const hostToWorker = new PassThrough();
    const workerToHost = new PassThrough();
    const hostReadline = createInterface({ input: workerToHost });
    const pending = new Map<string, (response: JsonRpcResponse) => void>();
    const spanRecords: Array<{ params: unknown; invocationId?: string }> = [];
    let nextRequestId = 1;

    const plugin = definePlugin({
      async setup(ctx) {
        ctx.data.register("probe", async () => {
          const span = ctx.tracer.startSpan("pack", {
            attributes: { "paperclip.sandbox.startup.pack.wall_ms": 12 },
          });
          span.setAttribute("paperclip.sandbox.startup.provider", "daytona");
          span.end();
          return { ok: true };
        });
      },
    });

    const worker = startWorkerRpcHost({ plugin, stdin: hostToWorker, stdout: workerToHost });

    function callWorker(method: string, params: unknown, inv?: PluginInvocationContext) {
      const id = `host-${nextRequestId++}`;
      const request = {
        ...createRequest(method, params, id),
        ...(inv ? { paperclipInvocation: inv } : {}),
      };
      const result = new Promise<unknown>((resolve, reject) => {
        pending.set(id, (response) => {
          if ("error" in response && response.error) {
            reject(new Error(response.error.message));
            return;
          }
          resolve((response as { result?: unknown }).result);
        });
      });
      hostToWorker.write(serializeMessage(request));
      return result;
    }

    hostReadline.on("line", (line) => {
      const message = parseMessage(line);
      if (isJsonRpcResponse(message)) {
        pending.get(String(message.id))?.(message);
        pending.delete(String(message.id));
        return;
      }
      if (!isJsonRpcRequest(message)) return;
      if (message.method === "span.record") {
        spanRecords.push({
          params: message.params,
          invocationId: (message as { paperclipInvocationId?: string }).paperclipInvocationId,
        });
        hostToWorker.write(serializeMessage(createSuccessResponse(message.id, null)));
      }
    });

    try {
      await callWorker("initialize", {
        manifest: {
          id: "paperclip.tracer-test",
          apiVersion: 1,
          version: "1.0.0",
          displayName: "Tracer test",
          description: "Tracer test",
          author: "Paperclip",
          categories: ["automation"],
          capabilities: ["environment.drivers.register"],
          entrypoints: { worker: "dist/worker.js" },
        },
        config: {},
        instanceInfo: { instanceId: "test", hostVersion: "0.0.0" },
        apiVersion: 1,
      });
      await callWorker("getData", { key: "probe", params: {} }, invocation);
      // Let the fire-and-forget span.record flush.
      await new Promise((resolve) => setTimeout(resolve, 20));
      return spanRecords;
    } finally {
      worker.stop();
      hostReadline.close();
      hostToWorker.destroy();
      workerToHost.destroy();
    }
  }

  it("emits one span.record with the name and attributes when a host trace context is active", async () => {
    const spanRecords = await runSpanProbe({
      id: "invocation-a",
      traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    });
    expect(spanRecords).toHaveLength(1);
    const record = spanRecords[0]!;
    expect(record.invocationId).toBe("invocation-a");
    expect(record.params).toMatchObject({
      name: "pack",
      attributes: {
        "paperclip.sandbox.startup.pack.wall_ms": 12,
        "paperclip.sandbox.startup.provider": "daytona",
      },
    });
  });

  it("sends a finite startTimeMs and endTimeMs with endTimeMs >= startTimeMs", async () => {
    const spanRecords = await runSpanProbe({
      id: "invocation-a",
      traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    });
    expect(spanRecords).toHaveLength(1);
    const params = spanRecords[0]!.params as {
      startTimeMs?: number;
      endTimeMs?: number;
    };
    expect(Number.isFinite(params.startTimeMs)).toBe(true);
    expect(Number.isFinite(params.endTimeMs)).toBe(true);
    expect(params.endTimeMs!).toBeGreaterThanOrEqual(params.startTimeMs!);
  });

  it("emits no span.record when the invocation carries no traceparent (tracing off)", async () => {
    const spanRecords = await runSpanProbe({
      id: "invocation-a",
    });
    expect(spanRecords).toHaveLength(0);
  });
});

describe("worker execute.log emitter", () => {
  // Run one data handler that calls `ctx.execution.log`, and capture the
  // `execute.log` notifications the worker sends to the host.
  async function runExecuteLogProbe(
    invocation: PluginInvocationContext | undefined,
    entries: Array<{ stream: "stdout" | "stderr"; chunk: string }>,
  ) {
    const hostToWorker = new PassThrough();
    const workerToHost = new PassThrough();
    const hostReadline = createInterface({ input: workerToHost });
    const pending = new Map<string, (response: JsonRpcResponse) => void>();
    const logRecords: Array<{ params: unknown; invocationId?: string }> = [];
    let nextRequestId = 1;

    const plugin = definePlugin({
      async setup(ctx) {
        ctx.data.register("emit-logs", async () => {
          for (const entry of entries) {
            ctx.execution.log(entry.stream, entry.chunk);
          }
          return { ok: true };
        });
      },
    });

    const worker = startWorkerRpcHost({ plugin, stdin: hostToWorker, stdout: workerToHost });

    function callWorker(method: string, params: unknown, inv?: PluginInvocationContext) {
      const id = `host-${nextRequestId++}`;
      const request = {
        ...createRequest(method, params, id),
        ...(inv ? { paperclipInvocation: inv } : {}),
      };
      const result = new Promise<unknown>((resolve, reject) => {
        pending.set(id, (response) => {
          if ("error" in response && response.error) {
            reject(new Error(response.error.message));
            return;
          }
          resolve((response as { result?: unknown }).result);
        });
      });
      hostToWorker.write(serializeMessage(request));
      return result;
    }

    hostReadline.on("line", (line) => {
      const message = parseMessage(line);
      if (isJsonRpcResponse(message)) {
        pending.get(String(message.id))?.(message);
        pending.delete(String(message.id));
        return;
      }
      // `execute.log` is a fire-and-forget notification (no id), so it is not a
      // JSON-RPC request. Match on the method name directly.
      if ((message as { method?: string }).method === "execute.log") {
        logRecords.push({
          params: (message as { params?: unknown }).params,
          invocationId: (message as { paperclipInvocationId?: string }).paperclipInvocationId,
        });
      }
    });

    try {
      await callWorker("initialize", {
        manifest: {
          id: "paperclip.execute-log-test",
          apiVersion: 1,
          version: "1.0.0",
          displayName: "Execute log test",
          description: "Execute log test",
          author: "Paperclip",
          categories: ["automation"],
          capabilities: ["environment.drivers.register"],
          entrypoints: { worker: "dist/worker.js" },
        },
        config: {},
        instanceInfo: { instanceId: "test", hostVersion: "0.0.0" },
        apiVersion: 1,
      });
      await callWorker("getData", { key: "emit-logs", params: {} }, invocation);
      // Let the fire-and-forget execute.log notifications flush.
      await new Promise((resolve) => setTimeout(resolve, 20));
      return logRecords;
    } finally {
      worker.stop();
      hostReadline.close();
      hostToWorker.destroy();
      workerToHost.destroy();
    }
  }

  it("stamps the active invocation id on each execute.log notification", async () => {
    const records = await runExecuteLogProbe(
      { id: "invocation-a" },
      [
        { stream: "stdout", chunk: "one" },
        { stream: "stderr", chunk: "two" },
      ],
    );
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      params: { stream: "stdout", chunk: "one" },
      invocationId: "invocation-a",
    });
    expect(records[1]).toEqual({
      params: { stream: "stderr", chunk: "two" },
      invocationId: "invocation-a",
    });
  });

  it("drops an empty chunk before it reaches the host", async () => {
    const records = await runExecuteLogProbe(
      { id: "invocation-a" },
      [
        { stream: "stdout", chunk: "" },
        { stream: "stdout", chunk: "kept" },
      ],
    );
    expect(records).toEqual([
      { params: { stream: "stdout", chunk: "kept" }, invocationId: "invocation-a" },
    ]);
  });
});

describe("worker setup-token pseudo-terminal dispatch", () => {
  it("dispatches open, input, stop, and close, and streams output and exit as notifications", async () => {
    const hostToWorker = new PassThrough();
    const workerToHost = new PassThrough();
    const hostReadline = createInterface({ input: workerToHost });
    const pending = new Map<string, (response: JsonRpcResponse) => void>();
    const notifications: JsonRpcNotification[] = [];
    let nextRequestId = 1;

    // The fake session the opener returns. The test drives its output and exit.
    let emitOutput: ((chunk: string) => void) | null = null;
    let resolveWait: ((value: { exitCode: number | null }) => void) | null = null;
    const inputs: string[] = [];
    let killed = 0;
    let closed = 0;

    // The worker emits output and exit through `ctx.loginPty`, bound to the
    // worker session id. The test drives them through the captured emitters.
    const controllablePlugin = definePlugin({
      async setup(ctx) {
        emitOutput = (chunk: string) => ctx.loginPty.output("route-1", "ws-1", chunk);
        resolveWait = (value) => ctx.loginPty.exit("route-1", "ws-1", value.exitCode);
      },
      async onLoginPtyOpen(params) {
        // The open carries the host route id, the closed command key, and the
        // validated session home. The worker returns a worker session id for the
        // output binding only. The open carries no command string.
        expect(params.hostRouteId).toBe("route-1");
        expect(params.loginCommandKey).toBe("claude");
        expect(params.sessionHome).toBe(
          "/tmp/paperclip-adapter-login/11111111-2222-4333-8444-555555555555",
        );
        expect(params.providerLeaseId).toBe("lease-1");
        return { workerSessionId: "ws-1" };
      },
      async onLoginPtyInput(params) {
        inputs.push(params.data);
      },
      async onLoginPtyStop() {
        killed += 1;
      },
      async onLoginPtyClose(params) {
        // The close keys on the host route id and returns a bound acknowledgement.
        closed += 1;
        return { hostRouteId: params.hostRouteId };
      },
    });

    const worker = startWorkerRpcHost({
      plugin: controllablePlugin,
      stdin: hostToWorker,
      stdout: workerToHost,
    });

    function callWorker(method: string, params: unknown) {
      const id = `host-${nextRequestId++}`;
      const result = new Promise<unknown>((resolve, reject) => {
        pending.set(id, (response) => {
          if ("error" in response && response.error) {
            reject(new Error(response.error.message));
            return;
          }
          resolve((response as { result?: unknown }).result);
        });
      });
      hostToWorker.write(serializeMessage(createRequest(method, params, id)));
      return result;
    }

    hostReadline.on("line", (line) => {
      const message = parseMessage(line);
      if (isJsonRpcResponse(message)) {
        pending.get(String(message.id))?.(message);
        pending.delete(String(message.id));
        return;
      }
      if (isJsonRpcNotification(message)) {
        notifications.push(message as JsonRpcNotification);
      }
    });

    try {
      await expect(
        callWorker("initialize", {
          manifest: {
            id: "paperclip.login-pty",
            apiVersion: 1,
            version: "1.0.0",
            displayName: "Login PTY Test",
            description: "Test plugin",
            author: "Paperclip",
            categories: ["automation"],
            capabilities: [],
            entrypoints: {},
          },
          config: {},
          databaseNamespace: null,
        }),
      ).resolves.toMatchObject({
        ok: true,
        supportedMethods: expect.arrayContaining([
          "loginPtyOpen",
          "loginPtyInput",
          "loginPtyStop",
          "loginPtyClose",
        ]),
      });

      await expect(
        callWorker("loginPtyOpen", {
          hostRouteId: "route-1",
          driverKey: "daytona",
          environmentId: "env-1",
          providerLeaseId: "lease-1",
          loginCommandKey: "claude",
          sessionHome: "/tmp/paperclip-adapter-login/11111111-2222-4333-8444-555555555555",
        }),
      ).resolves.toEqual({ workerSessionId: "ws-1" });

      // The worker streams output as a notification bound to the worker session id.
      emitOutput?.("prompt output");
      await callWorker("loginPtyInput", { workerSessionId: "ws-1", data: "browser-code" });
      await callWorker("loginPtyStop", { workerSessionId: "ws-1" });
      resolveWait?.({ exitCode: 0 });
      await expect(
        callWorker("loginPtyClose", { hostRouteId: "route-1" }),
      ).resolves.toEqual({ hostRouteId: "route-1" });

      await new Promise((resolve) => setImmediate(resolve));

      expect(inputs).toEqual(["browser-code"]);
      expect(killed).toBe(1);
      expect(closed).toBe(1);
      const outputNotes = notifications.filter(
        (note) => note.method === "loginPty.output",
      );
      expect(outputNotes.map((note) => note.params)).toEqual([
        { hostRouteId: "route-1", workerSessionId: "ws-1", chunk: "prompt output" },
      ]);
      const exitNotes = notifications.filter(
        (note) => note.method === "loginPty.exit",
      );
      expect(exitNotes.map((note) => note.params)).toEqual([
        { hostRouteId: "route-1", workerSessionId: "ws-1", exitCode: 0 },
      ]);
    } finally {
      worker.stop();
      hostReadline.close();
    }
  });
});

describe("worker duplex channel dispatch", () => {
  it("dispatches open, write, stop, and close, and reports the duplex methods", async () => {
    const hostToWorker = new PassThrough();
    const workerToHost = new PassThrough();
    const hostReadline = createInterface({ input: workerToHost });
    const pending = new Map<string, (response: JsonRpcResponse) => void>();
    let nextRequestId = 1;

    const writes: string[] = [];
    let stopped = 0;
    let closed = 0;

    // The plugin declares the four duplex channel handlers. The open returns a
    // worker session id. The close keys on the host route id and returns a bound
    // acknowledgement.
    const controllablePlugin = definePlugin({
      async setup() {},
      async onDuplexChannelOpen(params) {
        expect(params.hostRouteId).toBe("route-1");
        expect(params.command).toEqual(["paperclip-bridge"]);
        expect(params.providerLeaseId).toBe("lease-1");
        return { workerSessionId: "ws-1" };
      },
      async onDuplexChannelWrite(params) {
        writes.push(params.data);
      },
      async onDuplexChannelStop() {
        stopped += 1;
      },
      async onDuplexChannelClose(params) {
        closed += 1;
        return { hostRouteId: params.hostRouteId };
      },
    });

    const worker = startWorkerRpcHost({
      plugin: controllablePlugin,
      stdin: hostToWorker,
      stdout: workerToHost,
    });

    function callWorker(method: string, params: unknown) {
      const id = `host-${nextRequestId++}`;
      const result = new Promise<unknown>((resolve, reject) => {
        pending.set(id, (response) => {
          if ("error" in response && response.error) {
            reject(new Error(response.error.message));
            return;
          }
          resolve((response as { result?: unknown }).result);
        });
      });
      hostToWorker.write(serializeMessage(createRequest(method, params, id)));
      return result;
    }

    hostReadline.on("line", (line) => {
      const message = parseMessage(line);
      if (isJsonRpcResponse(message)) {
        pending.get(String(message.id))?.(message);
        pending.delete(String(message.id));
      }
    });

    try {
      await expect(
        callWorker("initialize", {
          manifest: {
            id: "paperclip.duplex-channel",
            apiVersion: 1,
            version: "1.0.0",
            displayName: "Duplex Channel Test",
            description: "Test plugin",
            author: "Paperclip",
            categories: ["automation"],
            capabilities: [],
            entrypoints: {},
          },
          config: {},
          databaseNamespace: null,
        }),
      ).resolves.toMatchObject({
        ok: true,
        supportedMethods: expect.arrayContaining([
          "duplexChannelOpen",
          "duplexChannelWrite",
          "duplexChannelStop",
          "duplexChannelClose",
        ]),
      });

      await expect(
        callWorker("duplexChannelOpen", {
          hostRouteId: "route-1",
          driverKey: "daytona",
          environmentId: "env-1",
          providerLeaseId: "lease-1",
          command: ["paperclip-bridge"],
        }),
      ).resolves.toEqual({ workerSessionId: "ws-1" });

      await callWorker("duplexChannelWrite", { workerSessionId: "ws-1", data: "payload" });
      await callWorker("duplexChannelStop", { workerSessionId: "ws-1" });
      await expect(
        callWorker("duplexChannelClose", { hostRouteId: "route-1" }),
      ).resolves.toEqual({ hostRouteId: "route-1" });

      expect(writes).toEqual(["payload"]);
      expect(stopped).toBe(1);
      expect(closed).toBe(1);
    } finally {
      worker.stop();
      hostReadline.close();
    }
  });

  it("reports no duplex methods when the plugin declares no duplex handlers", async () => {
    const hostToWorker = new PassThrough();
    const workerToHost = new PassThrough();
    const hostReadline = createInterface({ input: workerToHost });
    const pending = new Map<string, (response: JsonRpcResponse) => void>();
    let nextRequestId = 1;

    // A plugin with no duplex handlers advertises no duplex method. The Phase 1
    // capability `duplexCommandStream` still resolves false for this provider,
    // because the prerequisite verb `duplexChannelOpen` is absent.
    const barePlugin = definePlugin({
      async setup() {},
    });

    const worker = startWorkerRpcHost({
      plugin: barePlugin,
      stdin: hostToWorker,
      stdout: workerToHost,
    });

    function callWorker(method: string, params: unknown) {
      const id = `host-${nextRequestId++}`;
      const result = new Promise<unknown>((resolve, reject) => {
        pending.set(id, (response) => {
          if ("error" in response && response.error) {
            reject(new Error(response.error.message));
            return;
          }
          resolve((response as { result?: unknown }).result);
        });
      });
      hostToWorker.write(serializeMessage(createRequest(method, params, id)));
      return result;
    }

    hostReadline.on("line", (line) => {
      const message = parseMessage(line);
      if (isJsonRpcResponse(message)) {
        pending.get(String(message.id))?.(message);
        pending.delete(String(message.id));
      }
    });

    try {
      const result = (await callWorker("initialize", {
        manifest: {
          id: "paperclip.bare",
          apiVersion: 1,
          version: "1.0.0",
          displayName: "Bare Test",
          description: "Test plugin",
          author: "Paperclip",
          categories: ["automation"],
          capabilities: [],
          entrypoints: {},
        },
        config: {},
        databaseNamespace: null,
      })) as { supportedMethods: string[] };

      expect(result.supportedMethods).not.toContain("duplexChannelOpen");
      expect(result.supportedMethods).not.toContain("duplexChannelWrite");
      expect(result.supportedMethods).not.toContain("duplexChannelStop");
      expect(result.supportedMethods).not.toContain("duplexChannelClose");
    } finally {
      worker.stop();
      hostReadline.close();
    }
  });
});


describe("AI connection router RPC", () => {
  it("advertises and calls only an implemented routing hook", async () => {
    const input = new PassThrough(), output = new PassThrough();
    const reader = createInterface({ input: output });
    const request = { taskKey: "task", candidates: [], memberOrder: [] };
    let received: unknown;
    const plugin = definePlugin({ async setup() {}, onRouteAiConnection(params) { received = params; return { kind: "selected", memberId: "authorized-member" }; } });
    const worker = startWorkerRpcHost({ plugin, stdin: input, stdout: output });
    let sequence = 0;
    const pending = new Map<string, (value: unknown) => void>();
    reader.on("line", line => { const response = parseMessage(line); if (isJsonRpcResponse(response)) { pending.get(String(response.id))?.(response); pending.delete(String(response.id)); } });
    const call = (method: string, params: unknown) => new Promise<JsonRpcResponse>(resolve => { const id = String(++sequence); pending.set(id, value => resolve(value as JsonRpcResponse)); input.write(serializeMessage(createRequest(method, params, id))); });
    try {
      const initialized = await call("initialize", { manifest: { id: "fixture.router", apiVersion: 1, version: "1.0.0", displayName: "Router", description: "Fixture", author: "Tests", categories: ["connector"], capabilities: ["ai.connections.route"], entrypoints: {} }, config: {}, databaseNamespace: null });
      expect((initialized as { result: { supportedMethods: string[] } }).result.supportedMethods).toContain("routeAiConnection");
      expect((await call("routeAiConnection", request) as { result: unknown }).result).toEqual({ kind: "selected", memberId: "authorized-member" });
      expect(received).toEqual(request);
    } finally { worker.stop(); reader.close(); input.destroy(); output.destroy(); }
  });
});
