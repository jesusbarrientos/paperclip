import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { companyService, organizationService } from "../services/index.js";
import { assertBoardOrAgent, assertCompanyAccess } from "./authz.js";

export function organizationRoutes(db: Db) {
  const router = Router();
  const companies = companyService(db);
  const organization = organizationService(db);

  router.get("/organization", async (req, res) => {
    assertBoardOrAgent(req);
    const organizationId = await organization.findId();
    if (!organizationId) {
      res.status(404).json({ error: "Organization not initialized", code: "organization_missing" });
      return;
    }
    assertCompanyAccess(req, organizationId);
    const row = await companies.getById(organizationId);
    if (!row) {
      res.status(404).json({ error: "Organization not initialized", code: "organization_missing" });
      return;
    }
    res.json(row);
  });

  return router;
}
