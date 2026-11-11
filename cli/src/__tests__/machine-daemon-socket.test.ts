import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";
import {
  MACHINE_CREDENTIAL_REJECTED_ERROR,
  machineDaemonMessageSchema,
  type MachineDaemonMessage,
} from "@paperclipai/shared";
import { readMachineConfig, writeMachineConfig } from "../commands/machine/config.js";
import { EXIT_REVOKED, runMachineDaemon } from "../commands/machine/daemon.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const capabilities = async () => ({ docker: false, devcontainerCli: false, runnerd: null, tools: [] });

async function startServer(
  onUpgrade: (request: http.IncomingMessage) => number,
  self: { status: number; body: string } = { status: 200, body: "{}" },
) {
  const server = http.createServer((request, response) => {
    response.writeHead(request.url === "/api/machines/v1/self" ? self.status : 404, { "content-type": "application/json" });
    response.end(self.body);
  });
  const wss = new WebSocketServer({ noServer: true });
  const sockets: WebSocket[] = [];
  const received: MachineDaemonMessage[] = [];
  const authHeaders: Array<string | undefined> = [];
  const listeners: Array<(message: MachineDaemonMessage, socket: WebSocket) => void> = [];

  server.on("upgrade", (request, socket, head) => {
    authHeaders.push(request.headers.authorization);
    const status = onUpgrade(request);
    if (status !== 101) {
      socket.end(`HTTP/1.1 ${status} Unauthorized\r\nContent-Length: 0\r\n\r\n`);
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      sockets.push(ws);
      ws.send(JSON.stringify({ type: "welcome", machineId: "m-1", heartbeatIntervalMs: 15_000, serverTime: new Date().toISOString() }));
      ws.on("message", (data) => {
        const message = machineDaemonMessageSchema.parse(JSON.parse(data.toString()));
        received.push(message);
        for (const listener of listeners) listener(message, ws);
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => {
    for (const socket of sockets) socket.terminate();
    wss.close();
    server.close();
  });
  const { port } = server.address() as AddressInfo;
  const waitFor = (predicate: (message: MachineDaemonMessage) => boolean) =>
    new Promise<{ message: MachineDaemonMessage; socket: WebSocket }>((resolve) => {
      listeners.push((message, socket) => {
        if (predicate(message)) resolve({ message, socket });
      });
    });
  return { url: `http://127.0.0.1:${port}`, received, authHeaders, waitFor };
}

function pairedConfig(serverUrl: string) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-machine-socket-"));
  cleanups.push(() => fs.rmSync(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, "machine", "config.json");
  const config = {
    serverUrl,
    machineId: "m-1",
    credential: "cred-secret",
    workspaceRoot: path.join(directory, "workspaces"),
    headers: { "x-access-token": "proxy" },
  };
  writeMachineConfig(config, configPath);
  return { config, configPath };
}

describe("machine daemon socket", () => {
  it("says hello, runs an exec, and exits with code 2 when revoked", async () => {
    const server = await startServer(() => 101);
    const { config, configPath } = pairedConfig(server.url);
    const helloSeen = server.waitFor((message) => message.type === "hello");
    const exit = runMachineDaemon(config, configPath, { detectCapabilities: capabilities });

    const { message: hello, socket } = await helloSeen;
    expect(hello).toMatchObject({ type: "hello", protocolVersion: 1, runningRequestIds: [], workspaceRoot: config.workspaceRoot });
    expect(server.authHeaders[0]).toBe("Bearer cred-secret");

    const exited = server.waitFor((message) => message.type === "exec.exited");
    socket.send(JSON.stringify({
      type: "exec", requestId: "e1", command: "sh", args: ["-c", "echo hi"], cwd: null,
      env: {}, stdin: null, timeoutMs: null, contextId: null, container: null,
    }));
    expect((await exited).message).toMatchObject({ exitCode: 0 });
    expect(server.received.filter((m) => m.type === "exec.output").map((m) => m.chunk).join("")).toBe("hi\n");

    socket.send(JSON.stringify({ type: "revoked" }));
    expect(await exit).toBe(EXIT_REVOKED);
    expect(readMachineConfig(configPath)?.credential).toBeNull();
  });

  it("treats HTTP 401 on upgrade as revocation when Paperclip rejects the credential", async () => {
    const server = await startServer(() => 401, {
      status: 401,
      body: JSON.stringify({ error: MACHINE_CREDENTIAL_REJECTED_ERROR }),
    });
    const { config, configPath } = pairedConfig(server.url);
    expect(await runMachineDaemon(config, configPath, { detectCapabilities: capabilities })).toBe(EXIT_REVOKED);
    expect(readMachineConfig(configPath)?.credential).toBeNull();
  });

  it("keeps the credential and retries when a proxy answers 401", async () => {
    const server = await startServer(() => 401, { status: 401, body: "<html>Sign in</html>" });
    const { config, configPath } = pairedConfig(server.url);
    const exit = runMachineDaemon(config, configPath, { detectCapabilities: capabilities });
    while (server.authHeaders.length < 2) await new Promise((resolve) => setTimeout(resolve, 50));
    expect(readMachineConfig(configPath)?.credential).toBe(config.credential);
    process.emit("SIGTERM", "SIGTERM");
    expect(await exit).toBe(0);
  }, 10_000);

  it("keeps commands running across a reconnect and reports them in hello", async () => {
    const server = await startServer(() => 101);
    const { config, configPath } = pairedConfig(server.url);
    const firstHello = server.waitFor((message) => message.type === "hello");
    const exit = runMachineDaemon(config, configPath, { detectCapabilities: capabilities });
    const { socket } = await firstHello;

    const started = server.waitFor((message) => message.type === "exec.started");
    socket.send(JSON.stringify({
      type: "exec", requestId: "long", command: "sh", args: ["-c", "sleep 2; echo done"], cwd: null,
      env: {}, stdin: null, timeoutMs: null, contextId: null, container: null,
    }));
    await started;

    const secondHello = server.waitFor((message) => message.type === "hello" && message.runningRequestIds.length > 0);
    const exited = server.waitFor((message) => message.type === "exec.exited");
    socket.terminate();
    expect((await secondHello).message).toMatchObject({ runningRequestIds: ["long"] });
    expect((await exited).message).toMatchObject({ requestId: "long", exitCode: 0 });

    process.emit("SIGTERM", "SIGTERM");
    expect(await exit).toBe(0);
  }, 10_000);
});
