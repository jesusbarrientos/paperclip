import { organizationService } from "../services/organization.js";
import { Router, urlencoded, type Request } from "express";
import type { Db } from "@paperclipai/db";
import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import {
  createSmokeRunSchema,
  recordSmokeRunStepSchema,
  updateSmokeRunSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertBoard, assertBoardOrAgent, assertOrgAccess, getActorInfo } from "./authz.js";
import { logActivity, smokeLabService } from "../services/index.js";

function configuredPublicBaseUrl() {
  const raw = (
    process.env.PAPERCLIP_PUBLIC_URL?.trim()
    || process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL?.trim()
    || process.env.BETTER_AUTH_URL?.trim()
    || process.env.BETTER_AUTH_BASE_URL?.trim()
  );
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function requestBaseUrl(req: Request) {
  const configured = configuredPublicBaseUrl();
  if (configured) return configured;
  const host = req.get("host")?.trim() || req.hostname;
  return `${req.protocol}://${host}`;
}

function smokeLabBaseUrl(req: Request) {
  return `${requestBaseUrl(req)}/api/smoke-lab`;
}

function stringBodyValue(body: unknown, key: string) {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export function smokeLabRoutes(db: Db, options: {
  deploymentMode?: DeploymentMode;
  deploymentExposure?: DeploymentExposure;
  nodeEnv?: string;
} = {}) {
  const router = Router();
  const svc = smokeLabService(db, options);
  const formParser = urlencoded({ extended: false });

  async function assertSmokeLabEnabled() {
    await svc.assertEnabled();
  }

  router.get("/smoke-lab/oauth/authorize", async (req, res) => {
    await assertSmokeLabEnabled();
    res.type("html").send(svc.oauthAuthorizePage({
      clientId: String(req.query.client_id ?? "smoke-client"),
      redirectUri: String(req.query.redirect_uri ?? "http://127.0.0.1/callback"),
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      scope: typeof req.query.scope === "string" ? req.query.scope : undefined,
      responseType: typeof req.query.response_type === "string" ? req.query.response_type : undefined,
      requestOrigin: configuredPublicBaseUrl() ?? undefined,
    }));
  });

  router.post("/smoke-lab/oauth/authorize", formParser, async (req, res) => {
    await assertSmokeLabEnabled();
    const location = svc.completeAuthorize({
      clientId: stringBodyValue(req.body, "client_id") ?? "smoke-client",
      redirectUri: stringBodyValue(req.body, "redirect_uri") ?? "http://127.0.0.1/callback",
      state: stringBodyValue(req.body, "state"),
      scope: stringBodyValue(req.body, "scope"),
      email: stringBodyValue(req.body, "email"),
      password: stringBodyValue(req.body, "password"),
      requestOrigin: configuredPublicBaseUrl() ?? undefined,
    });
    res.redirect(302, location);
  });

  router.post("/smoke-lab/oauth/token", formParser, async (req, res) => {
    await assertSmokeLabEnabled();
    res.json(svc.issueToken({
      grantType: stringBodyValue(req.body, "grant_type"),
      code: stringBodyValue(req.body, "code"),
      refreshToken: stringBodyValue(req.body, "refresh_token"),
      clientId: stringBodyValue(req.body, "client_id"),
      redirectUri: stringBodyValue(req.body, "redirect_uri"),
    }));
  });

  router.get("/smoke-lab/oauth/userinfo", async (req, res) => {
    await assertSmokeLabEnabled();
    res.json(svc.userinfo({
      authorization: req.get("authorization"),
    }));
  });

  router.post("/smoke-lab/oauth/revoke", formParser, async (req, res) => {
    await assertSmokeLabEnabled();
    res.json(svc.revoke({
      token: stringBodyValue(req.body, "token"),
    }));
  });

  router.get("/smoke-lab/services", async (req, res) => {
    assertBoard(req);
    assertOrgAccess(req);
    res.json(await svc.listServices(smokeLabBaseUrl(req)));
  });

  router.post("/smoke-lab/services/start", async (req, res) => {
    assertBoard(req);
    assertOrgAccess(req);
    const result = await svc.startServices(smokeLabBaseUrl(req));
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "smoke_lab.services_started",
      entityType: "smoke_lab",
      entityId: await organizationService(db).requireId(),
      details: { services: result.services.map((service) => service.id) },
    });
    res.json(result);
  });

  router.post("/smoke-lab/services/stop", async (req, res) => {
    assertBoard(req);
    assertOrgAccess(req);
    const result = await svc.stopServices(smokeLabBaseUrl(req));
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "smoke_lab.services_stopped",
      entityType: "smoke_lab",
      entityId: await organizationService(db).requireId(),
      details: { services: result.services.map((service) => service.id) },
    });
    res.json(result);
  });

  router.post("/smoke-lab/install-fixtures", async (req, res) => {
    assertBoard(req);
    assertOrgAccess(req);
    const result = await svc.installFixtures(getActorInfo(req));
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "smoke_lab.fixtures_installed",
      entityType: "smoke_lab",
      entityId: await organizationService(db).requireId(),
      details: {
        created: result.created,
        applicationIds: result.applications.map((application) => application.id),
        connectionIds: result.connections.map((connection) => connection.id),
        catalogEntryCount: result.catalog.length,
        profileId: result.profile.id,
      },
    });
    res.status(result.created ? 201 : 200).json(result);
  });

  router.get("/smoke-lab/runs", async (req, res) => {
    assertBoardOrAgent(req);
    assertOrgAccess(req);
    res.json(await svc.listRuns());
  });

  router.post("/smoke-lab/runs", validate(createSmokeRunSchema), async (req, res) => {
    assertBoardOrAgent(req);
    assertOrgAccess(req);
    const run = await svc.createRun(req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "smoke_lab.run_created",
      entityType: "smoke_run",
      entityId: run.id,
      details: { trigger: run.trigger },
    });
    res.status(201).json({ run });
  });

  router.get("/smoke-lab/runs/:runId", async (req, res) => {
    assertBoardOrAgent(req);
    assertOrgAccess(req);
    res.json(await svc.getRun(req.params.runId as string));
  });

  router.patch("/smoke-lab/runs/:runId", validate(updateSmokeRunSchema), async (req, res) => {
    assertBoardOrAgent(req);
    assertOrgAccess(req);
    const run = await svc.updateRun(req.params.runId as string, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "smoke_lab.run_updated",
      entityType: "smoke_run",
      entityId: run.id,
      details: { status: run.status },
    });
    res.json({ run });
  });

  router.post("/smoke-lab/runs/:runId/steps", validate(recordSmokeRunStepSchema), async (req, res) => {
    assertBoardOrAgent(req);
    assertOrgAccess(req);
    const result = await svc.recordStep(req.params.runId as string, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "smoke_lab.step_recorded",
      entityType: "smoke_run_step",
      entityId: result.step.id,
      details: { smokeRunId: req.params.runId, path: result.step.path, status: result.step.status },
    });
    res.status(201).json(result);
  });

  router.post("/smoke-lab/reset", async (req, res) => {
    assertBoard(req);
    assertOrgAccess(req);
    const result = await svc.reset();
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "smoke_lab.reset",
      entityType: "smoke_lab",
      entityId: await organizationService(db).requireId(),
      details: result,
    });
    res.json(result);
  });

  return router;
}
