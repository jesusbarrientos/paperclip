import { organizationService } from "../services/organization.js";
import { Router, type Request, type Response } from "express";
import type { Db } from "@paperclipai/db";
import { upsertSidebarOrderPreferenceSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, sidebarPreferenceService } from "../services/index.js";
import { assertBoard, assertOrgAccess, getActorInfo } from "./authz.js";

function requireBoardUserId(req: Request, res: Response): string | null {
  assertBoard(req);
  if (!req.actor.userId) {
    res.status(403).json({ error: "Board user context required" });
    return null;
  }
  return req.actor.userId;
}

export function sidebarPreferenceRoutes(db: Db) {
  const router = Router();
  const svc = sidebarPreferenceService(db);

  router.get("/sidebar-preferences/me", async (req, res) => {
    assertOrgAccess(req);
    const userId = requireBoardUserId(req, res);
    if (!userId) return;
    res.json(await svc.getProjectOrder(userId));
  });

  router.put(
    "/sidebar-preferences/me",
    validate(upsertSidebarOrderPreferenceSchema),
    async (req, res) => {
      assertOrgAccess(req);
      const userId = requireBoardUserId(req, res);
      if (!userId) return;

      const result = await svc.upsertProjectOrder(userId, req.body.orderedIds);
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "sidebar_preferences.project_order_updated",
        entityType: "company",
        entityId: await organizationService(db).requireId(),
        details: {
          userId,
          orderedIds: result.orderedIds,
        },
      });
      res.json(result);
    },
  );

  return router;
}
