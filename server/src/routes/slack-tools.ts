import { slackCapabilities } from "../services/connectors/slack-capabilities.js";
import { slackSearchOAuthService } from "../services/connectors/slack-search-oauth.js";
import { accessService } from "../services/access.js";
import { assertBoard } from "./authz.js";
import type { Request } from "express";
import { Router } from "express";
import { organizations, type Db } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { instanceSettingsService } from "../services/instance-settings.js";
import { slackToolCallSchema, isUuidLike } from "@paperclipai/shared";
import { badRequest, forbidden } from "../errors.js";
import { assertOrgAccess } from "./authz.js";
import { executeConnectorTool } from "../services/connector-runtime.js";

export function slackToolRoutes(db: Db, publicBaseUrl?: string) {
  const router = Router();
  const oauth = slackSearchOAuthService(db, publicBaseUrl);
  router.use(
    ["/slack/search", "/slack"],
    async (req, _res, next) => {
      if (
        !(await instanceSettingsService(db).getExperimental())
          .enableChatConnectors
      )
        throw forbidden("Chat connectors are disabled");
      next();
    },
  );
  function user(req: Request) {
    assertBoard(req);
    if (!req.actor.userId)
      throw forbidden("Sign in before connecting Slack search");
    return req.actor.userId;
  }
  router.param("endpointId", (_req, _res, next, id) => {
    if (!isUuidLike(id)) throw badRequest("Invalid Slack endpoint");
    next();
  });
  router.get("/slack/search/callback", async (req, res) => {
    const userId = user(req);
    if (
      typeof req.query.state !== "string" ||
      typeof req.query.code !== "string"
    )
      throw badRequest("Slack authorization was cancelled or incomplete");
    const result = await oauth.complete(
      req.query.state,
      req.query.code,
      userId,
    );
    const [company] = await db
      .select({ prefix: organizations.issuePrefix })
      .from(organizations);
    res.redirect(
      `/${encodeURIComponent(company.prefix)}/apps/chat/${result.endpointId}/access`,
    );
  });
  router.get(
    "/slack/endpoints/:endpointId/capabilities",
    async (req, res) => {
      assertBoard(req);
      assertOrgAccess(req);
      res
        .set("Cache-Control", "no-store")
        .json(
          await slackCapabilities(db, String(req.params.endpointId)),
        );
    },
  );
  async function canConfigure(req: Request, userId: string) {
    return (
      req.actor.source === "local_implicit" ||
      req.actor.isInstanceAdmin === true ||
      (await accessService(db).hasPermission(
        "user",
        userId,
        "tools:manage_connections",
      ))
    );
  }
  router.get("/slack/endpoints/:endpointId/search", async (req, res) => {
    const userId = user(req);
    assertOrgAccess(req);
    res.set("Cache-Control", "no-store").json({
      ...(await oauth.status(String(req.params.endpointId), userId)),
      canConfigure: await canConfigure(req, userId),
    });
  });
  router.put("/slack/endpoints/:endpointId/search", async (req, res) => {
    const userId = user(req);
    assertOrgAccess(req);
    if (
      req.actor.source !== "local_implicit" &&
      !req.actor.isInstanceAdmin &&
      !(await accessService(db).hasPermission(
        "user",
        userId,
        "tools:manage_connections",
      ))
    )
      throw forbidden("Missing permission: tools:manage_connections");
    res.json(
      await oauth.configure(
        String(req.params.endpointId),
        userId,
        req.body,
      ),
    );
  });
  router.post("/slack/endpoints/:endpointId/search/connect", async (req, res) => {
    const userId = user(req);
    assertOrgAccess(req);
    res
      .set("Cache-Control", "no-store")
      .json(
        await oauth.start(String(req.params.endpointId), userId),
      );
  });
  router.delete("/slack/endpoints/:endpointId/search", async (req, res) => {
    const userId = user(req);
    assertOrgAccess(req);
    res.json(
      await oauth.disconnect(String(req.params.endpointId), userId),
    );
  });
  router.post(
    "/slack/tasks/:issueId/tools",
    async (req, res) => {
      const issueId = String(req.params.issueId);
      assertOrgAccess(req);
      if (!isUuidLike(issueId))
        throw badRequest("Invalid task binding");
      if (req.actor.type !== "agent" || !req.actor.agentId || !req.actor.runId)
        throw forbidden("Slack tools require an authenticated agent run");
      const call = slackToolCallSchema.parse(req.body);
      if (!call.tool.startsWith("slack_"))
        throw forbidden("Expected a Slack tool");
      res.set("Cache-Control", "no-store").json(
        await executeConnectorTool(
          db,
          {
            issueId,
            runId: req.actor.runId,
            agentId: req.actor.agentId,
            endpointId: call.endpointId,
          },
          call.tool,
          call.arguments,
        ),
      );
    },
  );
  return router;
}
