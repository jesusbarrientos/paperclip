import type { IncomingMessage, Server as HttpServer } from "node:http";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";
import type { Db } from "@paperclipai/db";
import {
  MACHINE_CONTROL_PATH,
  MACHINE_HEARTBEAT_INTERVAL_MS,
  MACHINE_PROTOCOL_VERSION,
  machineDaemonMessageSchema,
  type MachineServerMessage,
} from "@paperclipai/shared";
import { logger } from "../middleware/logger.js";
import { publishLiveEvent } from "../services/live-events.js";
import {
  handleExecExited,
  handleExecFailed,
  handleExecOutput,
  handleExecStarted,
  handleRpcResult,
  registerMachineConnection,
} from "../services/machine-connections.js";
import { machineService } from "../services/machines.js";

interface WsSocket {
  readyState: number;
  ping(): void;
  send(data: string): void;
  terminate(): void;
  close(code?: number, reason?: string): void;
  on(event: "pong", listener: () => void): void;
  on(event: "message", listener: (data: Buffer | string) => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
}

interface WsServer {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, callback: (ws: WsSocket) => void): void;
}

interface MachineUpgradeRequest extends IncomingMessage {
  paperclipWebSocketHandled?: boolean;
}

const require = createRequire(import.meta.url);
const { WebSocket, WebSocketServer } = require("ws") as {
  WebSocket: { OPEN: number };
  WebSocketServer: new (opts: { noServer: boolean; maxPayload: number }) => WsServer;
};

const PING_INTERVAL_MS = 20_000;
const TOUCH_INTERVAL_MS = 60_000;

function bearer(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.toLowerCase().startsWith("bearer ")) return null;
  return value.slice(7).trim() || null;
}

function reject(socket: Duplex, status: string) {
  if (socket.destroyed) return;
  try {
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  } catch {
    socket.destroy();
  }
}

/** Must be registered before the live-events server, which closes unknown upgrade paths. */
export function setupMachineControlWebSocketServer(server: HttpServer, db: Db) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const svc = machineService(db);

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", "http://paperclip.invalid");
    if (url.pathname !== MACHINE_CONTROL_PATH) return;
    const owned = req as MachineUpgradeRequest;
    if (owned.paperclipWebSocketHandled) return;
    owned.paperclipWebSocketHandled = true;
    socket.on("error", (err) => logger.warn({ err }, "machine control upgrade socket error"));

    const credential = bearer(req.headers.authorization);
    if (!credential) {
      reject(socket, "401 Unauthorized");
      return;
    }
    void svc
      .authenticateCredential(credential)
      .then((machine) => {
        if (!machine) {
          reject(socket, "401 Unauthorized");
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => attach(ws, machine.id, machine.name));
      })
      .catch((err) => {
        logger.error({ err }, "machine control upgrade failed");
        reject(socket, "500 Internal Server Error");
      });
  });

  function attach(ws: WsSocket, machineId: string, machineName: string) {
    let alive = true;
    let lastTouch = 0;
    const send = (message: MachineServerMessage) => {
      if (ws.readyState !== WebSocket.OPEN) throw new Error("machine_socket_closed");
      ws.send(JSON.stringify(message));
    };
    const registration = registerMachineConnection({
      machineId,
      send,
      close: (code, reason) => ws.close(code, reason),
    });
    const publishStatus = (connected: boolean) =>
      publishLiveEvent({ type: "machine.status", payload: { machineId, connected } });

    const pingTimer = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, PING_INTERVAL_MS);

    ws.on("pong", () => {
      alive = true;
    });

    ws.on("message", (data) => {
      alive = true;
      let parsed;
      try {
        parsed = machineDaemonMessageSchema.safeParse(JSON.parse(data.toString()));
      } catch {
        ws.close(1003, "invalid json");
        return;
      }
      if (!parsed.success) {
        logger.warn({ machineId, issues: parsed.error.issues.slice(0, 3) }, "invalid machine frame");
        return;
      }
      const message = parsed.data;
      switch (message.type) {
        case "hello":
          if (message.protocolVersion !== MACHINE_PROTOCOL_VERSION) {
            ws.close(4002, "unsupported protocol version");
            return;
          }
          registration.setHello(message);
          void svc.recordHello(machineId, message).then(() => publishStatus(true));
          logger.info({ machineId, machineName, platform: message.platform }, "machine connected");
          return;
        case "heartbeat":
          if (Date.now() - lastTouch > TOUCH_INTERVAL_MS) {
            lastTouch = Date.now();
            void svc.touch(machineId);
          }
          return;
        case "exec.started":
          handleExecStarted(machineId, message.requestId, message.pid, message.startedAt);
          return;
        case "exec.output":
          handleExecOutput(machineId, message.requestId, message.stream, message.chunk);
          return;
        case "exec.exited":
          handleExecExited(machineId, message.requestId, message);
          return;
        case "exec.failed":
          handleExecFailed(machineId, message.requestId, message.error);
          return;
        case "rpc.result":
          handleRpcResult(machineId, message.requestId, message.ok, message.result, message.error);
          return;
      }
    });

    ws.on("close", () => {
      clearInterval(pingTimer);
      registration.unregister();
      void svc.touch(machineId).then(() => publishStatus(false));
      logger.info({ machineId, machineName }, "machine disconnected");
    });

    ws.on("error", (err) => logger.warn({ err, machineId }, "machine control socket error"));

    send({
      type: "welcome",
      machineId,
      heartbeatIntervalMs: MACHINE_HEARTBEAT_INTERVAL_MS,
      serverTime: new Date().toISOString(),
    });
  }

  return wss;
}
