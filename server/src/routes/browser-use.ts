import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { issues, type Db } from "@paperclipai/db";
import {
  browserUseControlSchema,
  browserUseSettingsSchema,
  browserUseViewportSchema,
  browserUseViewerSchema,
} from "@paperclipai/shared";
import {
  assertBoard,
  assertOrgAccess,
  getActorInfo,
  getAccessibleResource,
} from "./authz.js";
import { browserUseService } from "../services/browser-use.js";

const issueIdSchema = z.string().uuid();

export function browserUseRoutes(db: Db, service = browserUseService(db)) {
  const router = Router();
  router.use("/issues/:issueId/browsers", async (req, res, next) => {
    assertBoard(req);
    if (
      req.params.issueId !== req.params.issueId.trim() ||
      !issueIdSchema.safeParse(req.params.issueId).success
    ) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const [issue] = await db
      .select({ id: issues.id })
      .from(issues)
      .where(eq(issues.id, req.params.issueId))
      .limit(1);
    if (!(await getAccessibleResource(req, res, issue, "Task not found")))
      return;
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get("/issues/:issueId/browsers", async (req, res) => {
    res.json(
      await service.list(
        req.params.issueId,
        getActorInfo(req).actorId,
      ),
    );
  });
  router.get(
    "/issues/:issueId/browsers/:browserId/viewer",
    async (req, res) => {
      res.setHeader("Referrer-Policy", "no-referrer");
      res.json(
        await service.viewer(
          req.params.issueId,
          req.params.browserId,
          getActorInfo(req).actorId,
          req.query.viewerId === undefined
            ? undefined
            : browserUseViewerSchema.parse({ viewerId: req.query.viewerId })
                .viewerId,
        ),
      );
    },
  );
  router.post(
    "/issues/:issueId/browsers/:browserId/presence",
    async (req, res) => {
      res.json(
        await service.presence(
          req.params.issueId,
          req.params.browserId,
          getActorInfo(req).actorId,
        ),
      );
    },
  );
  router.post(
    "/issues/:issueId/browsers/:browserId/viewport",
    async (req, res) => {
      const viewport = browserUseViewportSchema.parse(req.body);
      res.json(
        await service.resize(
          req.params.issueId,
          req.params.browserId,
          getActorInfo(req).actorId,
          viewport,
        ),
      );
    },
  );
  router.post(
    "/issues/:issueId/browsers/:browserId/viewport/release",
    async (req, res) => {
      const { viewerId } = browserUseViewerSchema.parse(req.body);
      res.json(
        await service.releaseViewport(
          req.params.issueId,
          req.params.browserId,
          getActorInfo(req).actorId,
          viewerId,
        ),
      );
    },
  );
  router.post(
    "/issues/:issueId/browsers/:browserId/control",
    async (req, res) => {
      const { action } = browserUseControlSchema.parse(req.body);
      const { s } = await service.humanSession(
        req.params.issueId,
        req.params.browserId,
        getActorInfo(req).actorId,
      );
      await service.control(s, action, getActorInfo(req).actorId);
      res.json({ accepted: true });
    },
  );
  router.get(
    "/browser-use-cloud/grants/:grantId/profiles",
    async (req, res) => {
      assertBoard(req);
      assertOrgAccess(req);
      res.setHeader("Cache-Control", "no-store");
      res.json(
        await service.availableProfiles(
          req.params.grantId,
          getActorInfo(req).actorId,
        ),
      );
    },
  );
  router.get(
    "/browser-use-cloud/grants/:grantId/settings",
    async (req, res) => {
      assertBoard(req);
      assertOrgAccess(req);
      await service.humanGrant(
        req.params.grantId,
        getActorInfo(req).actorId,
      );
      res.json(
        await service.getSettings(req.params.grantId),
      );
    },
  );
  router.put(
    "/browser-use-cloud/grants/:grantId/settings",
    async (req, res) => {
      assertBoard(req);
      assertOrgAccess(req);
      res.json(
        await service.saveSettings(
          req.params.grantId,
          getActorInfo(req).actorId,
          browserUseSettingsSchema.parse(req.body),
        ),
      );
    },
  );
  return router;
}
