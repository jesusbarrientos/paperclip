import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { updateInboxAgentPolicySchema } from "@paperclipai/shared";
import { forbidden, notFound, unauthorized } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { accessService, inboxAgentPolicyService, logActivity } from "../services/index.js";
import { assertOrgAccess, getActorInfo } from "./authz.js";

export function inboxAgentPolicyRoutes(db: Db) {
  const router = Router();
  const access = accessService(db);
  const policies = inboxAgentPolicyService(db);

  function selfUserId(req: Request) {
    if (req.actor.type !== "board" || !req.actor.userId) throw unauthorized("Board user context required");
    return req.actor.userId;
  }

  async function assertAdmin(req: Request) {
    assertOrgAccess(req);
    if (req.actor.type === "board") {
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
      if (!req.actor.userId) throw unauthorized("Board user context required");
      if (await access.canUser(req.actor.userId, "users:manage_permissions")) return;
    } else if (
      req.actor.type === "agent"
      && req.actor.agentId
      && await access.hasPermission("agent", req.actor.agentId, "users:manage_permissions")
    ) {
      return;
    }
    throw forbidden("Inbox agent policy administration authority required", {
      code: "inbox_agent_policy_admin_required",
    });
  }

  async function assertActiveUserMembership(userId: string) {
    const membership = await access.getMembership("user", userId);
    if (!membership || membership.status !== "active") {
      throw notFound("Active company user membership not found");
    }
  }

  async function writePolicy(req: Request, userId: string) {
    const previous = await policies.get(userId);
    const policy = await policies.update(userId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "inbox.agent_policy_updated",
      entityType: "user_inbox_agent_policy",
      entityId: userId,
      details: {
        userId,
        previousMode: previous.mode,
        mode: policy.mode,
        allowedAgentIds: policy.allowedAgentIds,
      },
    });
    return policy;
  }

  router.get("/users/me/inbox-agent-policy", async (req, res) => {
    assertOrgAccess(req);
    res.json(await policies.get(selfUserId(req)));
  });

  router.put(
    "/users/me/inbox-agent-policy",
    validate(updateInboxAgentPolicySchema),
    async (req, res) => {
      assertOrgAccess(req);
      res.json(await writePolicy(req, selfUserId(req)));
    },
  );

  router.get("/users/:userId/inbox-agent-policy", async (req, res) => {
    const userId = req.params.userId as string;
    await assertAdmin(req);
    await assertActiveUserMembership(userId);
    res.json(await policies.get(userId));
  });

  router.put(
    "/users/:userId/inbox-agent-policy",
    validate(updateInboxAgentPolicySchema),
    async (req, res) => {
      const userId = req.params.userId as string;
      await assertAdmin(req);
      await assertActiveUserMembership(userId);
      res.json(await writePolicy(req, userId));
    },
  );

  return router;
}
