import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  catalogTeamInstallSchema,
  catalogTeamListQuerySchema,
  catalogTeamPreviewSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { accessService, agentService } from "../services/index.js";
import {
  getCatalogTeamOrThrow,
  listCatalogTeams,
  readCatalogTeamFile,
  teamsCatalogService,
} from "../services/teams-catalog.js";
import { forbidden } from "../errors.js";
import { assertAuthenticated, assertOrgAccess, getActorInfo } from "./authz.js";

export function teamsCatalogRoutes(db: Db) {
  const router = Router();
  const agents = agentService(db);
  const access = accessService(db);
  const svc = teamsCatalogService(db);

  function canCreateAgents(agent: { permissions: Record<string, unknown> | null | undefined }) {
    if (!agent.permissions || typeof agent.permissions !== "object") return false;
    return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
  }

  function firstQueryString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    return undefined;
  }

  async function assertCanInstallCatalogTeam(req: Request) {
    assertOrgAccess(req);

    if (req.actor.type === "board") {
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
      const allowed = await access.canUser(req.actor.userId, "agents:create");
      if (!allowed) {
        throw forbidden("Missing permission: agents:create");
      }
      return;
    }

    if (!req.actor.agentId) {
      throw forbidden("Agent authentication required");
    }

    const actorAgent = await agents.getById(req.actor.agentId);
    if (!actorAgent) {
      throw forbidden("Agent not found");
    }

    const allowedByGrant = await access.hasPermission("agent", actorAgent.id, "agents:create");
    if (allowedByGrant || canCreateAgents(actorAgent)) {
      return;
    }

    throw forbidden("Missing permission: can create agents");
  }

  router.get("/teams/catalog", async (req, res) => {
    assertAuthenticated(req);
    const query = catalogTeamListQuerySchema.parse({
      kind: firstQueryString(req.query.kind),
      category: firstQueryString(req.query.category),
      q: firstQueryString(req.query.q),
    });
    res.json(await listCatalogTeams(query));
  });

  // Must be registered before `/teams/catalog/:catalogId`, which would
  // otherwise capture "installed" as a catalog id.
  router.get("/teams/catalog/installed", async (req, res) => {
    assertOrgAccess(req);
    res.json(await svc.listInstalledCatalogTeams());
  });

  router.get("/teams/catalog/:catalogId/files", async (req, res) => {
    assertAuthenticated(req);
    const catalogRef = firstQueryString(req.query.ref) ?? (req.params.catalogId as string);
    const relativePath = firstQueryString(req.query.path) ?? "TEAM.md";
    res.json(await readCatalogTeamFile(catalogRef, relativePath));
  });

  router.get("/teams/catalog/:catalogId", async (req, res) => {
    assertAuthenticated(req);
    const catalogRef = firstQueryString(req.query.ref) ?? (req.params.catalogId as string);
    res.json(await getCatalogTeamOrThrow(catalogRef));
  });

  router.post(
    "/teams/catalog/:catalogId/preview",
    validate(catalogTeamPreviewSchema),
    async (req, res) => {
      const catalogRef = firstQueryString(req.query.ref) ?? (req.params.catalogId as string);
      assertOrgAccess(req);
      const result = await svc.previewCatalogTeamImport(catalogRef, {
        ...req.body,
        actor: getActorInfo(req),
      });
      res.json(result);
    },
  );

  router.post(
    "/teams/catalog/:catalogId/install",
    validate(catalogTeamInstallSchema),
    async (req, res) => {
      const catalogRef = firstQueryString(req.query.ref) ?? (req.params.catalogId as string);
      await assertCanInstallCatalogTeam(req);
      const result = await svc.installCatalogTeam(catalogRef, {
        ...req.body,
        actor: getActorInfo(req),
      });
      res.status(201).json(result);
    },
  );

  return router;
}
