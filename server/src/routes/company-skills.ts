import { organizationService } from "../services/organization.js";
import { skillSourceService, type SkillSourceContext } from "../services/skill-sources.js";
import { skillSourceGitHubReader } from "../services/skill-source-github-access.js";
import { toolAccessService } from "../services/tool-access.js";
import { skillSourceCreateSchema, skillSourceDiscoverySchema, skillSourcePreviewSchema, skillSourceSelectionSchema } from "@paperclipai/shared";
import type { ActivityPublication } from "../services/activity-log.js";
import { once } from "node:events";
import type { SkillSourceDiscoveryEvent } from "@paperclipai/shared";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { activityLog, companySkills } from "@paperclipai/db";
import { persistActivity, publishActivity } from "../services/activity-log.js";
import { projectToolContext } from "../services/project-tool-context.js";
import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  catalogSkillListQuerySchema,
  companySkillCommentCreateSchema,
  companySkillCommentUpdateSchema,
  companySkillCreateSchema,
  companySkillFileDeleteSchema,
  companySkillFileUpdateSchema,
  companySkillForkSchema,
  companySkillImportSchema,
  companySkillInstallCatalogSchema,
  companySkillInstallUpdateSchema,
  companySkillListQuerySchema,
  companySkillProjectBrowseRequestSchema,
  companySkillProjectScanRequestSchema,
  companySkillRenameSchema,
  companySkillResetSchema,
  companySkillTestInputCreateSchema,
  companySkillTestInputUpdateSchema,
  companySkillTestRunTemplateCreateSchema,
  companySkillTestRunTemplateUpdateSchema,
  companySkillTestRunCreateSchema,
  companySkillTestRunListQuerySchema,
  companySkillUpdateSchema,
  companySkillVersionCreateSchema,
} from "@paperclipai/shared";
import { trackSkillImported } from "@paperclipai/shared/telemetry";
import { validate } from "../middleware/validate.js";
import {
  accessService,
  companySkillService,
  heartbeatService,
  issueService,
  logActivity,
} from "../services/index.js";
import { isGitRepoSkillImportSource, parseSkillImportSourceInput } from "../services/company-skills.js";
import {
  getCatalogSkillOrThrow,
  listCatalogSkillsOrEmpty,
  readCatalogSkillFile,
} from "../services/skills-catalog.js";
import { badRequest, conflict, forbidden, unauthorized, HttpError } from "../errors.js";
import { assertAuthenticated, assertOrgAccess, getActorInfo } from "./authz.js";
import { getTelemetryClient } from "../telemetry.js";
import {
  companySkillPolicyService,
  normalizeSkillPolicySourceType,
  type SkillPolicyPrincipal,
} from "../services/company-skill-policy.js";
import { authorizationDeniedDetails } from "../services/authorization.js";
import {
  normalizeSkillPolicySourceLocator,
  type SkillPolicyAction,
  type SkillPolicyDecision,
  type SkillPolicyEvaluationResource,
} from "@paperclipai/shared";

type SkillTelemetryInput = {
  key: string;
  slug: string;
  sourceType: string;
  sourceLocator: string | null;
  metadata: Record<string, unknown> | null;
};

type SkillPolicyDenialResponse = {
  code: "skill_policy_denied";
  reason: SkillPolicyDecision["reason"];
  remediation?: string;
};

type SkillTestRunAssignmentAuthorizationScope = {
  issueId?: string | null;
  projectId?: string | null;
  parentIssueId?: string | null;
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
};

type SkillPolicyResourceInput =
  | SkillPolicyEvaluationResource
  | Promise<SkillPolicyEvaluationResource>
  | (() => SkillPolicyEvaluationResource | Promise<SkillPolicyEvaluationResource>);

export function companySkillRoutes(db: Db) {
  const router = Router();
  const access = accessService(db);
  const svc = companySkillService(db);
  const sourceSvc = skillSourceService(db);
  const issues = issueService(db);
  const heartbeat = heartbeatService(db);
  const skillPolicies = companySkillPolicyService(db);

  function asString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function deriveTrackedSkillRef(skill: SkillTelemetryInput): string | null {
    if (skill.metadata?.skillSourceId) return null;
    if (skill.sourceType === "skills_sh") {
      return skill.key;
    }
    if (skill.sourceType !== "github") {
      return null;
    }
    const hostname = asString(skill.metadata?.hostname);
    if (hostname !== "github.com") {
      return null;
    }
    return skill.key;
  }

  function firstQueryString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    return undefined;
  }

  function optionalQueryBoolean(value: unknown) {
    const parsed = firstQueryString(value);
    if (parsed === undefined) return undefined;
    if (parsed === "true") return true;
    if (parsed === "false") return false;
    throw badRequest("Boolean query parameters must be true or false");
  }

  function queryStringArray(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
    return [];
  }

  function toSkillPolicyDenialResponse(
    decision: Pick<SkillPolicyDecision, "reason" | "remediation">,
  ): SkillPolicyDenialResponse {
    return {
      code: "skill_policy_denied",
      reason: decision.reason,
      ...(typeof decision.remediation === "string" ? { remediation: decision.remediation } : {}),
    };
  }

  function skillActor(req: Request) {
    if (req.actor.type === "agent") {
      return { type: "agent" as const, agentId: req.actor.agentId ?? null };
    }
    if (req.actor.type === "board") {
      return { type: "user" as const, userId: req.actor.userId ?? null };
    }
    return { type: "system" as const };
  }

  async function skillPolicyPrincipal(req: Request): Promise<SkillPolicyPrincipal> {
    if (req.actor.type === "agent" && req.actor.agentId) {
      return skillPolicies.resolveAgentPrincipal(req.actor.agentId);
    }
    if (req.actor.type === "board") {
      return { type: "board", id: req.actor.userId ?? "board", role: "board" };
    }
    throw unauthorized("Authentication required");
  }

  async function skillPolicyResource(input: {
    skillId?: string | null;
    skillKey?: unknown;
    sourceType?: string | null;
    sourceLocator?: unknown;
  }): Promise<SkillPolicyEvaluationResource> {
    const stored = input.skillId ? await svc.getById(input.skillId) : null;
    const sourceLocator = asString(input.sourceLocator) ?? stored?.sourceLocator ?? undefined;
    return {
      ...(input.skillId ? { skillId: input.skillId } : {}),
      ...(asString(input.skillKey) || stored?.key ? { skillKey: asString(input.skillKey) ?? stored?.key } : {}),
      ...((input.sourceType || stored?.sourceType) ? {
        sourceType: normalizeSkillPolicySourceType(input.sourceType ?? stored?.sourceType),
      } : {}),
      ...(sourceLocator ? { sourceLocator: normalizeSkillPolicySourceLocator(sourceLocator) } : {}),
    };
  }

  function skillImportPolicyResource(source: string): SkillPolicyEvaluationResource {
    const parsed = parseSkillImportSourceInput(source);
    const resolvedSource = parsed.resolvedSource;
    return {
      sourceType: normalizeSkillPolicySourceType(
        isGitRepoSkillImportSource(resolvedSource) ? "git" : /^https?:\/\//i.test(resolvedSource) ? "external_package" : "workspace",
      ),
      sourceLocator: normalizeSkillPolicySourceLocator(resolvedSource),
    };
  }

  async function assertCanMutateCompanySkills(
    req: Request,
    action: SkillPolicyAction,
    resource: SkillPolicyResourceInput = {},
  ) {
    if (req.actor.type === "none") {
      throw unauthorized("Authentication required");
    }
    assertOrgAccess(req);
    const platformDecision = await access.decide({
      actor: req.actor,
      action: "skill_config:update",
      resource: { type: "company" },
    });
    // Legacy missing-grant and suggest-change-consent denials are not platform
    // invariants for skills. The company skill policy is the governance layer;
    // authentication, company boundaries, and safety checks still fail closed.
    if (
      !platformDecision.allowed
      && !["deny_no_grant", "deny_missing_consent", "deny_missing_grant"].includes(platformDecision.reason)
    ) {
      throw forbidden(platformDecision.explanation, {
        code: platformDecision.reason === "deny_company_boundary"
          ? "skill_company_boundary_denied"
          : "skill_actor_restricted",
        reason: "platform_invariant",
      });
    }
    const resolvedResource = typeof resource === "function" ? await resource() : await resource;
    const policyDecision = await skillPolicies.evaluate({
      principal: await skillPolicyPrincipal(req),
      action,
      resource: resolvedResource,
    });
    if (!policyDecision.allowed) {
      throw forbidden("Skill action denied by company policy", toSkillPolicyDenialResponse(policyDecision));
    }
  }

  async function assertCanOrchestrateSkillTestHarness(
    req: Request,
    assignmentScope: SkillTestRunAssignmentAuthorizationScope = {},
  ) {
    assertOrgAccess(req);
    const decision = await access.decide({
      actor: req.actor,
      action: "tasks:assign",
      resource: {
        type: "issue",
        issueId: assignmentScope.issueId ?? null,
        projectId: assignmentScope.projectId ?? null,
        parentIssueId: assignmentScope.parentIssueId ?? null,
        assigneeAgentId: assignmentScope.assigneeAgentId ?? null,
        assigneeUserId: assignmentScope.assigneeUserId ?? null,
      },
      scope: assignmentScope,
    });
    if (decision.allowed) return;
    throw forbidden(decision.explanation, authorizationDeniedDetails(decision));
  }

  async function loadSkillTestRunAssignmentScope(
    skillId: string,
    runId: string,
  ): Promise<SkillTestRunAssignmentAuthorizationScope> {
    const run = await svc.getTestRunDetail(skillId, runId);
    if (!run?.issueId) return {};
    const issue = await issues.getById(run.issueId);
    if (!issue) {
      return {
        issueId: run.issueId,
        assigneeAgentId: run.agentId ?? null,
      };
    }
    return {
      issueId: issue.id,
      projectId: issue.projectId ?? null,
      parentIssueId: issue.parentId ?? null,
      assigneeAgentId: issue.assigneeAgentId ?? run.agentId ?? null,
      assigneeUserId: issue.assigneeUserId ?? null,
    };
  }

  async function sourceOperation<T>(req: Request, operation: (context: SkillSourceContext) => Promise<T>) {
    assertOrgAccess(req);
    const actor = getActorInfo(req);
    const publications: ActivityPublication[] = [];
    const result = await operation({
      actor: skillActor(req),
      read: connectionId => skillSourceGitHubReader(db, req.actor, connectionId),
      authorize: (action, resource) => assertCanMutateCompanySkills(req, action, resource),
      audit: async (tx, sourceId, action, details) => {
        const { publication } = await persistActivity(tx as unknown as Db, { ...actor, action, entityType: "company_skill_source", entityId: sourceId, details });
        publications.push(publication);
      },
    });
    publications.forEach(publishActivity);
    return result;
  }

  router.get("/skill-sources/repositories", async (req, res) => {
    assertOrgAccess(req);
    const viewer = req.actor.type === "board"
      ? { userId: req.actor.userId ?? null, localTrusted: req.actor.source === "local_implicit" }
      : await projectToolContext(db, req.actor);
    res.json(await toolAccessService(db).listGitHubRepositories(viewer.userId, viewer.localTrusted));
  });
  router.get("/skill-sources", async (req, res) => {
    assertOrgAccess(req);
    res.json(await sourceSvc.list());
  });
  router.post("/skill-sources/discover", validate(skillSourceDiscoverySchema), async (req, res) => {
    res.vary("Accept");
    if (!req.get("Accept")?.includes("application/x-ndjson")) {
      res.json(await sourceOperation(req, context => sourceSvc.discover(req.body, context)));
      return;
    }
    const controller = new AbortController();
    const stop = () => controller.abort();
    res.on("close", stop);
    const send = async (event: SkillSourceDiscoveryEvent) => {
      controller.signal.throwIfAborted();
      if (!res.headersSent) {
        res.set({ "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
        res.flushHeaders();
      }
      if (!res.write(`${JSON.stringify(event)}\n`)) {
        const stalled = setTimeout(() => {
          controller.abort();
          res.destroy();
        }, 30_000);
        stalled.unref();
        try {
          await once(res, "drain", { signal: controller.signal });
        } finally {
          clearTimeout(stalled);
        }
      }
    };
    try {
      const discovery = await sourceOperation(req, context => sourceSvc.discover(req.body, context, { signal: controller.signal, onProgress: send }));
      await send({ type: "complete", discovery });
    } catch (error) {
      if (controller.signal.aborted) return;
      // Preserve normal HTTP errors (including session recovery) before streaming starts.
      if (!res.headersSent) throw error;
      await send({ type: "error", status: error instanceof HttpError ? error.status : 500,
        error: error instanceof HttpError ? error.message : "Repository scan interrupted. Try again." });
    } finally {
      res.off("close", stop);
      if (res.headersSent && !res.destroyed) res.end();
    }
  });
  router.post("/skill-sources/preview", validate(skillSourcePreviewSchema), async (req, res) => {
    res.json(await sourceOperation(req, context => sourceSvc.preview(req.body, context)));
  });
  router.post("/skill-sources", validate(skillSourceCreateSchema), async (req, res) => {
    res.status(201).json(await sourceOperation(req, context => sourceSvc.create(req.body, context)));
  });
  router.get("/skill-sources/:sourceId", async (req, res) => {
    assertOrgAccess(req);
    res.json(await sourceSvc.detail(req.params.sourceId as string));
  });
  router.patch("/skill-sources/:sourceId", validate(skillSourceSelectionSchema), async (req, res) => {
    res.json(await sourceOperation(req, context => sourceSvc.refresh(req.params.sourceId as string, context, req.body)));
  });
  router.post("/skill-sources/:sourceId/refresh", async (req, res) => {
    res.json(await sourceOperation(req, context => sourceSvc.refresh(req.params.sourceId as string, context)));
  });
  router.delete("/skill-sources/:sourceId", async (req, res) => {
    res.json(await sourceOperation(req, context => sourceSvc.disconnect(req.params.sourceId as string, context)));
  });

  router.get("/skills/catalog", async (req, res) => {
    assertAuthenticated(req);
    const query = catalogSkillListQuerySchema.parse({
      kind: firstQueryString(req.query.kind),
      category: firstQueryString(req.query.category),
      q: firstQueryString(req.query.q),
    });
    res.json(listCatalogSkillsOrEmpty(query));
  });

  router.get("/skills/catalog/:catalogId/files", async (req, res) => {
    assertAuthenticated(req);
    const catalogRef = firstQueryString(req.query.ref) ?? (req.params.catalogId as string);
    const relativePath = firstQueryString(req.query.path) ?? "SKILL.md";
    res.json(await readCatalogSkillFile(catalogRef, relativePath));
  });

  router.get("/skills/catalog/:catalogId", async (req, res) => {
    assertAuthenticated(req);
    const catalogRef = firstQueryString(req.query.ref) ?? (req.params.catalogId as string);
    res.json(getCatalogSkillOrThrow(catalogRef));
  });

  router.get("/skills", async (req, res) => {
    assertOrgAccess(req);
    const result = await svc.list(companySkillListQuerySchema.parse({
      q: firstQueryString(req.query.q),
      sort: firstQueryString(req.query.sort),
      categories: [
        ...queryStringArray(req.query.category),
        ...queryStringArray(req.query.categories),
        ...queryStringArray(req.query["categories[]"]),
        ...queryStringArray(req.query.tag),
        ...queryStringArray(req.query.tags),
        ...queryStringArray(req.query["tags[]"]),
      ],
      scope: firstQueryString(req.query.scope),
      include: [
        ...queryStringArray(req.query.include),
        ...queryStringArray(req.query["include[]"]),
      ],
      folderId: firstQueryString(req.query.folderId),
      includeSubtree: optionalQueryBoolean(req.query.includeSubtree),
    }));
    res.json(result);
  });

  router.get("/skills/categories", async (req, res) => {
    assertOrgAccess(req);
    res.json(await svc.categoryCounts());
  });

  router.get("/skills/:skillId", async (req, res) => {
    const skillId = req.params.skillId as string;
    assertOrgAccess(req);
    const result = await svc.detail(skillId, skillActor(req));
    if (!result) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(result);
  });

  router.get("/skills/:skillId/fork-precheck", async (req, res) => {
    const skillId = req.params.skillId as string;
    assertOrgAccess(req);
    const result = await svc.forkPrecheck(skillId, skillActor(req));
    if (!result) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(result);
  });

  router.get("/skills/:skillId/versions", async (req, res) => {
    const skillId = req.params.skillId as string;
    assertOrgAccess(req);
    res.json(await svc.listVersions(skillId));
  });

  router.get("/skills/:skillId/versions/:versionId", async (req, res) => {
    const skillId = req.params.skillId as string;
    const versionId = req.params.versionId as string;
    assertOrgAccess(req);
    const result = await svc.getVersion(skillId, versionId);
    if (!result) {
      res.status(404).json({ error: "Skill version not found" });
      return;
    }
    res.json(result);
  });

  router.get("/skills/:skillId/test-inputs", async (req, res) => {
    const skillId = req.params.skillId as string;
    assertOrgAccess(req);
    res.json(await svc.listTestInputs(skillId));
  });

  router.post(
    "/skills/:skillId/test-inputs",
    validate(companySkillTestInputCreateSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(req, "skills.edit", () => skillPolicyResource({ skillId }));
      const result = await svc.createTestInput(skillId, req.body, skillActor(req));
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_test_input_created",
        entityType: "company_skill_test_input",
        entityId: result.id,
        details: { skillId, name: result.name },
      });
      res.status(201).json(result);
    },
  );

  router.patch(
    "/skills/:skillId/test-inputs/:inputId",
    validate(companySkillTestInputUpdateSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      const inputId = req.params.inputId as string;
      await assertCanMutateCompanySkills(req, "skills.edit", () => skillPolicyResource({ skillId }));
      const result = await svc.updateTestInput(skillId, inputId, req.body);
      if (!result) {
        res.status(404).json({ error: "Test input not found" });
        return;
      }
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_test_input_updated",
        entityType: "company_skill_test_input",
        entityId: result.id,
        details: { skillId, changedKeys: Object.keys(req.body).sort() },
      });
      res.json(result);
    },
  );

  router.delete("/skills/:skillId/test-inputs/:inputId", async (req, res) => {
    const skillId = req.params.skillId as string;
    const inputId = req.params.inputId as string;
    await assertCanMutateCompanySkills(req, "skills.edit", () => skillPolicyResource({ skillId }));
    const result = await svc.deleteTestInput(skillId, inputId);
    if (!result) {
      res.status(404).json({ error: "Test input not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "company.skill_test_input_deleted",
      entityType: "company_skill_test_input",
      entityId: result.id,
      details: { skillId, name: result.name },
    });
    res.json(result);
  });

  router.get("/skill-test-run-templates", async (req, res) => {
    assertOrgAccess(req);
    res.json(await svc.listTestRunTemplates());
  });

  router.post(
    "/skill-test-run-templates",
    validate(companySkillTestRunTemplateCreateSchema),
    async (req, res) => {
      await assertCanMutateCompanySkills(req, "skills.edit");
      const result = await svc.createTestRunTemplate(req.body, skillActor(req));
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_test_run_template_created",
        entityType: "company_skill_test_run_template",
        entityId: result.id,
        details: { name: result.name },
      });
      res.status(201).json(result);
    },
  );

  router.patch(
    "/skill-test-run-templates/:templateId",
    validate(companySkillTestRunTemplateUpdateSchema),
    async (req, res) => {
      const templateId = req.params.templateId as string;
      await assertCanMutateCompanySkills(req, "skills.edit");
      const result = await svc.updateTestRunTemplate(templateId, req.body, skillActor(req));
      if (!result) {
        res.status(404).json({ error: "Test run template not found" });
        return;
      }
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_test_run_template_updated",
        entityType: "company_skill_test_run_template",
        entityId: result.id,
        details: { changedKeys: Object.keys(req.body).sort() },
      });
      res.json(result);
    },
  );

  router.delete("/skill-test-run-templates/:templateId", async (req, res) => {
    const templateId = req.params.templateId as string;
    await assertCanMutateCompanySkills(req, "skills.edit");
    const result = await svc.deleteTestRunTemplate(templateId);
    if (!result) {
      res.status(404).json({ error: "Test run template not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "company.skill_test_run_template_deleted",
      entityType: "company_skill_test_run_template",
      entityId: result.id,
      details: { name: result.name },
    });
    res.json(result);
  });

  router.get("/skills/:skillId/test-runs", async (req, res) => {
    const skillId = req.params.skillId as string;
    assertOrgAccess(req);
    const query = companySkillTestRunListQuerySchema.parse({
      inputId: firstQueryString(req.query.inputId),
    });
    res.json(await svc.listTestRuns(skillId, query));
  });

  router.get("/skills/:skillId/test-runs/:runId", async (req, res) => {
    const skillId = req.params.skillId as string;
    const runId = req.params.runId as string;
    assertOrgAccess(req);
    const result = await svc.getTestRunDetail(skillId, runId);
    if (!result) {
      res.status(404).json({ error: "Test run not found" });
      return;
    }
    res.json(result);
  });

  router.post(
    "/skills/:skillId/test-runs",
    validate(companySkillTestRunCreateSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(req, "skills.test", () => skillPolicyResource({ skillId }));
      await assertCanOrchestrateSkillTestHarness(req, {
        assigneeAgentId: req.body.agentId,
      });
      const actor = getActorInfo(req);
      const result = await svc.createTestRun(skillId, req.body, skillActor(req), {
        createHarnessIssue: async (harnessIssue) => {
          const created = await issues.create({
            ...harnessIssue,
            priority: "medium",
            createdByAgentId: actor.agentId,
            createdByUserId: actor.actorType === "user" ? actor.actorId : null,
            actorRunId: actor.runId,
          });
          await logActivity(db, {
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            runId: actor.runId,
            agentApiKeyId: actor.agentApiKeyId,
            action: "issue.created",
            entityType: "issue",
            entityId: created.id,
            details: {
              title: created.title,
              identifier: created.identifier,
              harnessKind: "skill_test",
              source: "company_skill_test_run",
              skillId,
            },
          });
          return { id: created.id };
        },
        wakeHarnessIssue: async (issueId, agentId) => heartbeat.wakeup(agentId, {
          source: "assignment",
          triggerDetail: "system",
          reason: "skill_test_run_created",
          payload: { issueId, skillId },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: { issueId, source: "company.skill_test_run" },
        }),
        cleanupHarnessIssue: async (issueId) => {
          const issue = await issues.getById(issueId);
          if (!issue) return;
          await issues.update(issueId, {
            status: "cancelled",
            hiddenAt: new Date(),
            actorAgentId: actor.agentId ?? null,
            actorUserId: actor.actorType === "user" ? actor.actorId : null,
          });
          await logActivity(db, {
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            runId: actor.runId,
            agentApiKeyId: actor.agentApiKeyId,
            action: "company.skill_test_harness_issue_cleaned_up",
            entityType: "issue",
            entityId: issueId,
            details: { skillId },
          });
        },
      });
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_test_run_created",
        entityType: "company_skill_test_run",
        entityId: result.id,
        issueId: result.issueId,
        details: {
          skillId,
          inputId: result.inputId,
          skillVersionId: result.skillVersionId,
          agentId: result.agentId,
          issueId: result.issueId,
        },
      });
      res.status(201).json(result);
    },
  );

  router.post("/skills/:skillId/test-runs/:runId/cancel", async (req, res) => {
    const skillId = req.params.skillId as string;
    const runId = req.params.runId as string;
    await assertCanMutateCompanySkills(req, "skills.test", () => skillPolicyResource({ skillId }));
    await assertCanOrchestrateSkillTestHarness(req, await loadSkillTestRunAssignmentScope(skillId, runId));
    const actor = getActorInfo(req);
    const result = await svc.cancelTestRun(skillId, runId, {
      cancelHarnessIssue: async (issueId) => {
        const issue = await issues.getById(issueId);
        if (!issue) return;
        if (issue.executionRunId) {
          await heartbeat.cancelRun(issue.executionRunId, "Cancelled by skill test run request");
        }
        if (issue.status !== "done" && issue.status !== "cancelled") {
          await issues.update(issueId, {
            status: "cancelled",
            actorAgentId: actor.agentId ?? null,
            actorUserId: actor.actorType === "user" ? actor.actorId : null,
          });
        }
      },
    });
    if (!result) {
      res.status(404).json({ error: "Test run not found" });
      return;
    }
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "company.skill_test_run_cancelled",
      entityType: "company_skill_test_run",
      entityId: result.id,
      issueId: result.issueId,
      details: { skillId, issueId: result.issueId },
    });
    res.json(result);
  });

  router.delete("/skills/:skillId/test-runs/:runId", async (req, res) => {
    const skillId = req.params.skillId as string;
    const runId = req.params.runId as string;
    await assertCanMutateCompanySkills(req, "skills.test", () => skillPolicyResource({ skillId }));
    await assertCanOrchestrateSkillTestHarness(req, await loadSkillTestRunAssignmentScope(skillId, runId));
    const actor = getActorInfo(req);
    const result = await svc.deleteTestRun(skillId, runId, {
      hideHarnessIssue: async (issueId) => {
        const issue = await issues.getById(issueId);
        if (!issue) return;
        await issues.update(issueId, {
          hiddenAt: new Date(),
          actorAgentId: actor.agentId ?? null,
          actorUserId: actor.actorType === "user" ? actor.actorId : null,
        });
      },
    });
    if (!result) {
      res.status(404).json({ error: "Test run not found" });
      return;
    }
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "company.skill_test_run_deleted",
      entityType: "company_skill_test_run",
      entityId: result.id,
      issueId: result.issueId,
      details: { skillId, issueId: result.issueId },
    });
    res.json(result);
  });

  router.post(
    "/skills/:skillId/versions",
    validate(companySkillVersionCreateSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(req, "skills.create", () => skillPolicyResource({ skillId }));
      const result = await svc.createVersion(skillId, req.body, skillActor(req));
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_version_created",
        entityType: "company_skill_version",
        entityId: result.id,
        details: {
          skillId,
          revisionNumber: result.revisionNumber,
          label: result.label,
        },
      });
      res.status(201).json(result);
    },
  );

  router.post("/skills/:skillId/star", async (req, res) => {
    const skillId = req.params.skillId as string;
    assertOrgAccess(req);
    const result = await svc.starSkill(skillId, skillActor(req));
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "company.skill_starred",
      entityType: "company_skill",
      entityId: skillId,
      details: { starCount: result.starCount },
    });
    res.json(result);
  });

  router.delete("/skills/:skillId/star", async (req, res) => {
    const skillId = req.params.skillId as string;
    assertOrgAccess(req);
    const result = await svc.unstarSkill(skillId, skillActor(req));
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "company.skill_unstarred",
      entityType: "company_skill",
      entityId: skillId,
      details: { starCount: result.starCount },
    });
    res.json(result);
  });

  router.post(
    "/skills/:skillId/fork",
    validate(companySkillForkSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(
        req,
        "skills.create",
        () => skillPolicyResource({ skillId }),
      );
      const result = await svc.forkSkill(skillId, req.body, skillActor(req));
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_forked",
        entityType: "company_skill",
        entityId: result.skill.id,
        details: {
          sourceSkillId: skillId,
          slug: result.skill.slug,
          name: result.skill.name,
          reassignedAgentIds: result.reassignments.map((entry: { agentId: string }) => entry.agentId),
        },
      });
      res.status(201).json(result);
    },
  );

  router.post(
    "/skills/:skillId/rename",
    validate(companySkillRenameSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(
        req,
        "skills.edit",
        () => skillPolicyResource({ skillId }),
      );
      const result = await svc.renameSkill(skillId, req.body);
      const changed = result.previousName !== result.skill.name
        || result.previousSlug !== result.skill.slug
        || result.previousKey !== result.skill.key;
      if (changed) {
        const actor = getActorInfo(req);
        await logActivity(db, {
          actorType: actor.actorType,
          actorId: actor.actorId,
          agentId: actor.agentId,
          runId: actor.runId,
          agentApiKeyId: actor.agentApiKeyId,
          action: "company.skill_renamed",
          entityType: "company_skill",
          entityId: result.skill.id,
          details: {
            previousName: result.previousName,
            previousSlug: result.previousSlug,
            previousKey: result.previousKey,
            name: result.skill.name,
            slug: result.skill.slug,
            key: result.skill.key,
            reassignedAgentIds: result.reassignments.map((entry: { agentId: string }) => entry.agentId),
          },
        });
      }
      res.json(result);
    },
  );

  router.get("/skills/:skillId/comments", async (req, res) => {
    const skillId = req.params.skillId as string;
    assertOrgAccess(req);
    res.json(await svc.listComments(skillId));
  });

  router.post(
    "/skills/:skillId/comments",
    validate(companySkillCommentCreateSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      assertOrgAccess(req);
      const result = await svc.createComment(skillId, req.body, skillActor(req));
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_comment_created",
        entityType: "company_skill_comment",
        entityId: result.id,
        details: { skillId, parentCommentId: result.parentCommentId },
      });
      res.status(201).json(result);
    },
  );

  router.patch(
    "/skills/:skillId/comments/:commentId",
    validate(companySkillCommentUpdateSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      const commentId = req.params.commentId as string;
      assertOrgAccess(req);
      const result = await svc.updateComment(skillId, commentId, req.body, skillActor(req));
      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_comment_updated",
        entityType: "company_skill_comment",
        entityId: result.id,
        details: { skillId },
      });
      res.json(result);
    },
  );

  router.delete("/skills/:skillId/comments/:commentId", async (req, res) => {
    const skillId = req.params.skillId as string;
    const commentId = req.params.commentId as string;
    assertOrgAccess(req);
    const result = await svc.deleteComment(skillId, commentId, skillActor(req));
    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "company.skill_comment_deleted",
      entityType: "company_skill_comment",
      entityId: result.id,
      details: { skillId },
    });
    res.json(result);
  });

  router.get("/skills/:skillId/update-status", async (req, res) => {
    const skillId = req.params.skillId as string;
    assertOrgAccess(req);
    const managed = await sourceSvc.sourceForSkill(skillId);
    if (managed) {
      const skill = await svc.getById(skillId);
      if (!managed.enabled || managed.entries.find(entry => entry.skillId === skillId)?.selection !== "selected") { res.json({ supported: false, reason: "Source is disconnected. Reconnect it in Skills → Sources.", trackingRef: managed.trackingRef, currentRef: skill?.sourceRef, latestRef: null, hasUpdate: false }); return; }
      const read = skillSourceGitHubReader(db, req.actor, managed.connectionId);
      const latest = await read(`/repos/${managed.fullName}/commits/${encodeURIComponent(managed.trackingRef)}`) as { sha: string };
      res.json({ supported: true, reason: null, trackingRef: managed.trackingRef, currentRef: skill?.sourceRef, latestRef: latest.sha, hasUpdate: latest.sha !== managed.lastScanCommit });
      return;
    }
    const result = await svc.updateStatus(skillId);
    if (!result) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(result);
  });

  router.get("/skills/:skillId/files", async (req, res) => {
    const skillId = req.params.skillId as string;
    const relativePath = String(req.query.path ?? "SKILL.md");
    assertOrgAccess(req);
    const result = await svc.readFile(skillId, relativePath);
    if (!result) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(result);
  });

  router.post(
    "/skills",
    validate(companySkillCreateSchema),
    async (req, res) => {
      await assertCanMutateCompanySkills(req, "skills.create", {
        sourceType: "generated",
      });
      const { idempotencyKey, ...input } = req.body;
      const actor = getActorInfo(req);
      const runContext = req.actor.type === "agent" && req.actor.source === "agent_jwt" && req.actor.runId
        ? await projectToolContext(db, req.actor, true, "Skill") : null;
      const event = (skill: Awaited<ReturnType<typeof svc.createLocalSkill>>) => ({
        actorType: actor.actorType, actorId: actor.actorId, agentId: actor.agentId,
        runId: actor.runId, agentApiKeyId: actor.agentApiKeyId, issueId: runContext?.issue.id,
        action: "company.skill_created", entityType: "company_skill", entityId: skill.id,
        details: { slug: skill.slug, name: skill.name, description: skill.description,
          sourceIssueId: runContext?.issue.id ?? null, versionId: skill.currentVersionId },
      });
      if (!idempotencyKey) {
        const skill = await svc.createLocalSkill(input, skillActor(req));
        await logActivity(db, event(skill));
        res.status(201).json(skill);
        return;
      }
      // Scope to task and actor, not run: a replacement runner must recover the
      // same result after a lost acknowledgement. The route still reauthorizes.
      const receiptKey = `skill:${actor.actorId}:${runContext?.issue.id ?? "board"}:${idempotencyKey}`;
      const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const result = await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${receiptKey}, 0))`);
        if (runContext) await projectToolContext(tx as unknown as Db, req.actor, true, "Skill");
        const [prior] = await tx.select().from(activityLog).where(and(
          eq(activityLog.action, "company.skill_created"),
          sql`${activityLog.details}->>'idempotencyKey' = ${receiptKey}`,
        ));
        const service = companySkillService(tx as unknown as Db);
        if (prior) {
          if (prior.details?.fingerprint !== fingerprint) throw conflict("Skill idempotency key was used with different inputs");
          const skill = await service.getById(prior.entityId);
          if (!skill) throw conflict("Previously created skill is no longer available");
          return { skill, publication: null, duplicate: true };
        }
        const skill = await service.createLocalSkill(input, skillActor(req));
        const activity = await persistActivity(tx as unknown as Db, {
          ...event(skill), details: { ...event(skill).details, idempotencyKey: receiptKey, fingerprint },
        });
        return { skill, publication: activity.publication, duplicate: false };
      });
      if (result.publication) publishActivity(result.publication);
      res.status(result.duplicate ? 200 : 201).json(result.skill);
    },
  );

  router.patch(
    "/skills/:skillId",
    validate(companySkillUpdateSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(req, "skills.edit", () => skillPolicyResource({ skillId }));
      const result = await svc.updateSkill(skillId, req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_updated",
        entityType: "company_skill",
        entityId: result.id,
        details: {
          slug: result.slug,
          categories: result.categories,
          sharingScope: result.sharingScope,
        },
      });

      res.json(result);
    },
  );

  router.patch(
    "/skills/:skillId/files",
    validate(companySkillFileUpdateSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(req, "skills.edit", () => skillPolicyResource({ skillId }));
      const { idempotencyKey, expectedVersionId, ...input } = req.body;
      if (idempotencyKey) {
        const actor = getActorInfo(req);
        const runContext = req.actor.type === "agent" && req.actor.source === "agent_jwt" && req.actor.runId
          ? await projectToolContext(db, req.actor, true, "Skill") : null;
        const receiptKey = `skill-file:${actor.actorId}:${runContext?.issue.id ?? "board"}:${skillId}:${idempotencyKey}`;
        const fingerprint = createHash("sha256").update(JSON.stringify({ ...input, expectedVersionId })).digest("hex");
        const rollbackState: { current: { restore: () => Promise<void>; versionId: string | null } | null } = { current: null };
        const outcome = await db.transaction(async tx => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${receiptKey}, 0))`);
          if (runContext) await projectToolContext(tx as unknown as Db, req.actor, true, "Skill");
          const [prior] = await tx.select().from(activityLog).where(and(
            eq(activityLog.action, "company.skill_file_updated"),
            sql`${activityLog.details}->>'idempotencyKey' = ${receiptKey}`,
          ));
          if (prior) {
            if (prior.details?.fingerprint !== fingerprint) throw conflict("Skill file idempotency key was used with different inputs");
            return { receipt: prior.details?.receipt, publication: null };
          }
          let publication: ActivityPublication | null = null;
          let receipt: { skillId: string; path: string; versionId: string | null; studioPath: string } | null = null;
          await companySkillService(tx as unknown as Db).updateFile(skillId, input.path, input.content, skillActor(req), {
            encoding: input.encoding, executable: input.executable, expectedVersionId,
            onRollback: (restore, versionId) => { rollbackState.current = { restore, versionId }; },
            afterUpdate: async (versionId) => {
              receipt = { skillId, path: input.path, versionId, studioPath: `/skills/studio/${encodeURIComponent(skillId)}` };
              const activity = await persistActivity(tx as unknown as Db, {
                actorType: actor.actorType, actorId: actor.actorId, agentId: actor.agentId,
                runId: actor.runId, agentApiKeyId: actor.agentApiKeyId, issueId: runContext?.issue.id,
                action: "company.skill_file_updated", entityType: "company_skill", entityId: skillId,
                details: { path: input.path, markdown: input.path === "SKILL.md", versionId,
                  sourceIssueId: runContext?.issue.id ?? null, idempotencyKey: receiptKey, fingerprint, receipt },
              });
              publication = activity.publication;
            },
          });
          return { receipt, publication };
        }).catch(async (error) => {
          if (rollbackState.current) {
            const { restore, versionId } = rollbackState.current;
            await db.transaction(async tx => {
              await tx.execute(sql`select ${companySkills.id} from ${companySkills} where ${companySkills.id} = ${skillId} for update`);
              const [current] = await tx.select({ versionId: companySkills.currentVersionId }).from(companySkills)
                .where(eq(companySkills.id, skillId));
              if (current && current.versionId === versionId) await restore();
            });
          }
          throw error;
        });
        if (outcome.publication) publishActivity(outcome.publication);
        res.json(outcome.receipt);
        return;
      }
      const result = await svc.updateFile(
        skillId,
        String(req.body.path ?? ""),
        String(req.body.content ?? ""),
        skillActor(req),
        { encoding: req.body.encoding, executable: req.body.executable, expectedVersionId },
      );

      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_file_updated",
        entityType: "company_skill",
        entityId: skillId,
        details: {
          path: result.path,
          markdown: result.markdown,
        },
      });

      res.json(result);
    },
  );

  router.delete(
    "/skills/:skillId/files",
    validate(companySkillFileDeleteSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(req, "skills.edit", () => skillPolicyResource({ skillId }));
      const result = await svc.deleteFile(skillId, req.body, skillActor(req));

      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_file_deleted",
        entityType: "company_skill",
        entityId: skillId,
        details: {
          path: result.path,
          target: result.target,
          deletedPaths: result.deletedPaths,
        },
      });

      res.json(result);
    },
  );

  router.post(
    "/skills/import",
    validate(companySkillImportSchema),
    async (req, res) => {
      const source = String(req.body.source ?? "");
      await assertCanMutateCompanySkills(req, "skills.import", () => skillImportPolicyResource(source));
      const parsed = parseSkillImportSourceInput(source);
      const managedGitHub = !parsed.originalSkillsShUrl && /^https:\/\/github\.com\//.test(parsed.resolvedSource);
      const result = managedGitHub
        ? await sourceOperation(req, context => sourceSvc.importFromUrl(source, context))
        : await svc.importFromSource(source);

      const actor = getActorInfo(req);
      if (!managedGitHub) await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skills_imported",
        entityType: "company",
        entityId: await organizationService(db).requireId(),
        details: {
          source,
          importedCount: result.imported.length,
          importedSlugs: result.imported.map((skill) => skill.slug),
          warningCount: result.warnings.length,
        },
      });
      const telemetryClient = getTelemetryClient();
      if (telemetryClient) {
        for (const skill of result.imported) {
          trackSkillImported(telemetryClient, {
            sourceType: skill.sourceType,
            skillRef: deriveTrackedSkillRef(skill),
          });
        }
      }

      res.status(201).json(result);
    },
  );

  router.post(
    "/skills/install-catalog",
    validate(companySkillInstallCatalogSchema),
    async (req, res) => {
      await assertCanMutateCompanySkills(req, "skills.install", {
        sourceType: "catalog",
        sourceLocator: req.body.catalogSkillId,
      });
      const result = await svc.installFromCatalog(req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: result.action === "created" ? "company.skill_catalog_installed" : "company.skill_catalog_updated",
        entityType: "company_skill",
        entityId: result.skill.id,
        details: {
          action: result.action,
          catalogId: result.catalogSkill.id,
          catalogKey: result.catalogSkill.key,
          slug: result.skill.slug,
          originHash: result.catalogSkill.contentHash,
          warningCount: result.warnings.length,
        },
      });

      res.status(result.action === "created" ? 201 : 200).json(result);
    },
  );

  router.post(
    "/skills/browse-project",
    validate(companySkillProjectBrowseRequestSchema),
    async (req, res) => {
      await assertCanMutateCompanySkills(req, "skills.import", { sourceType: "workspace" });
      const result = await svc.browseProjectWorkspace(req.body);
      res.json(result);
    },
  );

  router.post(
    "/skills/scan-projects",
    validate(companySkillProjectScanRequestSchema),
    async (req, res) => {
      await assertCanMutateCompanySkills(req, "skills.import", { sourceType: "workspace" });
      const result = await svc.scanProjectWorkspaces(req.body);

      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skills_scanned",
        entityType: "company",
        entityId: await organizationService(db).requireId(),
        details: {
          mode: req.body.mode ?? "import",
          scannedProjects: result.scannedProjects,
          scannedWorkspaces: result.scannedWorkspaces,
          discovered: result.discovered,
          candidateCount: result.candidates.length,
          importedCount: result.imported.length,
          updatedCount: result.updated.length,
          conflictCount: result.conflicts.length,
          warningCount: result.warnings.length,
        },
      });

      res.json(result);
    },
  );

  router.delete("/skills/:skillId", async (req, res) => {
    const skillId = req.params.skillId as string;
    await assertCanMutateCompanySkills(req, "skills.remove", () => skillPolicyResource({ skillId }));
    const result = await svc.deleteSkill(skillId);
    if (!result) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "company.skill_deleted",
      entityType: "company_skill",
      entityId: result.id,
      details: {
        slug: result.slug,
        name: result.name,
      },
    });

    res.json(result);
  });

  router.post(
    "/skills/:skillId/audit",
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(req, "skills.test", () => skillPolicyResource({ skillId }));
      const result = await svc.auditSkill(skillId);
      if (!result) {
        res.status(404).json({ error: "Skill not found" });
        return;
      }

      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_audited",
        entityType: "company_skill",
        entityId: skillId,
        details: {
          verdict: result.verdict,
          codes: result.codes,
          installedHash: result.installedHash,
          originHash: result.originHash,
          scanVersion: result.scanVersion,
        },
      });

      res.json(result);
    },
  );

  router.post(
    "/skills/:skillId/install-update",
    validate(companySkillInstallUpdateSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(req, "skills.update", () => skillPolicyResource({ skillId }));
      const before = await svc.getById(skillId);
      const managed = await sourceSvc.sourceForSkill(skillId);
      if (managed) {
        if (managed.entries.find(entry => entry.skillId === skillId)?.selection !== "selected") throw conflict("This skill is no longer selected. Manage its source to resume syncing.");
        const result = await sourceOperation(req, context => sourceSvc.refresh(managed.id, context));
        const entry = result.source.entries.find(entry => entry.skillId === skillId);
        if (entry?.error || !entry?.present) throw conflict(entry?.error ?? "This skill was removed from its source. Its installed copy was kept.");
        res.json(await svc.getById(skillId));
        return;
      }
      const result = await svc.installUpdate(skillId, req.body);
      if (!result) {
        res.status(404).json({ error: "Skill not found" });
        return;
      }

      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_update_installed",
        entityType: "company_skill",
        entityId: result.id,
        details: {
          slug: result.slug,
          previousOriginHash: before?.metadata?.originHash ?? before?.sourceRef ?? null,
          previousOriginVersion: before?.metadata?.originVersion ?? null,
          newOriginHash: result.metadata?.originHash ?? result.sourceRef,
          newOriginVersion: result.metadata?.originVersion ?? null,
          driftDetected: Boolean(before?.metadata?.userModifiedAt),
          force: Boolean(req.body.force),
          auditVerdict: result.metadata?.auditVerdict ?? null,
        },
      });

      res.json(result);
    },
  );

  router.post(
    "/skills/:skillId/reset",
    validate(companySkillResetSchema),
    async (req, res) => {
      const skillId = req.params.skillId as string;
      await assertCanMutateCompanySkills(req, "skills.reset", () => skillPolicyResource({ skillId }));
      const before = await svc.getById(skillId);
      const result = await svc.resetSkill(skillId, req.body);
      if (!result) {
        res.status(404).json({ error: "Skill not found" });
        return;
      }

      const actor = getActorInfo(req);
      await logActivity(db, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        agentApiKeyId: actor.agentApiKeyId,
        action: "company.skill_reset",
        entityType: "company_skill",
        entityId: result.id,
        details: {
          slug: result.slug,
          previousOriginHash: before?.metadata?.originHash ?? before?.sourceRef ?? null,
          previousOriginVersion: before?.metadata?.originVersion ?? null,
          newOriginHash: result.metadata?.originHash ?? result.sourceRef,
          newOriginVersion: result.metadata?.originVersion ?? null,
          driftDetected: Boolean(before?.metadata?.userModifiedAt),
          force: Boolean(req.body.force),
          auditVerdict: result.metadata?.auditVerdict ?? null,
        },
      });

      res.json(result);
    },
  );

  return router;
}
