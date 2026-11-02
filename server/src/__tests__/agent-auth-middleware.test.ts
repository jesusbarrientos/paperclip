import { createHash, createHmac, randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activityLog,
  agentApiKeys,
  agents,
  boardApiKeys,
  companies,
  heartbeatRuns,
} from "@paperclipai/db";
import { actorMiddleware } from "../middleware/auth.js";
import { errorHandler } from "../middleware/error-handler.js";
import { createLocalAgentJwt } from "../agent-auth-jwt.js";
import { assertOrgAccess } from "../routes/authz.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createSelectChain(rowsForTable: (table: unknown) => unknown[]) {
  return {
    from(table: unknown) {
      return {
        where() {
          return Promise.resolve(rowsForTable(table));
        },
        orderBy() {
          return { limit: () => Promise.resolve(rowsForTable(table)) };
        },
      };
    },
  };
}

function createDbState(input: {
  agent: { id: string;
 status?: string };
  agentKey?: { id: string; agentId: string;
 keyHash: string; responsibleUserId?: string | null };
  run?: { id: string;
 agentId: string; responsibleUserId?: string | null;
    status?: string; contextSnapshot?: Record<string, unknown>; resultJson?: Record<string, unknown> };
}) {
  const activity: Array<Record<string, unknown>> = [];
  const agentRow = {
    id: input.agent.id,
    status: input.agent.status ?? "active",
  };
  const keyRow = input.agentKey
    ? {
        id: input.agentKey.id,
        agentId: input.agentKey.agentId,
        keyHash: input.agentKey.keyHash,
        responsibleUserId: input.agentKey.responsibleUserId ?? null,
        revokedAt: null,
        scopeConfig: null,
      }
    : null;
  const runRow = input.run
    ? {
        id: input.run.id,
        agentId: input.run.agentId,
        responsibleUserId: input.run.responsibleUserId ?? null,
        status: input.run.status ?? "running",
        contextSnapshot: input.run.contextSnapshot ?? {},
        resultJson: input.run.resultJson ?? {},
      }
    : null;

  const db = {
    select: () =>
      createSelectChain((table) => {
        if (table === boardApiKeys) return [];
        if (table === agentApiKeys) return keyRow ? [keyRow] : [];
        if (table === agents) return [agentRow];
        if (table === heartbeatRuns) return runRow ? [runRow] : [];
        if (table === companies) return [{ id: "company-1" }];
        return [];
      }),
    update: () => ({
      set() {
        return {
          where() {
            return Promise.resolve([]);
          },
        };
      },
    }),
    insert: (table: unknown) => ({
      values(values: Record<string, unknown>) {
        if (table === activityLog) activity.push(values);
        return Promise.resolve([]);
      },
    }),
  } as any;

  return { db, activity };
}

function createApp(db: any, deploymentMode: "authenticated" | "local_trusted" = "authenticated") {
  const app = express();
  app.use(express.json());
  app.use(
    actorMiddleware(db, {
      deploymentMode,
      resolveSession: async () => null,
    }),
  );
  app.get("/actor", (req, res) => {
    res.json(req.actor);
  });
  app.post("/api/routine-triggers/public/:publicId/fire", (req, res) => {
    res.json({ reachedWebhook: true, actorType: req.actor.type });
  });
  app.post("/mcp/gateways/:gatewayPublicId", (req, res) => {
    res.json({ reachedGatewayProtocol: true, actorType: req.actor.type });
  });
  app.get("/protected", (req, res) => {
    assertOrgAccess(req);
    res.json({ ok: true });
  });
  app.get("/issues/:issueId", (req, res) => {
    assertOrgAccess(req);
    res.json({ id: req.params.issueId, readable: true });
  });
  app.patch("/issues/:issueId", (req, res) => {
    assertOrgAccess(req);
    res.json({ id: req.params.issueId, writable: true });
  });
  app.use(errorHandler);
  return app;
}

function craftAgentJwtWithoutResponsibleClaim(input: {
  secret: string;
  agentId: string;
  adapterType: string;
  runId: string;
  expiresInSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const claims = {
    sub: input.agentId,
    adapter_type: input.adapterType,
    run_id: input.runId,
    iat: now,
    exp: now + (input.expiresInSeconds ?? 3600),
    iss: "paperclip",
    aud: "paperclip-api",
  };
  const headerB64 = Buffer.from(JSON.stringify(header), "utf8").toString("base64url");
  const claimsB64 = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signingInput = `${headerB64}.${claimsB64}`;
  // Sign with the same per-instance key the server derives. The
  // instance defaults to "default" (beforeEach clears PAPERCLIP_INSTANCE_ID),
  // matching the live control plane this middleware test exercises. This helper
  // only omits the responsible_user_id claim — it is not a cross-instance token.
  const signingKey = createHmac("sha256", input.secret).update("jwt:default").digest("hex");
  const signature = createHmac("sha256", signingKey).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

describe("agent auth middleware", () => {
  const originalSecret = process.env.PAPERCLIP_AGENT_JWT_SECRET;
  const originalTtl = process.env.PAPERCLIP_AGENT_JWT_TTL_SECONDS;
  const originalInstanceId = process.env.PAPERCLIP_INSTANCE_ID;

  beforeEach(() => {
    process.env.PAPERCLIP_AGENT_JWT_SECRET = "auth-middleware-secret";
    process.env.PAPERCLIP_AGENT_JWT_TTL_SECONDS = "3600";
    // Pin the control-plane instance so mint/verify (and the hand-crafted
    // legacy token helper) all derive keys under the "default" live instance.
    delete process.env.PAPERCLIP_INSTANCE_ID;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PAPERCLIP_AGENT_JWT_SECRET;
    else process.env.PAPERCLIP_AGENT_JWT_SECRET = originalSecret;
    if (originalTtl === undefined) delete process.env.PAPERCLIP_AGENT_JWT_TTL_SECONDS;
    else process.env.PAPERCLIP_AGENT_JWT_TTL_SECONDS = originalTtl;
    if (originalInstanceId === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
    else process.env.PAPERCLIP_INSTANCE_ID = originalInstanceId;
  });

  it.each([
    { status: "cancelled", conversationMode: false, requested: false },
    { status: "running", conversationMode: false, requested: true },
    { status: "cancelled", conversationMode: true, requested: false },
    { status: "running", conversationMode: true, requested: true },
  ])("revokes writes but preserves reads for a stopped run: %j", async ({ status, conversationMode, requested }) => {
    const agentId = randomUUID();
    const runId = randomUUID();
    const { db } = createDbState({ agent: { id: agentId }, run: {
      id: runId, agentId, status, contextSnapshot: { conversationMode },
      resultJson: requested ? { executionCancellation: { state: "requested" } } : {},
    } });
    const token = createLocalAgentJwt(agentId, "grok_local", runId, null);
    const client = createApp(db);
    const endpoint = `/issues/${randomUUID()}`;
    const write = await request(client).patch(endpoint).set("Authorization", `Bearer ${token}`).send({ status: "done" });
    expect(write.status).toBe(403);
    expect(write.body.code).toBe(conversationMode ? "conversation_turn_cancelled" : "agent_run_cancelled");
    const read = await request(client).get(endpoint).set("Authorization", `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(read.body.readable).toBe(true);
  });

  it("keeps header-less local requests as the implicit board actor with their run id", async () => {
    const runId = randomUUID();
    const { db } = createDbState({ agent: { id: randomUUID() } });

    const res = await request(createApp(db, "local_trusted"))
      .get("/actor")
      .set("X-Paperclip-Run-Id", runId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ type: "board", userId: "local-board", runId });
  });

  it.each([
    ["empty bearer token", "Bearer   ", "Empty bearer token"],
    ["unverified token", "Bearer not-a-token", "Agent token did not verify"],
  ])("rejects %s instead of retaining the implicit local-board actor", async (_label, authorization, error) => {
    const { db } = createDbState({ agent: { id: randomUUID() } });
    let commentWrites = 0;
    const app = createApp(db, "local_trusted");
    app.post("/comments", (_req, res) => {
      commentWrites += 1;
      res.status(201).json({ ok: true });
    });

    const res = await request(app).post("/comments").set("Authorization", authorization).send({ body: "reply" });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain(error);
    expect(commentWrites).toBe(0);
  });

  it.each(["authenticated", "local_trusted"] as const)(
    "leaves webhook authentication to the trigger in %s mode",
    async (deploymentMode) => {
      const { db } = createDbState({ agent: { id: randomUUID() } });
      const res = await request(createApp(db, deploymentMode))
        .post(`/api/routine-triggers/public/${"a".repeat(24)}/fire`)
        .set("Authorization", "Bearer routine-secret")
        .send({ event: "created" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ reachedWebhook: true, actorType: "none" });
    },
  );

  it.each([
    `/api/routine-triggers/public/${"a".repeat(24)}/rotate-secret`,
    "/api/routine-triggers/public/not-a-public-id/fire",
    `/api/routine-triggers/public/${"a".repeat(24)}/fire/extra`,
  ])("does not bypass actor authentication for %s", async (path) => {
    const { db } = createDbState({ agent: { id: randomUUID() } });
    const res = await request(createApp(db)).post(path).set("Authorization", "Bearer routine-secret");
    expect(res.status).toBe(401);
  });

  it("leaves public MCP gateway bearers for the gateway protocol to validate", async () => {
    const { db } = createDbState({ agent: { id: randomUUID() } });
    const publicId = `gw_${"a".repeat(32)}`;

    const res = await request(createApp(db, "local_trusted"))
      .post(`/mcp/gateways/${publicId}`)
      .set("Authorization", "Bearer pcgw_runtime_token")
      .send({ jsonrpc: "2.0", id: 1, method: "initialize" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ reachedGatewayProtocol: true });
  });

  it("does not bypass actor authentication for lookalike MCP gateway paths", async () => {
    const { db } = createDbState({ agent: { id: randomUUID() } });

    const res = await request(createApp(db, "local_trusted"))
      .post("/mcp/gateways/not-a-public-id")
      .set("Authorization", "Bearer pcgw_runtime_token")
      .send({ jsonrpc: "2.0", id: 1, method: "initialize" });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Agent token did not verify");
  });

  it.each([
    ["terminated", "Agent is terminated"],
    ["pending_approval", "Agent is pending approval"],
  ])("rejects a %s agent JWT instead of retaining local-board", async (status, error) => {
    const agentId = randomUUID();
    const runId = randomUUID();
    const { db } = createDbState({ agent: { id: agentId, status } });
    const token = createLocalAgentJwt(agentId, "codex_local", runId, "user-1");

    const res = await request(createApp(db, "local_trusted"))
      .get("/actor")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain(error);
  });

  it("reports an expired agent JWT specifically", async () => {
    const agentId = randomUUID();
    const runId = randomUUID();
    const { db } = createDbState({ agent: { id: agentId } });
    const token = craftAgentJwtWithoutResponsibleClaim({
      secret: process.env.PAPERCLIP_AGENT_JWT_SECRET!,
      agentId,
      adapterType: "codex_local",
      runId,
      expiresInSeconds: -1,
    });

    const res = await request(createApp(db, "local_trusted"))
      .get("/actor")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Expired agent token");
  });

  it("uses the signed responsible_user_id claim and keeps the signed run id authoritative", async () => {
    const agentId = randomUUID();
    const runId = randomUUID();
    const { db } = createDbState({
      agent: { id: agentId },
      run: { id: runId, agentId, responsibleUserId: "user-row" },
    });
    const token = createLocalAgentJwt(agentId, "codex_local", runId, "user-claim");

    const res = await request(createApp(db))
      .get("/actor")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Paperclip-Run-Id", runId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type: "agent",
      agentId,
      runId,
      onBehalfOfUserId: "user-claim",
      source: "agent_jwt",
    });
  });

  it("preserves signed skill_test JWT scope on the request actor", async () => {
    const agentId = randomUUID();
    const runId = randomUUID();
    const issueId = randomUUID();
    const { db } = createDbState({
      agent: { id: agentId },
      run: { id: runId, agentId, responsibleUserId: "user-claim" },
    });
    const token = createLocalAgentJwt(agentId, "codex_local", runId, "user-claim", {
      kind: "skill_test",
      issueId,
    });

    const res = await request(createApp(db))
      .get("/actor")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Paperclip-Run-Id", runId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type: "agent",
      agentId,
      keyScope: { kind: "skill_test", issueId },
      source: "agent_jwt",
    });
  });

  it("rejects mismatched run headers for agent JWTs and audits the spoof attempt", async () => {
    const agentId = randomUUID();
    const runId = randomUUID();
    const spoofedRunId = randomUUID();
    const { db, activity } = createDbState({
      agent: { id: agentId },
      run: { id: runId, agentId, responsibleUserId: "user-claim" },
    });
    const token = createLocalAgentJwt(agentId, "codex_local", runId, "user-claim");

    const res = await request(createApp(db))
      .get("/actor")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Paperclip-Run-Id", spoofedRunId);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("agent_jwt_run_id_mismatch");
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      actorType: "agent",
      actorId: agentId,
      action: "auth.agent_jwt_run_header_mismatch",
      entityType: "heartbeat_run",
      entityId: runId,
      runId,
      details: { claimRunId: runId, headerRunId: spoofedRunId },
    });
  });

  it("falls back to the run row responsible user for legacy claim-less agent JWTs", async () => {
    const agentId = randomUUID();
    const runId = randomUUID();
    const { db } = createDbState({
      agent: { id: agentId },
      run: { id: runId, agentId, responsibleUserId: "user-legacy" },
    });
    const token = craftAgentJwtWithoutResponsibleClaim({
      secret: process.env.PAPERCLIP_AGENT_JWT_SECRET!,
      agentId,
      adapterType: "codex_local",
      runId,
    });

    const res = await request(createApp(db))
      .get("/actor")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type: "agent",
      runId,
      onBehalfOfUserId: "user-legacy",
      source: "agent_jwt",
    });
  });

  it("rejects fork-minted run JWTs before issue reads or writes reach live issue data", async () => {
    const agentId = randomUUID();
    const runId = randomUUID();
    const issueId = randomUUID();
    const { db } = createDbState({
      agent: { id: agentId },
      run: { id: runId, agentId, responsibleUserId: "user-claim" },
    });

    process.env.PAPERCLIP_INSTANCE_ID = "pap-12899-worktree";
    const forkToken = createLocalAgentJwt(agentId, "codex_local", runId, "user-claim");
    expect(forkToken).not.toBeNull();

    process.env.PAPERCLIP_INSTANCE_ID = "default";
    const app = createApp(db);
    const readRes = await request(app)
      .get(`/issues/${issueId}`)
      .set("Authorization", `Bearer ${forkToken}`)
      .set("X-Paperclip-Run-Id", runId);
    const writeRes = await request(app)
      .patch(`/issues/${issueId}`)
      .set("Authorization", `Bearer ${forkToken}`)
      .set("X-Paperclip-Run-Id", runId)
      .send({ title: "should not write" });

    expect(readRes.status).toBe(401);
    expect(writeRes.status).toBe(401);
  });

  it("populates agent-key actors from the key responsible user binding", async () => {
    const agentId = randomUUID();
    const token = "pcp_test_agent_key";
    const { db } = createDbState({
      agent: { id: agentId },
      agentKey: {
        id: randomUUID(),
        agentId,
        keyHash: hashToken(token),
        responsibleUserId: "user-key",
      },
    });

    const res = await request(createApp(db))
      .get("/actor")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type: "agent",
      agentId,
      onBehalfOfUserId: "user-key",
      source: "agent_key",
    });
  });

  it("rejects agent keys that lack a responsible user binding and audits the denial", async () => {
    const agentId = randomUUID();
    const keyId = randomUUID();
    const token = "pcp_test_agent_key_without_user";
    const { db, activity } = createDbState({
      agent: { id: agentId },
      agentKey: {
        id: keyId,
        agentId,
        keyHash: hashToken(token),
        responsibleUserId: null,
      },
    });

    const res = await request(createApp(db))
      .get(`/protected`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("RESPONSIBLE_USER_UNAVAILABLE");
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      actorType: "agent",
      actorId: agentId,
      action: "auth.agent_key_missing_responsible_user",
      entityType: "agent_api_key",
      entityId: keyId,
      details: { method: "GET", url: `/protected` },
    });
  });
});
