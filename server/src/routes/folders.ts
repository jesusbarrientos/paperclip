import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createFolderSchema,
  ensureMySkillFolderSchema,
  folderKindSchema,
  moveFolderItemSchema,
  moveFolderSchema,
  updateFolderSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { badRequest, forbidden } from "../errors.js";
import { folderService, logActivity } from "../services/index.js";
import { assertOrgAccess, getActorInfo } from "./authz.js";

export function folderRoutes(db: Db) {
  const router = Router();
  const svc = folderService(db);

  function parseKind(value: unknown) {
    const result = folderKindSchema.safeParse(value);
    if (!result.success) throw badRequest("Folder kind query parameter is required");
    return result.data;
  }

  router.get("/folders", async (req, res) => {
    assertOrgAccess(req);
    res.json(await svc.list(parseKind(req.query.kind)));
  });

  router.post("/folders", validate(createFolderSchema), async (req, res) => {
    assertOrgAccess(req);
    const created = await svc.create(req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "folder.created",
      entityType: "folder",
      entityId: created.id,
      details: { kind: created.kind, name: created.name, path: created.path, parentId: created.parentId, position: created.position },
    });
    res.status(201).json(created);
  });

  router.post(
    "/folders/ensure-my",
    validate(ensureMySkillFolderSchema),
    async (req, res) => {
      assertOrgAccess(req);
      if (req.actor.type !== "board" || !req.actor.userId) {
        throw forbidden("A signed-in board user is required to create a personal skill folder");
      }
      const folder = await svc.ensureMyFolder(req.actor.userId, req.actor.userName ?? null, req.body.slug);
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "folder.personal_ensured",
        entityType: "folder",
        entityId: folder.id,
        details: { path: folder.path, systemKey: folder.systemKey },
      });
      res.json(folder);
    },
  );

  router.patch("/folders/:folderId", validate(updateFolderSchema), async (req, res) => {
    const folderId = req.params.folderId as string;
    assertOrgAccess(req);
    const updated = await svc.update(folderId, req.body);
    if (!updated) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "folder.updated",
      entityType: "folder",
      entityId: updated.id,
      details: { kind: updated.kind, name: updated.name, path: updated.path, position: updated.position },
    });
    res.json(updated);
  });

  router.post("/folders/items/move", validate(moveFolderItemSchema), async (req, res) => {
    assertOrgAccess(req);
    const moved = await svc.moveItem(req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "folder.item_moved",
      entityType: req.body.kind === "routine" ? "routine" : "company_skill",
      entityId: moved.itemId,
      details: { kind: moved.kind, folderId: moved.folderId },
    });
    res.json(moved);
  });

  router.post("/folders/:folderId/move", validate(moveFolderSchema), async (req, res) => {
    const folderId = req.params.folderId as string;
    assertOrgAccess(req);
    const updated = await svc.moveFolder(folderId, req.body);
    if (!updated) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "folder.moved",
      entityType: "folder",
      entityId: updated.id,
      details: { kind: updated.kind, parentId: updated.parentId, path: updated.path, position: updated.position },
    });
    res.json(updated);
  });

  router.delete("/folders/:folderId", async (req, res) => {
    const folderId = req.params.folderId as string;
    assertOrgAccess(req);
    const deleted = await svc.deleteFolder(folderId);
    if (!deleted) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "folder.deleted",
      entityType: "folder",
      entityId: deleted.id,
      details: { kind: deleted.kind, name: deleted.name },
    });
    res.json({ deleted });
  });

  return router;
}
