import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../middleware/logger.js";

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Moves on-disk data written under the former company-scoped layout into the
 * organization layout:
 *   <instanceRoot>/companies/<organizationId>   -> <instanceRoot>/organization
 *   <instanceRoot>/projects/<organizationId>/*  -> <instanceRoot>/projects/*
 * Existing targets are never overwritten, so the move is idempotent.
 */
export async function migrateOrganizationDataDirs(instanceRoot: string, organizationId: string): Promise<void> {
  const legacyCompanyRoot = path.join(instanceRoot, "companies", organizationId);
  const organizationRoot = path.join(instanceRoot, "organization");
  if (await exists(legacyCompanyRoot) && !(await exists(organizationRoot))) {
    await fs.rename(legacyCompanyRoot, organizationRoot);
    logger.info({ from: legacyCompanyRoot, to: organizationRoot }, "Moved organization data directory");
  }

  const legacyProjectsRoot = path.join(instanceRoot, "projects", organizationId);
  if (!(await exists(legacyProjectsRoot))) return;
  for (const entry of await fs.readdir(legacyProjectsRoot)) {
    const target = path.join(instanceRoot, "projects", entry);
    if (await exists(target)) {
      logger.warn({ source: path.join(legacyProjectsRoot, entry), target }, "Skipped project workspace move; target exists");
      continue;
    }
    await fs.rename(path.join(legacyProjectsRoot, entry), target);
  }
  await fs.rmdir(legacyProjectsRoot).catch(() => undefined);
}
