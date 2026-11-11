import express, { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  MACHINE_CREDENTIAL_REJECTED_ERROR,
  MACHINE_FENCING_TOKEN_HEADER,
  MACHINE_SNAPSHOT_COMMIT_HEADER,
  MACHINE_SNAPSHOT_SEQ_HEADER,
  approveMachinePairingSchema,
  machinePairingClaimSchema,
  machinePairingStartSchema,
  updateMachineSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { badRequest, unauthorized } from "../errors.js";
import { logActivity } from "../services/index.js";
import { disconnectMachine } from "../services/machine-connections.js";
import { machineService, toMachine, type MachineViewer } from "../services/machines.js";
import { workContextSyncService } from "../services/work-context-sync.js";
import { assertBoardOrgAccess, getActorInfo } from "./authz.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SNAPSHOT_UPLOAD_LIMIT = "512mb";

function machineIdParam(req: Request) {
  const id = String(req.params.machineId ?? "").trim();
  if (!UUID_PATTERN.test(id)) throw badRequest("Invalid machine id");
  return id;
}

function issueIdParam(req: Request) {
  const id = String(req.params.issueId ?? "").trim();
  if (!UUID_PATTERN.test(id)) throw badRequest("Invalid issue id");
  return id;
}

function boardUserId(req: Request) {
  if (req.actor.type !== "board") return null;
  return req.actor.userId ?? (req.actor.source === "local_implicit" ? "local-board" : null);
}

export function machineViewer(req: Request): MachineViewer {
  return {
    userId: boardUserId(req),
    isInstanceAdmin:
      req.actor.type === "board" && (req.actor.source === "local_implicit" || Boolean(req.actor.isInstanceAdmin)),
  };
}

function requestBaseUrl(req: Request) {
  const configured = process.env.PAPERCLIP_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const host = req.header("host");
  return host ? `${req.protocol}://${host}` : null;
}

function bearer(req: Request) {
  const value = req.header("authorization");
  if (!value || !value.toLowerCase().startsWith("bearer ")) return null;
  return value.slice(7).trim() || null;
}

export function machineRoutes(db: Db) {
  const router = Router();
  const svc = machineService(db);
  const sync = workContextSyncService(db);

  router.post("/machines/pairings", validate(machinePairingStartSchema), async (req, res) => {
    const started = await svc.startPairing(req.body);
    const approvalPath = `/machines/pair/${started.machine.id}?token=${encodeURIComponent(started.token)}`;
    const baseUrl = requestBaseUrl(req);
    res.status(201).json({
      machineId: started.machine.id,
      token: started.token,
      approvalPath,
      approvalUrl: baseUrl ? `${baseUrl}${approvalPath}` : null,
      expiresAt: started.expiresAt.toISOString(),
      suggestedPollIntervalMs: 2000,
    });
  });

  router.post("/machines/pairings/:machineId/claim", validate(machinePairingClaimSchema), async (req, res) => {
    const result = await svc.claimPairing(machineIdParam(req), req.body.token);
    if (result.status === "authorized") {
      await logActivity(db, {
        actorType: "system",
        actorId: result.machineId,
        action: "machine.credential_issued",
        entityType: "machine",
        entityId: result.machineId,
        details: {},
      });
    }
    res.json(result);
  });

  router.get("/machines/pairings/:machineId", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) throw badRequest("Pairing token is required");
    const viewer = machineViewer(req);
    res.json(await svc.describePairing(machineIdParam(req), token, { ...viewer, signedIn: Boolean(viewer.userId) }));
  });

  router.post("/machines/pairings/:machineId/approve", validate(approveMachinePairingSchema), async (req, res) => {
    assertBoardOrgAccess(req);
    const viewer = machineViewer(req);
    if (!viewer.userId) throw unauthorized("Sign in before approving a machine");
    const machine = await svc.approvePairing(machineIdParam(req), req.body.token, {
      userId: viewer.userId,
      isInstanceAdmin: viewer.isInstanceAdmin,
      shared: req.body.shared === true,
    });
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "machine.authorized",
      entityType: "machine",
      entityId: machine.id,
      details: { name: machine.name, shared: machine.shared, platform: machine.platform, arch: machine.arch },
    });
    res.json(machine);
  });

  async function requireMachine(req: Request) {
    const row = await svc.authenticateCredential(bearer(req) ?? "");
    if (!row) throw unauthorized(MACHINE_CREDENTIAL_REJECTED_ERROR);
    return row;
  }

  /** Machine-credential identity check used by `paperclipai machine status`. */
  router.get("/machines/v1/self", async (req, res) => {
    res.json(toMachine(await requireMachine(req)));
  });

  router.put(
    "/machines/v1/issues/:issueId/snapshots/:seq",
    express.raw({ type: "application/octet-stream", limit: SNAPSHOT_UPLOAD_LIMIT }),
    async (req, res) => {
      const machine = await requireMachine(req);
      const seq = Number(req.params.seq);
      const fencingToken = Number(req.header(MACHINE_FENCING_TOKEN_HEADER));
      const commit = req.header(MACHINE_SNAPSHOT_COMMIT_HEADER)?.trim() ?? "";
      if (!Number.isInteger(seq) || seq < 1) throw badRequest("Invalid snapshot seq");
      if (!Number.isInteger(fencingToken)) throw badRequest("Missing fencing token");
      if (!COMMIT_PATTERN.test(commit)) throw badRequest("Missing snapshot commit");
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw badRequest("Snapshot bundle is required");
      const stored = await sync.acceptUpload({
        issueId: issueIdParam(req),
        machineId: machine.id,
        seq,
        commit,
        fencingToken,
        bundle: req.body,
      });
      await logActivity(db, {
        actorType: "system",
        actorId: machine.id,
        action: "work_context.snapshot_stored",
        entityType: "issue",
        entityId: issueIdParam(req),
        details: { machineId: machine.id, seq: stored.seq, commit: stored.commit, bytes: req.body.length },
      });
      res.json(stored);
    },
  );

  router.get("/machines/v1/issues/:issueId/snapshots/latest", async (req, res) => {
    const machine = await requireMachine(req);
    const have = typeof req.query.have === "string" && COMMIT_PATTERN.test(req.query.have) ? req.query.have : null;
    const latest = await sync.latestBundle(issueIdParam(req), machine.id, have);
    res.setHeader(MACHINE_SNAPSHOT_COMMIT_HEADER, latest.commit);
    res.setHeader(MACHINE_SNAPSHOT_SEQ_HEADER, String(latest.seq));
    if (!latest.file) {
      res.status(204).end();
      return;
    }
    res.setHeader("content-type", "application/octet-stream");
    res.sendFile(latest.file, (error) => {
      void sync.removeBundle(latest.file);
      if (error && !res.headersSent) res.status(500).end();
    });
  });

  router.get("/machines", async (req, res) => {
    assertBoardOrgAccess(req);
    res.json(await svc.list(machineViewer(req)));
  });

  router.get("/machines/:machineId", async (req, res) => {
    assertBoardOrgAccess(req);
    res.json(await svc.get(machineIdParam(req), machineViewer(req)));
  });

  router.patch("/machines/:machineId", validate(updateMachineSchema), async (req, res) => {
    assertBoardOrgAccess(req);
    const machineId = machineIdParam(req);
    const current = await svc.get(machineId, machineViewer(req));
    const updated = req.body.name ? await svc.rename(machineId, req.body.name, machineViewer(req)) : current;
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "machine.updated",
      entityType: "machine",
      entityId: machineId,
      details: { previousName: current.name, name: updated.name },
    });
    res.json(updated);
  });

  router.post("/machines/:machineId/revoke", async (req, res) => {
    assertBoardOrgAccess(req);
    const machineId = machineIdParam(req);
    const revoked = await svc.revoke(machineId, machineViewer(req));
    disconnectMachine(machineId, "revoked");
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "machine.revoked",
      entityType: "machine",
      entityId: machineId,
      details: { name: revoked.name },
    });
    res.json(revoked);
  });

  return router;
}
