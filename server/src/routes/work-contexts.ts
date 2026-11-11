import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { heartbeatRuns, issues } from "@paperclipai/db";
import {
  executionLocationSchema,
  handoffWorkContextSchema,
  setExecutionLocationSchema,
  workContextClientSessionSchema,
  type ExecutionLocation,
} from "@paperclipai/shared";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { badRequest, conflict } from "../errors.js";
import { logger } from "../middleware/logger.js";
import { subscribeLiveEvents } from "../services/live-events.js";
import { heartbeatService, logActivity } from "../services/index.js";
import { workContextService } from "../services/work-contexts.js";
import { callMachineRpc, getMachineHello, isMachineConnected } from "../services/machine-connections.js";
import { latestMirrorSnapshot, withWorkContextMove, workContextSyncService } from "../services/work-context-sync.js";
import { assertBoardOrgAccess, getActorInfo } from "./authz.js";
import { machineViewer } from "./machines.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TERMINAL_WAIT_MS = 60_000;
const SWEEP_INTERVAL_MS = 30_000;

const runWorkContextSchema = z.object({
  location: executionLocationSchema.optional(),
  clientSessionId: z.string().trim().min(1).max(128).optional().nullable(),
  reason: z.string().trim().max(200).optional(),
});

const setLocationBodySchema = setExecutionLocationSchema.extend({
  clientSessionId: z.string().trim().min(1).max(128).optional().nullable(),
});

function issueIdParam(req: Request) {
  const id = String(req.params.issueId ?? "").trim();
  if (!UUID_PATTERN.test(id)) throw badRequest("Invalid issue id");
  return id;
}

function describeLocation(location: ExecutionLocation) {
  return location.kind === "server" ? { kind: "server" } : { kind: "machine", machineId: location.machineId };
}

/** Containers stay warm between runs; they stop only when the work leaves the machine or pauses. */
function stopDevcontainer(machineId: string | null, workspaceFolder: string | null) {
  if (!machineId || !workspaceFolder || !getMachineHello(machineId)?.capabilities?.docker) return;
  void callMachineRpc(machineId, "devcontainer.down", { workspaceFolder }, 120_000).catch((err) =>
    logger.warn({ err, machineId }, "stopping the dev container failed"),
  );
}

export function workContextRoutes(
  db: Db,
  opts: Pick<NonNullable<Parameters<typeof heartbeatService>[1]>, "pluginWorkerManager"> = {},
) {
  const router = Router();
  const contexts = workContextService(db);
  const sync = workContextSyncService(db);
  const heartbeat = heartbeatService(db, { pluginWorkerManager: opts.pluginWorkerManager });

  async function logMutation(req: Request, action: string, issueId: string, details: Record<string, unknown>) {
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action,
      entityType: "issue",
      entityId: issueId,
      details,
    });
  }

  async function waitForRunToStop(issueId: string, runId: string) {
    const deadline = Date.now() + TERMINAL_WAIT_MS;
    while (Date.now() < deadline) {
      const current = await contexts.lockingRun(issueId);
      if (!current || current.id !== runId) return true;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  }

  async function wakeAssignee(issueId: string, reason: string, actor: ReturnType<typeof getActorInfo>, extra: Record<string, unknown> = {}) {
    const agentId = await db
      .select({ assigneeAgentId: issues.assigneeAgentId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0]?.assigneeAgentId ?? null);
    if (!agentId) throw conflict("The issue has no assigned agent to run");
    return heartbeat.wakeup(agentId, {
      source: "on_demand",
      triggerDetail: "manual",
      reason,
      payload: { issueId, ...extra },
      requestedByActorType: actor.actorType === "agent" ? "agent" : "user",
      requestedByActorId: actor.actorId,
      contextSnapshot: { issueId, source: "work_context", ...extra },
    });
  }

  async function stopContextRuns(issueId: string, reason: string) {
    const run = await contexts.lockingRun(issueId);
    if (!run) return true;
    await heartbeat.cancelRun(run.id, reason);
    return waitForRunToStop(issueId, run.id);
  }

  router.get("/issues/:issueId/work-context", async (req, res) => {
    assertBoardOrgAccess(req);
    res.json(await contexts.getState(issueIdParam(req)));
  });

  /** Without this a machine would run, and later publish, stale files after an idle move. */
  async function bringLocationUpToDate(issueId: string, previousMachineId: string | null) {
    const current = await contexts.getActiveRow(issueId);
    if (!current?.machineId || current.machineId === previousMachineId) return;
    if (!(await latestMirrorSnapshot(issueId))) return;
    const result = await sync.materializeOnMachine(issueId);
    if (result?.status === "conflict") {
      throw conflict(`The machine has local changes in this issue's files: ${result.localChanges.slice(0, 10).join(", ")}`);
    }
  }

  /** Changes made on the source after its last snapshot would otherwise stay behind on an idle move. */
  async function saveSourceBeforeMove(issueId: string, target: ExecutionLocation) {
    const source = await contexts.getActiveRow(issueId);
    const targetMachineId = target.kind === "machine" ? target.machineId : null;
    if (!source?.machineId || !source.remotePath || source.machineId === targetMachineId) return;
    if (!isMachineConnected(source.machineId) || (await contexts.lockingRun(issueId))) return;
    await sync.snapshotFromMachine(issueId);
  }

  router.put("/issues/:issueId/execution-location", validate(setLocationBodySchema), async (req, res) => {
    assertBoardOrgAccess(req);
    const issueId = issueIdParam(req);
    await withWorkContextMove(issueId, async () => {
      const previous = await contexts.getActiveRow(issueId);
      await saveSourceBeforeMove(issueId, req.body.location);
      await contexts.setLocation(issueId, req.body.location, machineViewer(req), req.body.clientSessionId);
      await logMutation(req, "work_context.location_set", issueId, { location: describeLocation(req.body.location) });
      if (req.body.location.kind === "machine" && isMachineConnected(req.body.location.machineId)) {
        await bringLocationUpToDate(issueId, previous?.machineId ?? null);
      }
    });
    res.json(await contexts.getState(issueId));
  });

  router.post("/issues/:issueId/work-context/run", validate(runWorkContextSchema), async (req, res) => {
    assertBoardOrgAccess(req);
    const issueId = issueIdParam(req);
    const run = await withWorkContextMove(issueId, () => moveAndRun(req, issueId));
    res.status(202).json({ runId: run?.id ?? null, state: await contexts.getState(issueId) });
  });

  async function moveAndRun(req: Request, issueId: string) {
    const previous = await contexts.getActiveRow(issueId);
    if (req.body.location) {
      await saveSourceBeforeMove(issueId, req.body.location);
      await contexts.setLocation(issueId, req.body.location, machineViewer(req), req.body.clientSessionId);
    } else if (req.body.clientSessionId !== undefined) {
      const current = await contexts.getActiveRow(issueId);
      await contexts.setLocation(
        issueId,
        current?.machineId ? { kind: "machine", machineId: current.machineId } : { kind: "server" },
        machineViewer(req),
        req.body.clientSessionId,
      );
    }
    await contexts.resumeIfPaused(issueId);
    await bringLocationUpToDate(issueId, previous?.machineId ?? null);
    const actor = getActorInfo(req);
    const run = await wakeAssignee(issueId, req.body.reason ?? "work_context_run", actor);
    await logMutation(req, "work_context.run_requested", issueId, {
      location: req.body.location ? describeLocation(req.body.location) : null,
      runId: run?.id ?? null,
    });
    return run;
  }

  router.post("/issues/:issueId/work-context/handoff", validate(handoffWorkContextSchema), async (req, res) => {
    assertBoardOrgAccess(req);
    const issueId = issueIdParam(req);
    await withWorkContextMove(issueId, () => handoff(req, res, issueId));
  });

  async function handoff(req: Request, res: Response, issueId: string) {
    const from = await contexts.getActiveRow(issueId);
    const target: ExecutionLocation = req.body.to;
    if ((from?.machineId ?? null) === (target.kind === "machine" ? target.machineId : null)) {
      throw conflict("The work is already at that location");
    }
    await contexts.markStatus(issueId, "handoff_pending");
    const stall = async (error: string, details: Record<string, unknown> = {}) => {
      await contexts.markStatus(issueId, "recovery_pending");
      await logMutation(req, "work_context.handoff_stalled", issueId, { to: describeLocation(target), error, ...details });
      res.status(409).json({ error, state: await contexts.getState(issueId) });
    };
    const stopped = await stopContextRuns(issueId, "Moved to another execution location");
    if (!stopped) {
      await stall("The current run did not confirm cancellation. The work stays where it is until it does.");
      return;
    }
    let finalSnapshot: { seq: number; commit: string } | null = null;
    if (from?.machineId) {
      if (isMachineConnected(from.machineId)) {
        try {
          finalSnapshot = await sync.snapshotFromMachine(issueId);
        } catch (error) {
          await stall(`Could not take the final snapshot: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }
      } else if (!req.body.useLastSnapshot) {
        await stall(
          "The machine holding the work is offline, so its latest changes cannot be saved. Reconnect it, or move the work using the last stored snapshot.",
          { lastSnapshot: await latestMirrorSnapshot(issueId) },
        );
        return;
      }
    }
    await contexts.setLocation(issueId, target, machineViewer(req), null);
    if (target.kind === "machine") {
      let materialized;
      try {
        materialized = await sync.materializeOnMachine(issueId);
      } catch (error) {
        await stall(`Could not bring the files to the target machine: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      if (materialized?.status === "conflict") {
        await stall("The target machine has local changes in this issue's files. Resolve them before continuing.", {
          localChanges: materialized.localChanges,
        });
        return;
      }
    }
    const actor = getActorInfo(req);
    const run = await wakeAssignee(issueId, "work_context_handoff", actor, {
      handoffFromMachineId: from?.machineId ?? null,
    });
    stopDevcontainer(from?.machineId ?? null, from?.remotePath ?? null);
    await logMutation(req, "work_context.handed_off", issueId, {
      fromMachineId: from?.machineId ?? null,
      to: describeLocation(target),
      runId: run?.id ?? null,
      snapshot: finalSnapshot,
      usedLastSnapshot: Boolean(req.body.useLastSnapshot && !finalSnapshot),
    });
    res.json({ runId: run?.id ?? null, state: await contexts.getState(issueId) });
  }

  router.post("/issues/:issueId/work-context/sync", async (req, res) => {
    assertBoardOrgAccess(req);
    const issueId = issueIdParam(req);
    const snapshot = await withWorkContextMove(issueId, () => sync.snapshotFromMachine(issueId));
    await logMutation(req, "work_context.synced", issueId, { snapshot });
    res.json({ snapshot, state: await contexts.getState(issueId) });
  });

  router.post("/work-contexts/client-sessions", validate(workContextClientSessionSchema), async (req, res) => {
    assertBoardOrgAccess(req);
    await contexts.touchClientSession(req.body.clientSessionId);
    res.json({ ok: true });
  });

  router.delete("/work-contexts/client-sessions/:clientSessionId", async (req, res) => {
    assertBoardOrgAccess(req);
    const clientSessionId = String(req.params.clientSessionId ?? "").trim();
    if (!clientSessionId) throw badRequest("clientSessionId is required");
    const paused = await pauseClientSession(clientSessionId);
    res.json({ pausedIssueIds: paused });
  });

  /** Closing the window pauses only that window's runs on machines; server runs keep going. */
  async function pauseClientSession(clientSessionId: string) {
    const rows = await contexts.listContextsForClientSession(clientSessionId);
    const paused: string[] = [];
    for (const row of rows) {
      if (!row.machineId) continue;
      await stopContextRuns(row.issueId, "VS Code window closed");
      await contexts.pauseContext(row.id);
      stopDevcontainer(row.machineId, row.remotePath);
      paused.push(row.issueId);
    }
    return paused;
  }

  return router;
}

/** Started by the server process, not by the router, so test apps do not leak timers. */
export function startWorkContextSessionSweeper(
  db: Db,
  opts: Pick<NonNullable<Parameters<typeof heartbeatService>[1]>, "pluginWorkerManager"> = {},
) {
  const contexts = workContextService(db);
  const heartbeat = heartbeatService(db, { pluginWorkerManager: opts.pluginWorkerManager });
  const timer = setInterval(() => {
    void contexts
      .listStaleClientSessionContexts()
      .then(async (rows) => {
        for (const row of rows) {
          logger.info({ issueId: row.issueId, clientSessionId: row.clientSessionId }, "pausing work context of a silent VS Code window");
          const run = await contexts.lockingRun(row.issueId);
          if (run) await heartbeat.cancelRun(run.id, "VS Code window stopped responding");
          await contexts.pauseContext(row.id);
          stopDevcontainer(row.machineId, row.remotePath);
        }
      })
      .catch((err) => logger.warn({ err }, "work context client session sweep failed"));
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

const TERMINAL_RUN_STATUSES = new Set(["succeeded", "failed", "cancelled", "timed_out"]);

/** The mirror must hold the agent's last state even if the machine goes offline before the next handoff. */
export function startMachineRunSnapshotter(db: Db) {
  const sync = workContextSyncService(db);
  return subscribeLiveEvents((event) => {
    if (event.type !== "heartbeat.run.status") return;
    const runId = typeof event.payload?.runId === "string" ? event.payload.runId : null;
    const status = typeof event.payload?.status === "string" ? event.payload.status : null;
    if (!runId || !status || !TERMINAL_RUN_STATUSES.has(status)) return;
    void (async () => {
      const run = await db
        .select({ machineId: heartbeatRuns.executionMachineId, contextSnapshot: heartbeatRuns.contextSnapshot })
        .from(heartbeatRuns)
        .where(eq(heartbeatRuns.id, runId))
        .then((rows) => rows[0] ?? null);
      const issueId = typeof run?.contextSnapshot?.issueId === "string" ? run.contextSnapshot.issueId : null;
      if (!run?.machineId || !issueId || !isMachineConnected(run.machineId)) return;
      const machineId = run.machineId;
      await withWorkContextMove(issueId, async () => {
        if (!(await sync.activeMachineContextForRun(issueId, machineId))) return;
        await sync.snapshotFromMachine(issueId);
      });
    })().catch((err) => logger.warn({ err, runId }, "snapshot after machine run failed"));
  });
}
