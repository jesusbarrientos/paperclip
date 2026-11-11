import { createHash } from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentApiKeys, agents, companyMemberships, heartbeatRunEvents, instanceUserRoles } from "@paperclipai/db";
import type { DeploymentMode, LiveEvent } from "@paperclipai/shared";
import type { BetterAuthSessionResult } from "../auth/better-auth.js";
import { logger } from "../middleware/logger.js";
import { subscribeLiveEvents } from "../services/live-events.js";
import { boardAuthService } from "../services/board-auth.js";

interface WsSocket {
  readyState: number;
  ping(): void;
  send(data: string): void;
  terminate(): void;
  close(code?: number, reason?: string): void;
  on(event: "pong", listener: () => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
}

interface WsServer {
  clients: Set<WsSocket>;
  on(event: "connection", listener: (socket: WsSocket, req: IncomingMessage) => void): void;
  on(event: "close", listener: () => void): void;
  handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    callback: (ws: WsSocket) => void,
  ): void;
  emit(event: "connection", ws: WsSocket, req: IncomingMessage): boolean;
}

const require = createRequire(import.meta.url);
const { WebSocket, WebSocketServer } = require("ws") as {
  WebSocket: { OPEN: number };
  WebSocketServer: new (opts: { noServer: boolean }) => WsServer;
};

interface UpgradeContext {
  actorType: "board" | "agent";
  actorId: string;
}

/** Cloud-proxied browser identity resolved from trusted x-paperclip-cloud-* headers. */
export interface CloudUpgradeActor {
  userId: string;
}

interface IncomingMessageWithContext extends IncomingMessage {
  paperclipWebSocketHandled?: boolean;
  paperclipUpgradeContext?: UpgradeContext;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isWritableUpgradeSocket(socket: Duplex) {
  const maybeWritableState = socket as Duplex & { writable?: boolean; writableEnded?: boolean; writableDestroyed?: boolean };
  return !socket.destroyed && maybeWritableState.writable !== false && !maybeWritableState.writableEnded && !maybeWritableState.writableDestroyed;
}

function closeUpgradeSocket(socket: Duplex) {
  if (!socket.destroyed) {
    socket.destroy();
  }
}

function rejectUpgrade(socket: Duplex, statusLine: string, message: string) {
  const safe = message.replace(/[\r\n]+/g, " ").trim();
  if (!isWritableUpgradeSocket(socket)) {
    closeUpgradeSocket(socket);
    return;
  }

  try {
    socket.once("finish", () => closeUpgradeSocket(socket));
    socket.end(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${safe}`);
  } catch (err) {
    logger.warn({ err }, "failed to reject live websocket upgrade");
    closeUpgradeSocket(socket);
  }
}

function isLiveEventsPath(pathname: string) {
  return pathname === "/api/events/ws";
}

function parseBearerToken(rawAuth: string | string[] | undefined) {
  const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!auth) return null;
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function headersFromIncomingMessage(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, raw] of Object.entries(req.headers)) {
    if (!raw) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) headers.append(key, value);
      continue;
    }
    headers.set(key, raw);
  }
  return headers;
}

async function authorizeUpgrade(
  db: Db,
  req: IncomingMessage,
  url: URL,
  opts: {
    deploymentMode: DeploymentMode;
    resolveSessionFromHeaders?: (headers: Headers) => Promise<BetterAuthSessionResult | null>;
    resolveCloudActor?: (req: IncomingMessage) => Promise<CloudUpgradeActor | null>;
  },
): Promise<UpgradeContext | null> {
  const queryToken = url.searchParams.get("token")?.trim() ?? "";
  const authToken = parseBearerToken(req.headers.authorization);
  const token = authToken ?? (queryToken.length > 0 ? queryToken : null);

  // Browser board context has no bearer token in local_trusted and authenticated modes.
  if (!token) {
    if (opts.deploymentMode === "local_trusted") {
      return {
        actorType: "board",
        actorId: "board",
      };
    }

    // Cloud-managed deployments authenticate proxied browsers with trusted
    // x-paperclip-cloud-* headers, never a local Better Auth session — the
    // session fallback below can only 403 them, which left the live-events
    // socket permanently unreachable behind the Cloud front door. A resolved
    // cloud actor is authoritative. Absent/invalid cloud headers fall through
    // to the session path, so self-hosted behavior is unchanged.
    if (opts.resolveCloudActor) {
      const cloudActor = await opts.resolveCloudActor(req);
      if (cloudActor) {
        return {
          actorType: "board",
          actorId: cloudActor.userId,
        };
      }
    }

    if (opts.deploymentMode !== "authenticated" || !opts.resolveSessionFromHeaders) {
      return null;
    }

    const session = await opts.resolveSessionFromHeaders(headersFromIncomingMessage(req));
    const userId = session?.user?.id;
    if (!userId) return null;

    const [roleRow, memberships] = await Promise.all([
      db
        .select({ id: instanceUserRoles.id })
        .from(instanceUserRoles)
        .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
        .then((rows) => rows[0] ?? null),
      db
        .select({ id: companyMemberships.id })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, userId),
            eq(companyMemberships.status, "active"),
          ),
        ),
    ]);

    if (!roleRow && memberships.length === 0) return null;

    return {
      actorType: "board",
      actorId: userId,
    };
  }

  const tokenHash = hashToken(token);
  const key = await db
    .select()
    .from(agentApiKeys)
    .where(and(eq(agentApiKeys.keyHash, tokenHash), isNull(agentApiKeys.revokedAt)))
    .then((rows) => rows[0] ?? null);

  if (!key) {
    return authorizeBoardApiKey(db, token);
  }
  const keyAgent = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, key.agentId))
    .then((rows) => rows[0] ?? null);
  if (!keyAgent) {
    return null;
  }

  await db
    .update(agentApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentApiKeys.id, key.id));

  return {
    actorType: "agent",
    actorId: key.agentId,
  };
}

async function authorizeBoardApiKey(db: Db, token: string): Promise<UpgradeContext | null> {
  const boardAuth = boardAuthService(db);
  const key = await boardAuth.findBoardApiKeyByToken(token);
  if (!key) return null;
  const access = await boardAuth.resolveBoardAccess(key.userId);
  if (!access.isInstanceAdmin && access.memberships.length === 0) return null;
  void boardAuth.touchBoardApiKey(key.id).catch(() => undefined);
  return { actorType: "board", actorId: key.userId };
}

interface SubscriptionFilter {
  issueId: string | null;
  runId: string | null;
  types: Set<string> | null;
}

export function parseSubscription(url: URL): SubscriptionFilter {
  const read = (name: string) => url.searchParams.get(name)?.trim() || null;
  const types = read("types");
  return {
    issueId: read("issueId"),
    runId: read("runId"),
    types: types ? new Set(types.split(",").map((value) => value.trim()).filter(Boolean)) : null,
  };
}

/**
 * Run events and logs of an issue's runs carry the issue id only on some
 * frames, so a filtered socket remembers which runs belong to its issue.
 */
export function createEventFilter(filter: SubscriptionFilter) {
  const issueRunIds = new Set<string>();
  return (event: LiveEvent) => {
    if (filter.types && !filter.types.has(event.type)) return false;
    const payload = event.payload ?? {};
    const runId = typeof payload.runId === "string" ? payload.runId : null;
    // Activity rows name the issue as their entity rather than in issueId.
    const issueId =
      typeof payload.issueId === "string"
        ? payload.issueId
        : payload.entityType === "issue" && typeof payload.entityId === "string"
          ? payload.entityId
          : null;
    if (filter.runId && runId !== filter.runId) return false;
    if (filter.issueId) {
      if (issueId === filter.issueId) {
        if (runId) issueRunIds.add(runId);
        return true;
      }
      return Boolean(runId && issueRunIds.has(runId));
    }
    return true;
  };
}

const REPLAY_LIMIT = 2000;

export async function replayRunEvents(db: Db, socket: WsSocket, runId: string, afterSeq: number) {
  const rows = await db
    .select()
    .from(heartbeatRunEvents)
    .where(and(eq(heartbeatRunEvents.runId, runId), gt(heartbeatRunEvents.seq, afterSeq)))
    .orderBy(asc(heartbeatRunEvents.seq))
    .limit(REPLAY_LIMIT);
  for (const row of rows) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      id: 0,
      type: "heartbeat.run.event",
      createdAt: row.createdAt.toISOString(),
      replay: true,
      payload: {
        runId: row.runId,
        agentId: row.agentId,
        seq: row.seq,
        eventType: row.eventType,
        stream: row.stream ?? null,
        level: row.level ?? null,
        color: row.color ?? null,
        message: row.message ?? null,
        payload: row.payload ?? null,
      },
    }));
  }
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      id: 0,
      type: "replay.complete",
      createdAt: new Date().toISOString(),
      payload: { runId, afterSeq, count: rows.length, truncated: rows.length === REPLAY_LIMIT },
    }));
  }
}

export function setupLiveEventsWebSocketServer(
  server: HttpServer,
  db: Db,
  opts: {
    deploymentMode: DeploymentMode;
    resolveSessionFromHeaders?: (headers: Headers) => Promise<BetterAuthSessionResult | null>;
    /**
     * Resolves a Cloud-proxied browser's identity from the trusted
     * x-paperclip-cloud-* headers on the upgrade request. Wired by managed
     * deployments; self-hosted instances leave it unset.
     */
    resolveCloudActor?: (req: IncomingMessage) => Promise<CloudUpgradeActor | null>;
  },
) {
  const wss = new WebSocketServer({ noServer: true });
  const cleanupByClient = new Map<WsSocket, () => void>();
  const aliveByClient = new Map<WsSocket, boolean>();

  const pingInterval = setInterval(() => {
    for (const socket of wss.clients) {
      if (!aliveByClient.get(socket)) {
        socket.terminate();
        continue;
      }
      aliveByClient.set(socket, false);
      socket.ping();
    }
  }, 30000);

  wss.on("connection", (socket: WsSocket, req: IncomingMessage) => {
    const context = (req as IncomingMessageWithContext).paperclipUpgradeContext;
    if (!context) {
      socket.close(1008, "missing context");
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    const filter = parseSubscription(url);
    const accepts = createEventFilter(filter);
    const afterSeqRaw = url.searchParams.get("afterSeq");
    const afterSeq = afterSeqRaw !== null && /^\d+$/.test(afterSeqRaw) ? Number(afterSeqRaw) : null;
    const pendingLive: LiveEvent[] = [];
    let replaying = filter.runId !== null && afterSeq !== null;
    const deliver = (event: LiveEvent) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify(event));
    };

    const unsubscribe = subscribeLiveEvents((event) => {
      if (!accepts(event)) return;
      if (replaying) {
        pendingLive.push(event);
        return;
      }
      deliver(event);
    });

    if (replaying && filter.runId !== null && afterSeq !== null) {
      void replayRunEvents(db, socket, filter.runId, afterSeq)
        .catch((err) => logger.warn({ err, runId: filter.runId }, "live websocket replay failed"))
        .finally(() => {
          replaying = false;
          let lastReplayedSeq = afterSeq;
          for (const event of pendingLive.splice(0)) {
            const seq = typeof event.payload?.seq === "number" ? event.payload.seq : null;
            if (event.type === "heartbeat.run.event" && seq !== null && seq <= lastReplayedSeq) continue;
            if (seq !== null) lastReplayedSeq = Math.max(lastReplayedSeq, seq);
            deliver(event);
          }
        });
    }

    cleanupByClient.set(socket, unsubscribe);
    aliveByClient.set(socket, true);

    socket.on("pong", () => {
      aliveByClient.set(socket, true);
    });

    socket.on("close", () => {
      const cleanup = cleanupByClient.get(socket);
      if (cleanup) cleanup();
      cleanupByClient.delete(socket);
      aliveByClient.delete(socket);
    });

    socket.on("error", (err: Error) => {
      logger.warn({ err }, "live websocket client error");
    });
  });

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  server.on("upgrade", (req, socket, head) => {
    if ((req as IncomingMessageWithContext).paperclipWebSocketHandled) {
      return;
    }

    const onRawSocketError = (err: Error) => {
      logger.warn({ err, path: req.url }, "live websocket upgrade socket error");
    };
    const cleanupRawSocketListeners = () => {
      socket.off("error", onRawSocketError);
      socket.off("close", cleanupRawSocketListeners);
    };

    socket.on("error", onRawSocketError);
    socket.once("close", cleanupRawSocketListeners);

    if (!req.url) {
      rejectUpgrade(socket, "400 Bad Request", "missing url");
      return;
    }

    const url = new URL(req.url, "http://localhost");
    if (!isLiveEventsPath(url.pathname)) {
      closeUpgradeSocket(socket);
      return;
    }

    void authorizeUpgrade(db, req, url, {
      deploymentMode: opts.deploymentMode,
      resolveSessionFromHeaders: opts.resolveSessionFromHeaders,
      resolveCloudActor: opts.resolveCloudActor,
    })
      .then((context) => {
        if (!context) {
          rejectUpgrade(socket, "403 Forbidden", "forbidden");
          return;
        }

        if (!isWritableUpgradeSocket(socket)) {
          cleanupRawSocketListeners();
          return;
        }

        const reqWithContext = req as IncomingMessageWithContext;
        reqWithContext.paperclipUpgradeContext = context;

        cleanupRawSocketListeners();
        wss.handleUpgrade(req, socket, head, (ws: WsSocket) => {
          wss.emit("connection", ws, reqWithContext);
        });
      })
      .catch((err) => {
        logger.error({ err, path: req.url }, "failed websocket upgrade authorization");
        rejectUpgrade(socket, "500 Internal Server Error", "upgrade failed");
      });
  });

  return wss;
}
