import { organizationService } from "../services/organization.js";
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createCostEventSchema,
  createFinanceEventSchema,
  normalizeIssueIdentifier,
  resolveBudgetIncidentSchema,
  updateBudgetSchema,
  upsertBudgetPolicySchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import {
  budgetService,
  costService,
  financeService,
  companyService,
  agentService,
  issueService,
  heartbeatService,
  accessService,
  logActivity,
} from "../services/index.js";
import { assertBoard, assertOrgAccess, getAccessibleResource, getActorInfo } from "./authz.js";
import { fetchAllQuotaWindows } from "../services/quota-windows.js";
import { badRequest } from "../errors.js";
import type { PluginWorkerManager } from "../services/plugin-worker-manager.js";

export function parseCostDateRange(query: Record<string, unknown>) {
  const fromRaw = query.from as string | undefined;
  const toRaw = query.to as string | undefined;
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;
  if (from && isNaN(from.getTime())) throw badRequest("invalid 'from' date");
  if (to && isNaN(to.getTime())) throw badRequest("invalid 'to' date");
  return (from || to) ? { from, to } : undefined;
}

export function parseCostLimit(query: Record<string, unknown>) {
  const raw = Array.isArray(query.limit) ? query.limit[0] : query.limit;
  if (raw == null || raw === "") return 100;
  const limit = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) {
    throw badRequest("invalid 'limit' value");
  }
  return limit;
}

export function costRoutes(
  db: Db,
  options: { pluginWorkerManager?: PluginWorkerManager } = {},
) {
  const router = Router();
  const heartbeat = heartbeatService(db, {
    pluginWorkerManager: options.pluginWorkerManager,
  });
  const budgetHooks = {
    cancelWorkForScope: heartbeat.cancelBudgetScopeWork,
  };
  const costs = costService(db, budgetHooks);
  const finance = financeService(db);
  const budgets = budgetService(db, budgetHooks);
  const companies = companyService(db);
  const agents = agentService(db);
  const issues = issueService(db);
  const access = accessService(db);

  async function resolveIssueByRef(rawId: string) {
    const identifier = normalizeIssueIdentifier(rawId);
    if (identifier) {
      return issues.getByIdentifier(identifier);
    }
    return issues.getById(rawId);
  }

  async function assertCompanyCostReadAllowed(req: Parameters<typeof assertOrgAccess>[0], res: any) {
    const decision = await access.decide({
      actor: req.actor,
      action: "company_scope:read",
      resource: { type: "company" },
    });
    if (decision.allowed) return true;
    res.status(403).json({ error: "Costs are outside this actor's authorization boundary" });
    return false;
  }

  async function assertIssueCostReadAllowed(req: Parameters<typeof assertOrgAccess>[0], res: any, issue: {
    id: string;
    projectId: string | null;
    parentId: string | null;
    assigneeAgentId: string | null;
    assigneeUserId: string | null;
    status: string;
  }) {
    const decision = await access.decide({
      actor: req.actor,
      action: "issue:read",
      resource: {
        type: "issue",
        issueId: issue.id,
        projectId: issue.projectId,
        parentIssueId: issue.parentId,
        assigneeAgentId: issue.assigneeAgentId,
        assigneeUserId: issue.assigneeUserId,
        status: issue.status,
      },
    });
    if (decision.allowed) return true;
    res.status(403).json({ error: "Issue costs are outside this actor's authorization boundary" });
    return false;
  }

  router.post("/cost-events", validate(createCostEventSchema), async (req, res) => {
    assertOrgAccess(req);

    if (req.actor.type === "agent" && req.actor.agentId !== req.body.agentId) {
      res.status(403).json({ error: "Agent can only report its own costs" });
      return;
    }

    const event = await costs.createEvent({
      ...req.body,
      occurredAt: new Date(req.body.occurredAt),
    });

    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "cost.reported",
      entityType: "cost_event",
      entityId: event.id,
      details: { costCents: event.costCents, model: event.model },
    });

    res.status(201).json(event);
  });

  router.post("/finance-events", validate(createFinanceEventSchema), async (req, res) => {
    assertOrgAccess(req);
    assertBoard(req);

    const event = await finance.createEvent({
      ...req.body,
      occurredAt: new Date(req.body.occurredAt),
    });

    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "finance_event.reported",
      entityType: "finance_event",
      entityId: event.id,
      details: {
        amountCents: event.amountCents,
        biller: event.biller,
        eventKind: event.eventKind,
        direction: event.direction,
      },
    });

    res.status(201).json(event);
  });

  router.get("/costs/summary", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const summary = await costs.summary(range);
    res.json(summary);
  });

  router.get("/issues/:id/cost-summary", async (req, res) => {
    const rawId = req.params.id as string;
    const issue = await getAccessibleResource(req, res, resolveIssueByRef(rawId), "Issue not found");
    if (!issue) return;
    if (!(await assertIssueCostReadAllowed(req, res, issue))) return;
    const excludeRoot = req.query.excludeRoot === "true" || req.query.excludeRoot === "1";
    const summary = await costs.issueTreeSummary(issue.id, { excludeRoot });
    res.json(summary);
  });

  router.get("/costs/by-agent", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const rows = await costs.byAgent(range);
    res.json(rows);
  });

  router.get("/costs/by-agent-model", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const rows = await costs.byAgentModel(range);
    res.json(rows);
  });

  router.get("/costs/by-provider", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const rows = await costs.byProvider(range);
    res.json(rows);
  });

  router.get("/costs/by-biller", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const rows = await costs.byBiller(range);
    res.json(rows);
  });

  router.get("/costs/finance-summary", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const summary = await finance.summary(range);
    res.json(summary);
  });

  router.get("/costs/finance-by-biller", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const rows = await finance.byBiller(range);
    res.json(rows);
  });

  router.get("/costs/finance-by-kind", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const rows = await finance.byKind(range);
    res.json(rows);
  });

  router.get("/costs/finance-events", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const limit = parseCostLimit(req.query);
    const rows = await finance.list(range, limit);
    res.json(rows);
  });

  router.get("/costs/window-spend", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const rows = await costs.windowSpend();
    res.json(rows);
  });

  router.get("/costs/quota-windows", async (req, res) => {
    assertOrgAccess(req);
    assertBoard(req);
    const company = await companies.getById(await organizationService(db).requireId());
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    const results = await fetchAllQuotaWindows();
    res.json(results);
  });

  router.get("/budgets/overview", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const overview = await budgets.overview();
    res.json(overview);
  });

  router.post(
    "/budgets/policies",
    validate(upsertBudgetPolicySchema),
    async (req, res) => {
      assertBoard(req);
      assertOrgAccess(req);
      const summary = await budgets.upsertPolicy(req.body, req.actor.userId ?? "board");
      res.json(summary);
    },
  );

  router.post(
    "/budget-incidents/:incidentId/resolve",
    validate(resolveBudgetIncidentSchema),
    async (req, res) => {
      assertBoard(req);
      const incidentId = req.params.incidentId as string;
      assertOrgAccess(req);
      const incident = await budgets.resolveIncident(incidentId, req.body, req.actor.userId ?? "board");
      res.json(incident);
    },
  );

  router.get("/costs/by-project", async (req, res) => {
    assertOrgAccess(req);
    if (!(await assertCompanyCostReadAllowed(req, res))) return;
    const range = parseCostDateRange(req.query);
    const rows = await costs.byProject(range);
    res.json(rows);
  });

  router.patch("/budgets", validate(updateBudgetSchema), async (req, res) => {
    assertBoard(req);
    assertOrgAccess(req);
    const organizationId = await organizationService(db).requireId();
    const company = await companies.update(organizationId, { budgetMonthlyCents: req.body.budgetMonthlyCents });
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    await logActivity(db, {
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "company.budget_updated",
      entityType: "company",
      entityId: organizationId,
      details: { budgetMonthlyCents: req.body.budgetMonthlyCents },
    });

    await budgets.upsertPolicy(
      {
        scopeType: "company",
        scopeId: organizationId,
        amount: req.body.budgetMonthlyCents,
        windowKind: "calendar_month_utc",
      },
      req.actor.userId ?? "board",
    );

    res.json(company);
  });

  router.patch("/agents/:agentId/budgets", validate(updateBudgetSchema), async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await getAccessibleResource(req, res, agents.getById(agentId), "Agent not found");
    if (!agent) return;

    assertBoard(req);

    const updated = await agents.update(agentId, { budgetMonthlyCents: req.body.budgetMonthlyCents });
    if (!updated) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "agent.budget_updated",
      entityType: "agent",
      entityId: updated.id,
      details: { budgetMonthlyCents: updated.budgetMonthlyCents },
    });

    await budgets.upsertPolicy(
      {
        scopeType: "agent",
        scopeId: updated.id,
        amount: updated.budgetMonthlyCents,
        windowKind: "calendar_month_utc",
      },
      req.actor.type === "board" ? req.actor.userId ?? "board" : null,
    );

    res.json(updated);
  });

  return router;
}
