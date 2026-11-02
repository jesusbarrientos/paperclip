import { Router, type NextFunction, type Request, type Response } from "express";
import type { Db } from "@paperclipai/db";
import { evaluateSkillPolicySchema, replaceSkillPolicySchema } from "@paperclipai/shared";
import { ZodError, type ZodSchema } from "zod";
import { forbidden, HttpError, unprocessable } from "../errors.js";
import { accessService } from "../services/access.js";
import { companySkillPolicyService, type SkillPolicyPrincipal } from "../services/company-skill-policy.js";
import { assertOrgAccess, getActorInfo } from "./authz.js";

export function companySkillPolicyRoutes(db: Db) {
  const router = Router();
  const access = accessService(db);
  const policies = companySkillPolicyService(db);

  function validatePolicyBody(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          next(unprocessable("Invalid skill policy document", {
            code: "skill_policy_validation_failed",
            issues: error.issues,
          }));
          return;
        }
        next(error);
      }
    };
  }

  function assertSkillPolicyCompanyAccess(req: Request) {
    if (req.actor.type === "none") {
      throw new HttpError(401, "Authentication required", { code: "skill_authentication_required" });
    }
    assertOrgAccess(req);
  }

  async function assertCanAdministerPolicy(req: Request) {
    assertSkillPolicyCompanyAccess(req);
    if (req.actor.type === "board") {
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
      if (await access.canUser(req.actor.userId, "users:manage_permissions")) return;
    } else if (
      req.actor.type === "agent"
      && req.actor.agentId
      && await access.hasPermission("agent", req.actor.agentId, "users:manage_permissions")
    ) {
      return;
    }
    throw forbidden("Skill policy administration authority required", {
      code: "skill_policy_admin_required",
      remediation: "Ask a company administrator to manage the skill policy.",
    });
  }

  async function currentPrincipal(req: Request): Promise<SkillPolicyPrincipal> {
    if (req.actor.type === "agent" && req.actor.agentId) {
      return policies.resolveAgentPrincipal(req.actor.agentId);
    }
    if (req.actor.type === "board") {
      return { type: "board", id: req.actor.userId ?? "board", role: "board" };
    }
    throw forbidden("Authenticated company actor required", { code: "skill_authentication_required" });
  }

  router.get("/skill-policy", async (req, res) => {
    assertSkillPolicyCompanyAccess(req);
    res.json(await policies.get());
  });

  router.put(
    "/skill-policy",
    validatePolicyBody(replaceSkillPolicySchema),
    async (req, res) => {
      await assertCanAdministerPolicy(req);
      const actor = getActorInfo(req);
      const { expectedRevision, ...policy } = req.body;
      res.json(await policies.replace({
        expectedRevision,
        policy,
        activity: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId,
          runId: actor.runId,
        },
      }));
    },
  );

  router.delete("/skill-policy", async (req, res) => {
    await assertCanAdministerPolicy(req);
    const actor = getActorInfo(req);
    res.json(await policies.reset({
      activity: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
      },
    }));
  });

  router.post(
    "/skill-policy/evaluate",
    validatePolicyBody(evaluateSkillPolicySchema),
    async (req, res) => {
      assertSkillPolicyCompanyAccess(req);
      let principal: SkillPolicyPrincipal;
      if (req.body.principal) {
        await assertCanAdministerPolicy(req);
        principal = await policies.resolveAgentPrincipal(req.body.principal.agentId);
      } else {
        principal = await currentPrincipal(req);
      }
      res.json(await policies.evaluate({
        principal,
        action: req.body.action,
        resource: req.body.resource,
      }));
    },
  );

  return router;
}
