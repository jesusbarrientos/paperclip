import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  createDb,
  environments,
  heartbeatRunEvents,
  heartbeatRuns,
  issues,
  machines,
  workContexts,
} from "@paperclipai/db";
import { MACHINE_SANDBOX_PROVIDER } from "@paperclipai/shared";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { registerMachineConnection, resetMachineConnectionsForTests } from "../services/machine-connections.js";
import { machineService } from "../services/machines.js";
import { CLIENT_SESSION_TIMEOUT_MS, MachineExecutionUnavailableError, workContextService } from "../services/work-contexts.js";
import { workContextSyncService } from "../services/work-context-sync.js";
import { createEventFilter, parseSubscription, replayRunEvents } from "../realtime/live-events-ws.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres machine tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

const owner = { userId: "user-owner", isInstanceAdmin: false };
const stranger = { userId: "user-other", isInstanceAdmin: false };
const admin = { userId: "user-admin", isInstanceAdmin: true };

function connectFake(machineId: string) {
  return registerMachineConnection({ machineId, send: () => {}, close: () => {} });
}

describeEmbeddedPostgres("machines and work contexts", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-machines-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    resetMachineConnectionsForTests();
    await db.delete(workContexts);
    await db.delete(heartbeatRunEvents);
    await db.delete(heartbeatRuns);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(machines);
    await db.delete(environments);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function pairedMachine(viewer = owner, shared = false) {
    const svc = machineService(db);
    const started = await svc.startPairing({ name: "Mac", platform: "darwin", arch: "arm64" });
    await svc.approvePairing(started.machine.id, started.token, { ...viewer, userId: viewer.userId, shared });
    const claim = await svc.claimPairing(started.machine.id, started.token);
    if (claim.status !== "authorized") throw new Error(`unexpected claim ${claim.status}`);
    return { machineId: started.machine.id, credential: claim.credential };
  }

  async function issueWithAgent() {
    const agentId = randomUUID();
    const issueId = randomUUID();
    await db.insert(agents).values({ id: agentId, name: "Builder", role: "engineer", status: "idle", adapterType: "claude_local" });
    await db.insert(issues).values({ id: issueId, title: "Task", status: "todo", priority: "medium", assigneeAgentId: agentId });
    return { agentId, issueId };
  }

  describe("pairing", () => {
    it("issues the credential once and creates the machine environment", async () => {
      const svc = machineService(db);
      const started = await svc.startPairing({ name: "Mac", platform: "darwin", arch: "arm64" });
      await expect(svc.claimPairing(started.machine.id, started.token)).resolves.toEqual({ status: "pending" });

      const approved = await svc.approvePairing(started.machine.id, started.token, { ...owner, shared: false });
      expect(approved.status).toBe("authorized");
      const [environment] = await db.select().from(environments).where(eq(environments.id, approved.environmentId!));
      expect(environment!.config).toMatchObject({ provider: MACHINE_SANDBOX_PROVIDER, machineId: approved.id });

      const claim = await svc.claimPairing(started.machine.id, started.token);
      expect(claim.status).toBe("authorized");
      // The pairing token is cleared after the first claim, so it cannot mint a second credential.
      await expect(svc.claimPairing(started.machine.id, started.token)).rejects.toThrow(/not found/i);
      if (claim.status === "authorized") {
        await expect(svc.authenticateCredential(claim.credential)).resolves.toMatchObject({ id: started.machine.id });
      }
    });

    it("rejects a wrong token and a shared machine approved by a non-admin", async () => {
      const svc = machineService(db);
      const started = await svc.startPairing({ name: "Ubuntu", platform: "linux", arch: "x64" });
      await expect(svc.describePairing(started.machine.id, "pcmp_wrong", { ...owner, signedIn: true })).rejects.toThrow(
        /not found/i,
      );
      await expect(
        svc.approvePairing(started.machine.id, started.token, { ...owner, shared: true }),
      ).rejects.toThrow(/instance admin/);
    });

    it("hides personal machines from other users and lets only the owner revoke", async () => {
      const { machineId, credential } = await pairedMachine();
      const svc = machineService(db);
      expect((await svc.list(owner)).map((machine) => machine.id)).toEqual([machineId]);
      expect(await svc.list(stranger)).toEqual([]);
      await expect(svc.revoke(machineId, stranger)).rejects.toThrow(/not found/i);

      const revoked = await svc.revoke(machineId, owner);
      expect(revoked.status).toBe("revoked");
      await expect(svc.authenticateCredential(credential)).resolves.toBeNull();
      const [environment] = await db.select().from(environments).where(eq(environments.id, revoked.environmentId!));
      expect(environment!.status).toBe("archived");
    });
  });

  describe("work contexts", () => {
    it("moves an idle issue between locations and bumps the fencing token", async () => {
      const { machineId } = await pairedMachine();
      const { issueId } = await issueWithAgent();
      const contexts = workContextService(db);

      const first = await contexts.setLocation(issueId, { kind: "server" }, owner);
      const second = await contexts.setLocation(issueId, { kind: "machine", machineId }, owner);
      expect(second.fencingToken).toBe(first.fencingToken + 1);
      const rows = await db.select().from(workContexts).where(eq(workContexts.issueId, issueId));
      expect(rows.filter((row) => row.active)).toHaveLength(1);
      expect(rows.find((row) => row.id === first.id)!.status).toBe("closed");
    });

    it("refuses to move a running issue without a handoff", async () => {
      const { machineId } = await pairedMachine();
      const { agentId, issueId } = await issueWithAgent();
      const contexts = workContextService(db);
      await contexts.setLocation(issueId, { kind: "server" }, owner);
      await db.insert(heartbeatRuns).values({ agentId, status: "running", contextSnapshot: { issueId } });

      await expect(contexts.setLocation(issueId, { kind: "machine", machineId }, owner)).rejects.toThrow(/handoff/);
      const state = await contexts.getState(issueId);
      expect(state.context?.editLocked).toBe(true);
    });

    it("does not let another user run work on a personal machine", async () => {
      const { machineId } = await pairedMachine();
      const { issueId } = await issueWithAgent();
      await expect(
        workContextService(db).setLocation(issueId, { kind: "machine", machineId }, stranger),
      ).rejects.toThrow(/cannot run work/);
      await expect(
        workContextService(db).setLocation(issueId, { kind: "machine", machineId }, admin),
      ).rejects.toThrow(/cannot run work/);
    });

    it("routes runs to the machine only while it is connected", async () => {
      const { machineId } = await pairedMachine();
      const { issueId } = await issueWithAgent();
      const contexts = workContextService(db);
      await expect(contexts.resolveRunEnvironment(issueId)).resolves.toBeNull();

      await contexts.setLocation(issueId, { kind: "machine", machineId }, owner);
      await expect(contexts.resolveRunEnvironment(issueId)).rejects.toBeInstanceOf(MachineExecutionUnavailableError);

      connectFake(machineId);
      const [machine] = await db.select().from(machines).where(eq(machines.id, machineId));
      await expect(contexts.resolveRunEnvironment(issueId)).resolves.toEqual({
        machineId,
        environmentId: machine!.environmentId,
      });

      await machineService(db).revoke(machineId, owner);
      await expect(contexts.resolveRunEnvironment(issueId)).rejects.toThrow(/no longer authorized/);
    });

    it("lists machine contexts whose VS Code window went silent", async () => {
      const { machineId } = await pairedMachine();
      const { issueId } = await issueWithAgent();
      const contexts = workContextService(db);
      const row = await contexts.setLocation(issueId, { kind: "machine", machineId }, owner, "window-1");

      expect(await contexts.listStaleClientSessionContexts()).toEqual([]);
      const stale = await contexts.listStaleClientSessionContexts(Date.now() + CLIENT_SESSION_TIMEOUT_MS + 1000);
      expect(stale.map((context) => context.id)).toEqual([row.id]);

      await contexts.pauseContext(row.id);
      expect((await contexts.getState(issueId)).context).toMatchObject({ status: "paused", clientSessionId: null });
      await contexts.resumeIfPaused(issueId);
      expect((await contexts.getState(issueId)).context?.status).toBe("active");
    });
  });

  describe("snapshot uploads", () => {
    it("refuses a writer whose fencing token is stale without crashing the process", async () => {
      const { machineId } = await pairedMachine();
      const { issueId } = await issueWithAgent();
      const context = await workContextService(db).setLocation(issueId, { kind: "machine", machineId }, owner);
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on("unhandledRejection", onUnhandled);
      try {
        await expect(
          workContextSyncService(db).acceptUpload({
            issueId,
            machineId,
            seq: 1,
            commit: "a".repeat(40),
            fencingToken: context.fencingToken - 1,
            bundle: Buffer.from("x"),
          }),
        ).rejects.toThrow(/stale_fencing_token/);
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(unhandled).toEqual([]);
      } finally {
        process.off("unhandledRejection", onUnhandled);
      }
    });
  });

  describe("live events subscription", () => {
    it("follows the runs of the subscribed issue and matches activity by entity", () => {
      const accepts = createEventFilter(parseSubscription(new URL("ws://x/api/events/ws?issueId=i1")));
      const event = (type: string, payload: Record<string, unknown>) =>
        ({ id: 1, type, createdAt: "", payload }) as Parameters<typeof accepts>[0];

      expect(accepts(event("heartbeat.run.event", { runId: "r2", seq: 1 }))).toBe(false);
      expect(accepts(event("heartbeat.run.status", { runId: "r1", issueId: "i1" }))).toBe(true);
      expect(accepts(event("heartbeat.run.event", { runId: "r1", seq: 1 }))).toBe(true);
      expect(accepts(event("activity.logged", { entityType: "issue", entityId: "i1", action: "issue.comment_added" }))).toBe(true);
      expect(accepts(event("activity.logged", { entityType: "issue", entityId: "i2" }))).toBe(false);

      const typed = createEventFilter(parseSubscription(new URL("ws://x/api/events/ws?types=machine.status")));
      expect(typed(event("machine.status", { machineId: "m1" }))).toBe(true);
      expect(typed(event("agent.status", {}))).toBe(false);
    });

    it("replays run events after the cursor and then signals completion", async () => {
      const { agentId } = await issueWithAgent();
      const [run] = await db.insert(heartbeatRuns).values({ agentId, status: "running" }).returning();
      await db.insert(heartbeatRunEvents).values(
        [1, 2, 3].map((seq) => ({ runId: run!.id, agentId, seq, eventType: "log", message: `line ${seq}` })),
      );
      const frames: Array<{ type: string; replay?: boolean; payload: Record<string, unknown> }> = [];
      const socket = { readyState: 1, send: (data: string) => frames.push(JSON.parse(data)) };

      await replayRunEvents(db, socket as never, run!.id, 1);
      expect(frames.map((frame) => frame.type)).toEqual(["heartbeat.run.event", "heartbeat.run.event", "replay.complete"]);
      expect(frames.slice(0, 2).map((frame) => frame.payload.seq)).toEqual([2, 3]);
      expect(frames[2]!.payload).toMatchObject({ count: 2, truncated: false });
    });
  });
});
