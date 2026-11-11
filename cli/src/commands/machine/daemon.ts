import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import {
  MACHINE_CONTROL_PATH,
  MACHINE_HEARTBEAT_INTERVAL_MS,
  MACHINE_PRESENCE_TIMEOUT_MS,
  MACHINE_CREDENTIAL_REJECTED_ERROR,
  MACHINE_PROTOCOL_VERSION,
  type MachineCapabilities,
  type MachineDaemonMessage,
  type MachineExecRequest,
} from "@paperclipai/shared";
import { cliVersion } from "../../version.js";
import { reconnectDelayMs } from "./backoff.js";
import { clearMachineCredential, resolveExtraHeaders, type MachineConfig } from "./config.js";
import { MachineExecEngine } from "./exec-engine.js";
import { detectCapabilities } from "./host.js";
import { MachineOutbox } from "./outbox.js";
import { handleRpc } from "./rpc.js";

export const EXIT_REVOKED = 2;

export function log(line: string): void {
  console.log(`${new Date().toISOString()} ${line}`);
}

export function controlUrl(serverUrl: string): string {
  const url = new URL(`${serverUrl}${MACHINE_CONTROL_PATH}`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

type ServerFrame =
  | { type: "welcome"; machineId: string; heartbeatIntervalMs?: number }
  | MachineExecRequest
  | { type: "exec.kill"; requestId: string; signal: "SIGTERM" | "SIGKILL" }
  | { type: "rpc"; requestId: string; method: string; params?: Record<string, unknown> }
  | { type: "revoked" };

function parseServerFrame(raw: string): ServerFrame | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const frame = value as { type?: unknown; requestId?: unknown };
  switch (frame.type) {
    case "welcome":
    case "revoked":
      return value as ServerFrame;
    case "exec":
    case "exec.kill":
    case "rpc":
      return typeof frame.requestId === "string" ? value as ServerFrame : null;
    default:
      return null;
  }
}

/**
 * A 401 on the upgrade can come from a proxy or access gate in front of
 * Paperclip; anything other than Paperclip's own rejection is retried.
 */
export async function checkCredential(
  serverUrl: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<"valid" | "revoked" | "unknown"> {
  try {
    const response = await fetchImpl(`${serverUrl.replace(/\/+$/, "")}/api/machines/v1/self`, {
      headers: { ...headers, accept: "application/json" },
    });
    if (response.ok) return "valid";
    if (response.status !== 401) return "unknown";
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    return body?.error === MACHINE_CREDENTIAL_REJECTED_ERROR ? "revoked" : "unknown";
  } catch {
    return "unknown";
  }
}

export interface MachineDaemonOptions {
  detectCapabilities?: () => Promise<MachineCapabilities>;
}

export async function runMachineDaemon(
  config: MachineConfig,
  configPath: string,
  options: MachineDaemonOptions = {},
): Promise<number> {
  if (!config.credential) {
    throw new Error("This machine is not paired. Run `paperclipai machine pair --server <url>` first.");
  }
  const credential = config.credential;
  const headers = { ...resolveExtraHeaders(config), authorization: `Bearer ${credential}` };
  const url = controlUrl(config.serverUrl);
  fs.mkdirSync(config.workspaceRoot, { recursive: true });

  const outbox = new MachineOutbox();
  let socket: WebSocket | null = null;
  let stopping = false;
  let attempt = 0;

  const send = (message: MachineDaemonMessage) => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    else outbox.push(message);
  };

  const engine = new MachineExecEngine({ emit: send, defaultCwd: config.workspaceRoot, log });

  return await new Promise<number>((resolveExit) => {
    let reconnectTimer: NodeJS.Timeout | null = null;

    const finish = async (code: number) => {
      if (stopping) return;
      stopping = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      await engine.shutdown();
      if (socket && socket.readyState === WebSocket.OPEN) socket.close(1000, "daemon stopping");
      else socket?.terminate();
      resolveExit(code);
    };

    const revoke = (reason: string) => {
      log(`machine credential is no longer valid (${reason}); removing it from ${configPath}`);
      clearMachineCredential(configPath);
      log("pair this machine again with `paperclipai machine pair --server <url>`");
      void finish(EXIT_REVOKED);
    };

    const onSignal = (signal: NodeJS.Signals) => {
      log(`received ${signal}, stopping running commands`);
      void finish(0);
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    const scheduleReconnect = () => {
      if (stopping || reconnectTimer) return;
      const delay = reconnectDelayMs(attempt);
      attempt += 1;
      log(`disconnected; reconnecting in ${(delay / 1000).toFixed(1)}s`);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startConnect();
      }, delay);
    };

    const connect = async () => {
      if (stopping) return;
      const capabilities = await (options.detectCapabilities ?? detectCapabilities)();
      if (stopping) return;
      const ws = new WebSocket(url, { headers, handshakeTimeout: 15_000 });
      socket = ws;
      let heartbeatTimer: NodeJS.Timeout | null = null;
      let lastPongAt = Date.now();

      ws.on("unexpected-response", (_request, response) => {
        const status = response.statusCode ?? 0;
        response.resume();
        if (status !== 401) {
          log(`connection rejected with HTTP ${status}`);
          ws.terminate();
          return;
        }
        void checkCredential(config.serverUrl, headers).then((verdict) => {
          if (verdict === "revoked") {
            revoke("server rejected the machine credential");
            return;
          }
          log("connection rejected with HTTP 401 by something in front of the server; keeping the credential");
          ws.terminate();
        });
      });

      ws.on("open", () => {
        attempt = 0;
        lastPongAt = Date.now();
        log(`connected to ${config.serverUrl}`);
        const hello: MachineDaemonMessage = {
          type: "hello",
          protocolVersion: MACHINE_PROTOCOL_VERSION,
          daemonVersion: cliVersion.slice(0, 64),
          platform: process.platform,
          arch: process.arch,
          hostname: os.hostname().slice(0, 255) || null,
          workspaceRoot: path.resolve(config.workspaceRoot),
          capabilities,
          runningRequestIds: engine.runningRequestIds().slice(0, 1024),
        };
        ws.send(JSON.stringify(hello));
        const { messages, droppedChunks } = outbox.drain();
        if (droppedChunks > 0) log(`dropped ${droppedChunks} output chunks while disconnected`);
        for (const message of messages) ws.send(JSON.stringify(message));

        heartbeatTimer = setInterval(() => {
          if (Date.now() - lastPongAt > MACHINE_PRESENCE_TIMEOUT_MS) {
            log("server stopped answering pings");
            ws.terminate();
            return;
          }
          ws.send(JSON.stringify({ type: "heartbeat" } satisfies MachineDaemonMessage));
          ws.ping();
        }, MACHINE_HEARTBEAT_INTERVAL_MS);
      });

      ws.on("pong", () => {
        lastPongAt = Date.now();
      });

      ws.on("message", (data) => {
        lastPongAt = Date.now();
        const frame = parseServerFrame(data.toString());
        if (!frame) return;
        switch (frame.type) {
          case "welcome":
            log(`registered as machine ${frame.machineId}`);
            return;
          case "revoked":
            revoke("server revoked this machine");
            return;
          case "exec":
            engine.start(frame);
            return;
          case "exec.kill":
            engine.kill(frame.requestId, frame.signal === "SIGKILL" ? "SIGKILL" : "SIGTERM");
            return;
          case "rpc":
            log(`rpc ${frame.requestId} ${frame.method}`);
            void handleRpc(
              { requestId: frame.requestId, method: frame.method, params: frame.params },
              { engine, sync: { serverUrl: config.serverUrl, headers, workspaceRoot: config.workspaceRoot } },
            )
              .then(send);
            return;
        }
      });

      ws.on("error", (error) => {
        if (!stopping) log(`connection error: ${error.message}`);
      });

      ws.on("close", () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (socket === ws) socket = null;
        scheduleReconnect();
      });
    };

    const startConnect = () => {
      connect().catch((error: unknown) => {
        log(`failed to connect: ${error instanceof Error ? error.message : String(error)}`);
        scheduleReconnect();
      });
    };

    startConnect();
  });
}
