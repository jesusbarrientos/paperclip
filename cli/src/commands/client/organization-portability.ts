import { Command } from "commander";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type {
  CompanyPortabilityFileEntry,
  CompanyPortabilityExportResult,
  CompanyPortabilityInclude,
  CompanyPortabilityPreviewResult,
  CompanyPortabilityImportResult,
} from "@paperclipai/shared";
import {
  buildAlreadyImportedMessage,
  companyImportTransferApplyPath,
  companyImportTransferPartPath,
  companyImportTransferPreviewPath,
  COMPANY_IMPORT_TRANSFERS_API_PATH,
  type CompanyImportTransferCreated,
  type CompanyImportTransferDeclaration,
} from "@paperclipai/shared/company-import-transfer";
import { getTelemetryClient, trackCompanyImported } from "../../telemetry.js";
import { ApiRequestError, type PaperclipApiClient } from "../../client/http.js";
import { openUrl } from "../../client/board-auth.js";
import {
  binaryContentTypeByExtension,
  bytesToPortableFileEntry,
  createStoredZipArchive,
  isBlobStorePath,
  readZipArchive,
} from "./zip.js";
import {
  addCommonClientOptions,
  apiPath,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

type ImportCollisionMode = "rename" | "skip" | "replace";

interface OrganizationExportOptions extends BaseClientOptions {
  out?: string;
  include?: string;
  skills?: string;
  projects?: string;
  issues?: string;
  projectIssues?: string;
  expandReferencedSkills?: boolean;
  force?: boolean;
}

interface OrganizationImportOptions extends BaseClientOptions {
  include?: string;
  agents?: string;
  collision?: ImportCollisionMode;
  ref?: string;
  paperclipUrl?: string;
  agentSafe?: boolean;
  yes?: boolean;
  dryRun?: boolean;
}

const DEFAULT_EXPORT_INCLUDE: CompanyPortabilityInclude = {
  company: true,
  agents: true,
  projects: false,
  issues: false,
  skills: false,
};

const DEFAULT_IMPORT_INCLUDE: CompanyPortabilityInclude = {
  company: true,
  agents: true,
  projects: true,
  issues: true,
  skills: true,
};

const IMPORT_INCLUDE_OPTIONS: Array<{
  value: keyof CompanyPortabilityInclude;
  label: string;
  hint: string;
}> = [
  { value: "company", label: "Organization", hint: "name, branding, and organization settings" },
  { value: "projects", label: "Projects", hint: "projects and workspace metadata" },
  { value: "issues", label: "Tasks", hint: "tasks and recurring routines" },
  { value: "agents", label: "Agents", hint: "agent records and org structure" },
  { value: "skills", label: "Skills", hint: "skill packages and references" },
];

const IMPORT_PREVIEW_SAMPLE_LIMIT = 6;

type ImportSelectableGroup = "projects" | "issues" | "agents" | "skills";

type ImportSelectionCatalog = {
  company: {
    includedByDefault: boolean;
    files: string[];
  };
  projects: Array<{ key: string; label: string; hint?: string; files: string[] }>;
  issues: Array<{ key: string; label: string; hint?: string; files: string[] }>;
  agents: Array<{ key: string; label: string; hint?: string; files: string[] }>;
  skills: Array<{ key: string; label: string; hint?: string; files: string[] }>;
  extensionPath: string | null;
};

type ImportSelectionState = {
  company: boolean;
  projects: Set<string>;
  issues: Set<string>;
  agents: Set<string>;
  skills: Set<string>;
};

function portableFileEntryToWriteValue(entry: CompanyPortabilityFileEntry): string | Uint8Array {
  if (typeof entry === "string") return entry;
  return Buffer.from(entry.data, "base64");
}

export function parseInclude(
  input: string | undefined,
  fallback: CompanyPortabilityInclude = DEFAULT_EXPORT_INCLUDE,
): CompanyPortabilityInclude {
  if (!input || !input.trim()) return { ...fallback };
  const values = input.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
  const include = {
    company: values.includes("organization") || values.includes("company"),
    agents: values.includes("agents"),
    projects: values.includes("projects"),
    issues: values.includes("issues") || values.includes("tasks"),
    skills: values.includes("skills"),
  };
  if (!include.company && !include.agents && !include.projects && !include.issues && !include.skills) {
    throw new Error("Invalid --include value. Use one or more of: organization,agents,projects,issues,tasks,skills");
  }
  return include;
}

function parseAgents(input: string | undefined): "all" | string[] {
  if (!input || !input.trim()) return "all";
  const normalized = input.trim().toLowerCase();
  if (normalized === "all") return "all";
  const values = input.split(",").map((part) => part.trim()).filter(Boolean);
  if (values.length === 0) return "all";
  return Array.from(new Set(values));
}

function parseCsvValues(input: string | undefined): string[] {
  if (!input || !input.trim()) return [];
  return Array.from(new Set(input.split(",").map((part) => part.trim()).filter(Boolean)));
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function resolveImportInclude(input: string | undefined): CompanyPortabilityInclude {
  return parseInclude(input, DEFAULT_IMPORT_INCLUDE);
}

function normalizePortablePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function shouldIncludePortableFile(filePath: string): boolean {
  const baseName = path.basename(filePath);
  const isMarkdown = baseName.endsWith(".md");
  const isPaperclipYaml = baseName === ".paperclip.yaml" || baseName === ".paperclip.yml";
  const contentType = binaryContentTypeByExtension[path.extname(baseName).toLowerCase()];
  return isMarkdown || isPaperclipYaml || Boolean(contentType) || isBlobStorePath(filePath);
}

function findPortableExtensionPath(files: Record<string, CompanyPortabilityFileEntry>): string | null {
  if (files[".paperclip.yaml"] !== undefined) return ".paperclip.yaml";
  if (files[".paperclip.yml"] !== undefined) return ".paperclip.yml";
  return Object.keys(files).find((entry) => entry.endsWith("/.paperclip.yaml") || entry.endsWith("/.paperclip.yml")) ?? null;
}

function collectFilesUnderDirectory(
  files: Record<string, CompanyPortabilityFileEntry>,
  directory: string,
  opts?: { excludePrefixes?: string[] },
): string[] {
  const normalizedDirectory = normalizePortablePath(directory).replace(/\/+$/, "");
  if (!normalizedDirectory) return [];
  const prefix = `${normalizedDirectory}/`;
  const excluded = (opts?.excludePrefixes ?? []).map((entry) => normalizePortablePath(entry).replace(/\/+$/, "")).filter(Boolean);
  return Object.keys(files)
    .map(normalizePortablePath)
    .filter((filePath) => filePath.startsWith(prefix))
    .filter((filePath) => !excluded.some((excludePrefix) => filePath.startsWith(`${excludePrefix}/`)))
    .sort((left, right) => left.localeCompare(right));
}

function collectEntityFiles(
  files: Record<string, CompanyPortabilityFileEntry>,
  entryPath: string,
  opts?: { excludePrefixes?: string[] },
): string[] {
  const normalizedPath = normalizePortablePath(entryPath);
  const directory = normalizedPath.includes("/") ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) : "";
  const selected = new Set<string>([normalizedPath]);
  if (directory) {
    for (const filePath of collectFilesUnderDirectory(files, directory, opts)) {
      selected.add(filePath);
    }
  }
  return Array.from(selected).sort((left, right) => left.localeCompare(right));
}

export function buildImportSelectionCatalog(preview: CompanyPortabilityPreviewResult): ImportSelectionCatalog {
  const selectedAgentSlugs = new Set(preview.selectedAgentSlugs);
  const companyFiles = new Set<string>();
  const companyPath = preview.manifest.company?.path ? normalizePortablePath(preview.manifest.company.path) : null;
  if (companyPath) {
    companyFiles.add(companyPath);
  }
  const readmePath = Object.keys(preview.files).find((entry) => normalizePortablePath(entry) === "README.md");
  if (readmePath) {
    companyFiles.add(normalizePortablePath(readmePath));
  }
  const logoPath = preview.manifest.company?.logoPath ? normalizePortablePath(preview.manifest.company.logoPath) : null;
  if (logoPath && preview.files[logoPath] !== undefined) {
    companyFiles.add(logoPath);
  }

  return {
    company: {
      includedByDefault: preview.include.company && preview.manifest.company !== null,
      files: Array.from(companyFiles).sort((left, right) => left.localeCompare(right)),
    },
    projects: preview.manifest.projects.map((project) => {
      const projectPath = normalizePortablePath(project.path);
      const projectDir = projectPath.includes("/") ? projectPath.slice(0, projectPath.lastIndexOf("/")) : "";
      return {
        key: project.slug,
        label: project.name,
        hint: project.slug,
        files: collectEntityFiles(preview.files, projectPath, {
          excludePrefixes: projectDir ? [`${projectDir}/issues`] : [],
        }),
      };
    }),
    issues: preview.manifest.issues.map((issue) => ({
      key: issue.slug,
      label: issue.title,
      hint: issue.identifier ?? issue.slug,
      files: collectEntityFiles(preview.files, normalizePortablePath(issue.path)),
    })),
    agents: preview.manifest.agents
      .filter((agent) => selectedAgentSlugs.size === 0 || selectedAgentSlugs.has(agent.slug))
      .map((agent) => ({
        key: agent.slug,
        label: agent.name,
        hint: agent.slug,
        files: collectEntityFiles(preview.files, normalizePortablePath(agent.path)),
      })),
    skills: preview.manifest.skills.map((skill) => ({
      key: skill.slug,
      label: skill.name,
      hint: skill.slug,
      files: collectEntityFiles(preview.files, normalizePortablePath(skill.path)),
    })),
    extensionPath: findPortableExtensionPath(preview.files),
  };
}

function toKeySet(items: Array<{ key: string }>): Set<string> {
  return new Set(items.map((item) => item.key));
}

export function buildDefaultImportSelectionState(catalog: ImportSelectionCatalog): ImportSelectionState {
  return {
    company: catalog.company.includedByDefault,
    projects: toKeySet(catalog.projects),
    issues: toKeySet(catalog.issues),
    agents: toKeySet(catalog.agents),
    skills: toKeySet(catalog.skills),
  };
}

function countSelected(state: ImportSelectionState, group: ImportSelectableGroup): number {
  return state[group].size;
}

function countTotal(catalog: ImportSelectionCatalog, group: ImportSelectableGroup): number {
  return catalog[group].length;
}

function summarizeGroupSelection(catalog: ImportSelectionCatalog, state: ImportSelectionState, group: ImportSelectableGroup): string {
  return `${countSelected(state, group)}/${countTotal(catalog, group)} selected`;
}

function getGroupLabel(group: ImportSelectableGroup): string {
  switch (group) {
    case "projects":
      return "Projects";
    case "issues":
      return "Tasks";
    case "agents":
      return "Agents";
    case "skills":
      return "Skills";
  }
}

export function buildSelectedFilesFromImportSelection(
  catalog: ImportSelectionCatalog,
  state: ImportSelectionState,
): string[] {
  const selected = new Set<string>();

  if (state.company) {
    for (const filePath of catalog.company.files) {
      selected.add(normalizePortablePath(filePath));
    }
  }

  for (const group of ["projects", "issues", "agents", "skills"] as const) {
    const selectedKeys = state[group];
    for (const item of catalog[group]) {
      if (!selectedKeys.has(item.key)) continue;
      for (const filePath of item.files) {
        selected.add(normalizePortablePath(filePath));
      }
    }
  }

  if (catalog.extensionPath) {
    selected.add(normalizePortablePath(catalog.extensionPath));
  }

  return Array.from(selected).sort((left, right) => left.localeCompare(right));
}

export function buildDefaultImportAdapterOverrides(
  preview: Pick<CompanyPortabilityPreviewResult, "manifest" | "selectedAgentSlugs">,
): Record<string, { adapterType: string }> | undefined {
  const selectedAgentSlugs = new Set(preview.selectedAgentSlugs);
  const overrides = Object.fromEntries(
    preview.manifest.agents
      .filter((agent) => selectedAgentSlugs.size === 0 || selectedAgentSlugs.has(agent.slug))
      .filter((agent) => agent.adapterType === "process")
      .map((agent) => [
        agent.slug,
        {
          // TODO: replace this temporary claude_local fallback with adapter selection in the import TUI.
          adapterType: "claude_local",
        },
      ]),
  );
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function buildDefaultImportAdapterMessages(
  overrides: Record<string, { adapterType: string }> | undefined,
): string[] {
  if (!overrides) return [];
  const adapterTypes = Array.from(new Set(Object.values(overrides).map((override) => override.adapterType)))
    .map((adapterType) => adapterType.replace(/_/g, "-"));
  const agentCount = Object.keys(overrides).length;
  return [
    `Using ${adapterTypes.join(", ")} adapter${adapterTypes.length === 1 ? "" : "s"} for ${agentCount} imported ${pluralize(agentCount, "agent")} without an explicit adapter.`,
  ];
}

async function promptForImportSelection(preview: CompanyPortabilityPreviewResult): Promise<string[]> {
  const catalog = buildImportSelectionCatalog(preview);
  const state = buildDefaultImportSelectionState(catalog);

  while (true) {
    const choice = await p.select<ImportSelectableGroup | "company" | "confirm">({
      message: "Select what Paperclip should import",
      options: [
        {
          value: "company",
          label: state.company ? "Organization: included" : "Organization: skipped",
          hint: catalog.company.files.length > 0 ? "toggle organization metadata" : "no organization metadata in package",
        },
        {
          value: "projects",
          label: "Select Projects",
          hint: summarizeGroupSelection(catalog, state, "projects"),
        },
        {
          value: "issues",
          label: "Select Tasks",
          hint: summarizeGroupSelection(catalog, state, "issues"),
        },
        {
          value: "agents",
          label: "Select Agents",
          hint: summarizeGroupSelection(catalog, state, "agents"),
        },
        {
          value: "skills",
          label: "Select Skills",
          hint: summarizeGroupSelection(catalog, state, "skills"),
        },
        {
          value: "confirm",
          label: "Confirm",
          hint: `${buildSelectedFilesFromImportSelection(catalog, state).length} files selected`,
        },
      ],
      initialValue: "confirm",
    });

    if (p.isCancel(choice)) {
      p.cancel("Import cancelled.");
      process.exit(0);
    }

    if (choice === "confirm") {
      const selectedFiles = buildSelectedFilesFromImportSelection(catalog, state);
      if (selectedFiles.length === 0) {
        p.note("Select at least one import target before confirming.", "Nothing selected");
        continue;
      }
      return selectedFiles;
    }

    if (choice === "company") {
      if (catalog.company.files.length === 0) {
        p.note("This package does not include organization metadata to toggle.", "No organization metadata");
        continue;
      }
      state.company = !state.company;
      continue;
    }

    const group = choice;
    const groupItems = catalog[group];
    if (groupItems.length === 0) {
      p.note(`This package does not include any ${getGroupLabel(group).toLowerCase()}.`, `No ${getGroupLabel(group)}`);
      continue;
    }

    const selection = await p.multiselect<string>({
      message: `${getGroupLabel(group)} to import. Space toggles, enter returns to the main menu.`,
      options: groupItems.map((item) => ({
        value: item.key,
        label: item.label,
        hint: item.hint,
      })),
      initialValues: Array.from(state[group]),
    });

    if (p.isCancel(selection)) {
      p.cancel("Import cancelled.");
      process.exit(0);
    }

    state[group] = new Set(selection);
  }
}

function summarizeInclude(include: CompanyPortabilityInclude): string {
  const labels = IMPORT_INCLUDE_OPTIONS
    .filter((option) => include[option.value])
    .map((option) => option.label.toLowerCase());
  return labels.length > 0 ? labels.join(", ") : "nothing selected";
}

function formatSourceLabel(source: { type: "inline"; rootPath?: string | null } | { type: "github"; url: string }): string {
  if (source.type === "github") {
    return `GitHub: ${source.url}`;
  }
  return `Local package: ${source.rootPath?.trim() || "(current folder)"}`;
}

function formatTargetLabel(preview?: CompanyPortabilityPreviewResult): string {
  return preview?.targetCompanyName?.trim() || "this organization";
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function summarizePlanCounts(
  plans: Array<{ action: "create" | "update" | "skip" }>,
  noun: string,
): string {
  if (plans.length === 0) return `0 ${pluralize(0, noun)} selected`;
  const createCount = plans.filter((plan) => plan.action === "create").length;
  const updateCount = plans.filter((plan) => plan.action === "update").length;
  const skipCount = plans.filter((plan) => plan.action === "skip").length;
  const parts: string[] = [];
  if (createCount > 0) parts.push(`${createCount} create`);
  if (updateCount > 0) parts.push(`${updateCount} update`);
  if (skipCount > 0) parts.push(`${skipCount} skip`);
  return `${plans.length} ${pluralize(plans.length, noun)} total (${parts.join(", ")})`;
}

function summarizeImportAgentResults(agents: CompanyPortabilityImportResult["agents"]): string {
  if (agents.length === 0) return "0 agents changed";
  const created = agents.filter((agent) => agent.action === "created").length;
  const updated = agents.filter((agent) => agent.action === "updated").length;
  const skipped = agents.filter((agent) => agent.action === "skipped").length;
  const parts: string[] = [];
  if (created > 0) parts.push(`${created} created`);
  if (updated > 0) parts.push(`${updated} updated`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  return `${agents.length} ${pluralize(agents.length, "agent")} total (${parts.join(", ")})`;
}

function summarizeImportSkillResults(skills: CompanyPortabilityImportResult["skills"]): string {
  if (skills.length === 0) return "0 skills changed";
  const actions = ["created", "renamed", "replaced", "skipped"] as const;
  const parts = actions.flatMap((action) => {
    const count = skills.filter((skill) => skill.action === action).length;
    return count > 0 ? [`${count} ${action}`] : [];
  });
  return `${skills.length} ${pluralize(skills.length, "skill")} total (${parts.join(", ")})`;
}

function summarizeImportProjectResults(projects: CompanyPortabilityImportResult["projects"]): string {
  if (projects.length === 0) return "0 projects changed";
  const created = projects.filter((project) => project.action === "created").length;
  const updated = projects.filter((project) => project.action === "updated").length;
  const skipped = projects.filter((project) => project.action === "skipped").length;
  const parts: string[] = [];
  if (created > 0) parts.push(`${created} created`);
  if (updated > 0) parts.push(`${updated} updated`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  return `${projects.length} ${pluralize(projects.length, "project")} total (${parts.join(", ")})`;
}

function actionChip(action: string): string {
  switch (action) {
    case "create":
    case "created":
      return pc.green(action);
    case "update":
    case "updated":
      return pc.yellow(action);
    case "skip":
    case "skipped":
    case "none":
    case "unchanged":
      return pc.dim(action);
    default:
      return action;
  }
}

function appendPreviewExamples(
  lines: string[],
  title: string,
  entries: Array<{ action: string; label: string; reason?: string | null }>,
): void {
  if (entries.length === 0) return;
  lines.push("");
  lines.push(pc.bold(title));
  const shown = entries.slice(0, IMPORT_PREVIEW_SAMPLE_LIMIT);
  for (const entry of shown) {
    const reason = entry.reason?.trim() ? pc.dim(` (${entry.reason.trim()})`) : "";
    lines.push(`- ${actionChip(entry.action)} ${entry.label}${reason}`);
  }
  if (entries.length > shown.length) {
    lines.push(pc.dim(`- +${entries.length - shown.length} more`));
  }
}

function appendMessageBlock(lines: string[], title: string, messages: string[]): void {
  if (messages.length === 0) return;
  lines.push("");
  lines.push(pc.bold(title));
  for (const message of messages) {
    lines.push(`- ${message}`);
  }
}

export function renderImportPreview(
  preview: CompanyPortabilityPreviewResult,
  meta: {
    sourceLabel: string;
    targetLabel: string;
    infoMessages?: string[];
  },
): string {
  const lines: string[] = [
    `${pc.bold("Source")}  ${meta.sourceLabel}`,
    `${pc.bold("Target")}  ${meta.targetLabel}`,
    `${pc.bold("Include")} ${summarizeInclude(preview.include)}`,
    `${pc.bold("Mode")}    ${preview.collisionStrategy} collisions`,
    "",
    pc.bold("Package"),
    `- organization: ${preview.manifest.company?.name ?? preview.manifest.source?.companyName ?? "not included"}`,
    `- agents: ${preview.manifest.agents.length}`,
    `- projects: ${preview.manifest.projects.length}`,
    `- tasks: ${preview.manifest.issues.length}`,
    `- skills: ${preview.manifest.skills.length}`,
  ];

  if (preview.envInputs.length > 0) {
    const requiredCount = preview.envInputs.filter((item) => item.requirement === "required").length;
    lines.push(`- env inputs: ${preview.envInputs.length} (${requiredCount} required)`);
  }

  lines.push("");
  lines.push(pc.bold("Plan"));
  lines.push(`- organization: ${actionChip(preview.plan.companyAction === "none" ? "unchanged" : preview.plan.companyAction)}`);
  lines.push(`- agents: ${summarizePlanCounts(preview.plan.agentPlans, "agent")}`);
  lines.push(`- projects: ${summarizePlanCounts(preview.plan.projectPlans, "project")}`);
  lines.push(`- tasks: ${summarizePlanCounts(preview.plan.issuePlans, "task")}`);
  if (preview.include.skills) {
    lines.push(`- skills: ${preview.manifest.skills.length} ${pluralize(preview.manifest.skills.length, "skill")} packaged`);
  }

  appendPreviewExamples(
    lines,
    "Agent examples",
    preview.plan.agentPlans.map((plan) => ({
      action: plan.action,
      label: `${plan.slug} -> ${plan.plannedName}`,
      reason: plan.reason,
    })),
  );
  appendPreviewExamples(
    lines,
    "Project examples",
    preview.plan.projectPlans.map((plan) => ({
      action: plan.action,
      label: `${plan.slug} -> ${plan.plannedName}`,
      reason: plan.reason,
    })),
  );
  appendPreviewExamples(
    lines,
    "Task examples",
    preview.plan.issuePlans.map((plan) => ({
      action: plan.action,
      label: `${plan.slug} -> ${plan.plannedTitle}`,
      reason: plan.reason,
    })),
  );

  appendMessageBlock(lines, pc.cyan("Info"), meta.infoMessages ?? []);
  appendMessageBlock(lines, pc.yellow("Warnings"), preview.warnings);
  appendMessageBlock(lines, pc.red("Errors"), preview.errors);

  return lines.join("\n");
}

export function renderImportResult(
  result: CompanyPortabilityImportResult,
  meta: { targetLabel: string; dashboardUrl?: string; infoMessages?: string[] },
): string {
  const skills = result.skills ?? [];
  const lines: string[] = [
    `${pc.bold("Target")}  ${meta.targetLabel}`,
    `${pc.bold("Org")}     ${result.company.name} (${actionChip(result.company.action)})`,
    `${pc.bold("Agents")}  ${summarizeImportAgentResults(result.agents)}`,
    `${pc.bold("Skills")}  ${summarizeImportSkillResults(skills)}`,
    `${pc.bold("Projects")} ${summarizeImportProjectResults(result.projects)}`,
  ];

  if (meta.dashboardUrl) {
    lines.splice(1, 0, `${pc.bold("URL")}     ${meta.dashboardUrl}`);
  }

  appendPreviewExamples(
    lines,
    "Agent results",
    result.agents.map((agent) => ({
      action: agent.action,
      label: `${agent.slug} -> ${agent.name}`,
      reason: agent.reason,
    })),
  );
  appendPreviewExamples(
    lines,
    "Skill results",
    skills.map((skill) => ({
      action: skill.action,
      label: `${skill.originalSlug} -> ${skill.slug}`,
      reason: skill.reason,
    })),
  );
  appendPreviewExamples(
    lines,
    "Project results",
    result.projects.map((project) => ({
      action: project.action,
      label: `${project.slug} -> ${project.name}`,
      reason: project.reason,
    })),
  );

  if (result.envInputs.length > 0) {
    lines.push("");
    lines.push(pc.bold("Env inputs"));
    lines.push(
      `- ${result.envInputs.length} ${pluralize(result.envInputs.length, "input")} may need values after import`,
    );
  }

  appendMessageBlock(lines, pc.cyan("Info"), meta.infoMessages ?? []);
  appendMessageBlock(lines, pc.yellow("Warnings"), result.warnings);

  return lines.join("\n");
}

function printImportView(title: string, body: string, opts?: { interactive?: boolean }): void {
  if (opts?.interactive) {
    p.note(body, title);
    return;
  }
  console.log(pc.bold(title));
  console.log(body);
}

export function resolveOrganizationImportApiPath(input: { dryRun: boolean; agentSafe?: boolean }): string {
  if (input.agentSafe) {
    return input.dryRun ? "/api/organization/imports/preview" : "/api/organization/imports/apply";
  }
  return input.dryRun ? "/api/organization/import/preview" : "/api/organization/import?async=1";
}

export function buildOrganizationDashboardUrl(apiBase: string): string {
  const url = new URL(apiBase);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/dashboard`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function resolveImportApplyConfirmationMode(input: {
  yes?: boolean;
  interactive: boolean;
  json: boolean;
}): "skip" | "prompt" {
  if (input.yes) {
    return "skip";
  }
  if (input.json) {
    throw new Error(
      "Applying an organization import with --json requires --yes. Use --dry-run first to inspect the preview.",
    );
  }
  if (!input.interactive) {
    throw new Error(
      "Applying an organization import from a non-interactive terminal requires --yes. Use --dry-run first to inspect the preview.",
    );
  }
  return "prompt";
}

export function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

export function looksLikeRepoUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:") return false;
    const segments = url.pathname.split("/").filter(Boolean);
    return segments.length >= 2;
  } catch {
    return false;
  }
}

function isGithubSegment(input: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(input);
}

export function isGithubShorthand(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || isHttpUrl(trimmed)) return false;
  if (
    trimmed.startsWith(".") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("~") ||
    trimmed.includes("\\") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    return false;
  }

  const segments = trimmed.split("/").filter(Boolean);
  return segments.length >= 2 && segments.every(isGithubSegment);
}

function normalizeGithubImportPath(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().replace(/^\/+|\/+$/g, "");
  return trimmed || null;
}

function buildGithubImportUrl(input: {
  hostname?: string;
  owner: string;
  repo: string;
  ref?: string | null;
  path?: string | null;
  companyPath?: string | null;
}): string {
  const host = input.hostname || "github.com";
  const url = new URL(`https://${host}/${input.owner}/${input.repo.replace(/\.git$/i, "")}`);
  const ref = input.ref?.trim();
  if (ref) {
    url.searchParams.set("ref", ref);
  }
  const companyPath = normalizeGithubImportPath(input.companyPath);
  if (companyPath) {
    url.searchParams.set("companyPath", companyPath);
    return url.toString();
  }
  const sourcePath = normalizeGithubImportPath(input.path);
  if (sourcePath) {
    url.searchParams.set("path", sourcePath);
  }
  return url.toString();
}

export function normalizeGithubImportSource(input: string, refOverride?: string): string {
  const trimmed = input.trim();
  const ref = refOverride?.trim();

  if (isGithubShorthand(trimmed)) {
    const [owner, repo, ...repoPath] = trimmed.split("/").filter(Boolean);
    return buildGithubImportUrl({
      owner: owner!,
      repo: repo!,
      ref: ref || "main",
      path: repoPath.join("/"),
    });
  }

  if (!looksLikeRepoUrl(trimmed)) {
    throw new Error("GitHub source must be a GitHub or GitHub Enterprise URL, or owner/repo[/path] shorthand.");
  }
  if (!ref) {
    return trimmed;
  }

  const url = new URL(trimmed);
  const hostname = url.hostname;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid GitHub URL.");
  }

  const owner = parts[0]!;
  const repo = parts[1]!;
  const existingPath = normalizeGithubImportPath(url.searchParams.get("path"));
  const existingCompanyPath = normalizeGithubImportPath(url.searchParams.get("companyPath"));
  if (existingCompanyPath) {
    return buildGithubImportUrl({ hostname, owner, repo, ref, companyPath: existingCompanyPath });
  }
  if (existingPath) {
    return buildGithubImportUrl({ hostname, owner, repo, ref, path: existingPath });
  }
  if (parts[2] === "tree") {
    return buildGithubImportUrl({ hostname, owner, repo, ref, path: parts.slice(4).join("/") });
  }
  if (parts[2] === "blob") {
    return buildGithubImportUrl({ hostname, owner, repo, ref, companyPath: parts.slice(4).join("/") });
  }
  return buildGithubImportUrl({ hostname, owner, repo, ref });
}

async function pathExists(inputPath: string): Promise<boolean> {
  try {
    await stat(path.resolve(inputPath));
    return true;
  } catch {
    return false;
  }
}

async function collectPackageFileBytes(
  root: string,
  current: string,
  files: Record<string, Uint8Array>,
): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".git")) continue;
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await collectPackageFileBytes(root, absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = path.relative(root, absolutePath).replace(/\\/g, "/");
    if (!shouldIncludePortableFile(relativePath)) continue;
    files[relativePath] = await readFile(absolutePath);
  }
}

export async function resolveInlineSourceFromPath(inputPath: string): Promise<{
  rootPath: string;
  files: Record<string, CompanyPortabilityFileEntry>;
}> {
  const resolved = path.resolve(inputPath);
  const resolvedStat = await stat(resolved);
  if (resolvedStat.isFile() && path.extname(resolved).toLowerCase() === ".zip") {
    const archive = await readZipArchive(await readFile(resolved));
    const filteredFiles = Object.fromEntries(
      Object.entries(archive.files).filter(([relativePath]) => shouldIncludePortableFile(relativePath)),
    );
    return {
      rootPath: archive.rootPath ?? path.basename(resolved, ".zip"),
      files: filteredFiles,
    };
  }

  const rootDir = resolvedStat.isDirectory() ? resolved : path.dirname(resolved);
  const fileBytes: Record<string, Uint8Array> = {};
  await collectPackageFileBytes(rootDir, rootDir, fileBytes);
  return {
    rootPath: path.basename(rootDir),
    files: Object.fromEntries(
      Object.entries(fileBytes).map(([relativePath, bytes]) => [
        relativePath,
        bytesToPortableFileEntry(relativePath, bytes),
      ]),
    ),
  };
}

// ── Chunked transfer flow for large local packages ───────────────────
//
// A local package over the threshold is not posted as one inline JSON body:
// its zip is declared as a chunked transfer (whole-file and per-part sha256),
// the parts are uploaded individually with per-part retries, and preview and
// apply run server-side against the assembled spool. Re-declaring the same
// content — after a failure or an interrupted run — resumes the prior
// transfer, so only the parts the server is missing are ever re-uploaded.

export const CHUNKED_IMPORT_THRESHOLD_BYTES = 48 * 1024 * 1024;
// The agent-safe /api/organization/imports/* routes sit behind the server's
// default 10 MB JSON parser — only /api/organization/import/* carries the
// 64 MB portable limit — and they cannot use chunked transfers (board only),
// so an agent-safe package must stay inline under this lower threshold.
export const AGENT_SAFE_INLINE_IMPORT_THRESHOLD_BYTES = 8 * 1024 * 1024;
export const IMPORT_TRANSFER_PART_SIZE_BYTES = 32 * 1024 * 1024;
const IMPORT_TRANSFER_PART_ATTEMPTS = 3;

// ── Inline request size estimation ───────────────────────────────────
//
// Mirrors `estimateInlineImportBytes` in ui/src/lib/import-preflight.ts (the
// CLI cannot import from ui/) — keep the math on both sides in sync. The
// server enforces its body limit on raw request bytes, so each entry is
// measured the way it actually travels: JSON-escaped UTF-8 for text
// (multi-byte characters and escape sequences both inflate past
// `String.length`), and the base64 payload plus its object structure for
// binary entries (base64 and MIME types are ASCII, one byte per character).

const inlineEstimateUtf8 = new TextEncoder();

// Fixed serialization overhead of a base64 entry object around its data and
// contentType values: {"encoding":"base64","data":"…","contentType":"…"}.
const BASE64_ENTRY_STRUCTURE_BYTES = '{"encoding":"base64","data":"","contentType":""}'.length;

// Allowance for everything in the request body besides the files map itself
// (rootPath, include flags, target, collision strategy, adapter overrides,
// braces and commas). Deliberately generous so the estimate never undercounts.
const REQUEST_ENVELOPE_ALLOWANCE_BYTES = 256 * 1024;

function fileEntryInlineBytes(entry: CompanyPortabilityFileEntry): number {
  if (typeof entry === "string") return inlineEstimateUtf8.encode(JSON.stringify(entry)).length;
  return BASE64_ENTRY_STRUCTURE_BYTES + entry.data.length + (entry.contentType?.length ?? 0);
}

/**
 * Approximate JSON request size of an inline import: JSON-escaped UTF-8 text
 * bytes, base64 payloads with their entry structure, the serialized file-path
 * keys (thousands of paths are real bytes), and an envelope allowance for the
 * rest of the request body.
 */
function estimateInlineImportBytes(files: Record<string, CompanyPortabilityFileEntry>): number {
  let total = REQUEST_ENVELOPE_ALLOWANCE_BYTES;
  for (const [filePath, entry] of Object.entries(files)) {
    // "path": entry,  → key bytes + colon + comma.
    total += inlineEstimateUtf8.encode(JSON.stringify(filePath)).length + 2 + fileEntryInlineBytes(entry);
  }
  return total;
}

export interface ImportTransferUploadProgress {
  uploadedParts: number;
  totalParts: number;
  uploadedBytes: number;
  totalBytes: number;
}

export function buildImportTransferManifest(zipBytes: Uint8Array): CompanyImportTransferDeclaration {
  const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const parts: CompanyImportTransferDeclaration["parts"] = [];
  for (let offset = 0; offset < zipBytes.length; offset += IMPORT_TRANSFER_PART_SIZE_BYTES) {
    const byteSize = Math.min(IMPORT_TRANSFER_PART_SIZE_BYTES, zipBytes.length - offset);
    parts.push({
      index: parts.length,
      byteSize,
      sha256: sha256(zipBytes.subarray(offset, offset + byteSize)),
    });
  }
  return {
    totalBytes: zipBytes.length,
    zipSha256: sha256(zipBytes),
    partSizeBytes: IMPORT_TRANSFER_PART_SIZE_BYTES,
    parts,
  };
}

/**
 * Resolve a local import source into raw zip bytes when its package is too
 * large to travel as one inline JSON body: a .zip file is read as-is (so its
 * declared hashes match the file on disk), a folder is packaged as a stored
 * zip in memory with the same walk filters the inline path uses. Both source
 * kinds are measured twice — raw bytes as a fast path, then the estimated
 * inline request size, because base64 inflates binary entries ~4/3 and a
 * compressed zip can expand far past its file size. Returns null for sources
 * under the threshold on both measures — those keep the inline JSON path.
 */
export async function resolveChunkedImportZip(
  inputPath: string,
  thresholdBytes: number = CHUNKED_IMPORT_THRESHOLD_BYTES,
): Promise<{
  zipBytes: Uint8Array;
  rootPath: string;
} | null> {
  const resolved = path.resolve(inputPath);
  const resolvedStat = await stat(resolved);
  if (resolvedStat.isFile() && path.extname(resolved).toLowerCase() === ".zip") {
    const zipBytes = new Uint8Array(await readFile(resolved));
    const rootPath = path.basename(resolved, ".zip");
    if (resolvedStat.size > thresholdBytes) return { zipBytes, rootPath };
    // A small compressed zip can still expand past server caps as inline
    // JSON (text compresses well and binary re-inflates ~4/3 as base64), so
    // the stay-inline decision uses the estimated request size of the same
    // entries the inline path would send. An unreadable zip stays inline so
    // that path surfaces its canonical parse error.
    let archive: Awaited<ReturnType<typeof readZipArchive>>;
    try {
      archive = await readZipArchive(zipBytes);
    } catch {
      return null;
    }
    if (estimateInlineImportBytes(archive.files) <= thresholdBytes) return null;
    return { zipBytes, rootPath };
  }
  if (!resolvedStat.isDirectory()) return null;
  const fileBytes: Record<string, Uint8Array> = {};
  await collectPackageFileBytes(resolved, resolved, fileBytes);
  const rootPath = path.basename(resolved);
  // Content bytes alone already past the threshold means the stored zip
  // (content plus headers) is too.
  const contentBytes = Object.values(fileBytes).reduce((sum, bytes) => sum + bytes.length, 0);
  if (contentBytes <= thresholdBytes) {
    // Raw bytes under the threshold can still blow past server caps once the
    // inline body is built (binary entries travel base64-inflated), so the
    // stay-inline decision is made on the estimated request size — the same
    // entries the inline path would send.
    const inlineEntries = Object.fromEntries(
      Object.entries(fileBytes).map(([relativePath, bytes]) => [
        relativePath,
        bytesToPortableFileEntry(relativePath, bytes),
      ]),
    );
    if (estimateInlineImportBytes(inlineEntries) <= thresholdBytes) return null;
  }
  return { zipBytes: createStoredZipArchive(fileBytes, rootPath), rootPath };
}

/**
 * Declare (or resume) the transfer for these zip bytes and upload every part
 * the server reports missing, sequentially with per-part retries. Resolves
 * with the transfer id once the server holds every part.
 */
export async function uploadImportTransfer(
  api: Pick<PaperclipApiClient, "post" | "putRaw">,
  zipBytes: Uint8Array,
  opts: { onProgress?: (progress: ImportTransferUploadProgress) => void } = {},
): Promise<string> {
  const manifest = buildImportTransferManifest(zipBytes);
  const created = await api.post<CompanyImportTransferCreated>(
    COMPANY_IMPORT_TRANSFERS_API_PATH,
    manifest,
  );
  if (!created) {
    throw new Error("Import transfer declaration returned no data.");
  }
  if (created.alreadyCompleted) {
    // The server keys transfers by content, and this exact zip already
    // finished an apply — its spooled parts are gone, so it cannot re-run.
    throw new Error(buildAlreadyImportedMessage(created.company));
  }
  const missing = new Set(created.missingParts);
  let uploadedParts = manifest.parts.length - missing.size;
  let uploadedBytes = manifest.parts.reduce(
    (sum, part) => (missing.has(part.index) ? sum : sum + part.byteSize),
    0,
  );
  for (const part of manifest.parts) {
    if (!missing.has(part.index)) continue;
    const offset = part.index * manifest.partSizeBytes;
    const bytes = zipBytes.subarray(offset, offset + part.byteSize);
    let lastError: unknown = null;
    let uploaded = false;
    for (let attempt = 0; attempt < IMPORT_TRANSFER_PART_ATTEMPTS && !uploaded; attempt += 1) {
      try {
        await api.putRaw(
          `/api/organization${companyImportTransferPartPath(created.transferId, part.index)}`,
          bytes,
        );
        uploaded = true;
      } catch (err) {
        lastError = err;
      }
    }
    if (!uploaded) {
      // Parts already uploaded stay spooled server-side; re-running the
      // import resumes from them instead of starting over.
      throw lastError instanceof Error
        ? lastError
        : new Error(`Import transfer part ${part.index} failed to upload.`);
    }
    uploadedParts += 1;
    uploadedBytes += part.byteSize;
    opts.onProgress?.({
      uploadedParts,
      totalParts: manifest.parts.length,
      uploadedBytes,
      totalBytes: manifest.totalBytes,
    });
  }
  return created.transferId;
}

export async function writeExportToFolder(outDir: string, exported: CompanyPortabilityExportResult): Promise<void> {
  const root = path.resolve(outDir);
  await mkdir(root, { recursive: true });
  for (const [relativePath, content] of Object.entries(exported.files)) {
    const normalized = relativePath.replace(/\\/g, "/");
    const filePath = resolveExportOutputPath(root, normalized);
    await mkdir(path.dirname(filePath), { recursive: true });
    const writeValue = portableFileEntryToWriteValue(content);
    if (typeof writeValue === "string") {
      await writeFile(filePath, writeValue, "utf8");
    } else {
      await writeFile(filePath, writeValue);
    }
  }
}

export function resolveExportOutputPath(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const filePath = path.resolve(resolvedRoot, relativePath);
  const rootPrefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (filePath !== resolvedRoot && !filePath.startsWith(rootPrefix)) {
    throw new Error(`Refusing to write export file outside output directory: ${relativePath}`);
  }
  return filePath;
}

export async function confirmOverwriteExportDirectory(
  outDir: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const root = path.resolve(outDir);
  const stats = await stat(root).catch(() => null);
  if (!stats) return;
  if (!stats.isDirectory()) {
    throw new Error(`Export output path ${root} exists and is not a directory.`);
  }

  const entries = await readdir(root);
  if (entries.length === 0) return;

  // --force skips the guard for non-interactive/automated callers (e.g. the
  // nightly backup routine, which exports into a git clone that legitimately
  // still holds .git and BACKUP-README.md after cleaning tracked content).
  if (opts.force) return;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`Export output directory ${root} already contains files. Re-run interactively, pass --force, or choose an empty directory.`);
  }

  const confirmed = await p.confirm({
    message: `Overwrite existing files in ${root}?`,
    initialValue: false,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    throw new Error("Export cancelled.");
  }
}

interface ImportJobHandle {
  job: { id: string; status: string };
  statusUrl?: string;
  retryAfterMs?: number;
}

interface ImportJobStatusResponse {
  job: {
    id: string;
    status: "running" | "succeeded" | "failed";
    error?: { message?: string };
    importResult?: CompanyPortabilityImportResult;
  };
  retryAfterMs?: number;
  error?: string;
}

const DEFAULT_IMPORT_JOB_POLL_MS = 1000;

function isImportJobHandle(value: unknown): value is ImportJobHandle {
  if (!value || typeof value !== "object") return false;
  const job = (value as { job?: unknown }).job;
  return Boolean(job && typeof job === "object" && typeof (job as { id?: unknown }).id === "string");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForImportJob(
  api: Pick<PaperclipApiClient, "get">,
  handle: ImportJobHandle,
  opts: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<CompanyPortabilityImportResult> {
  const sleep = opts.sleep ?? defaultSleep;
  const jobId = handle.job.id;
  let delayMs = handle.retryAfterMs ?? DEFAULT_IMPORT_JOB_POLL_MS;
  while (true) {
    await sleep(delayMs);
    let status: ImportJobStatusResponse | null;
    try {
      status = await api.get<ImportJobStatusResponse>(apiPath`/api/organization/import/jobs/${jobId}`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        throw new Error(
          `Import job ${jobId} is no longer available (the server may have restarted). Check the organization before re-running the import.`,
        );
      }
      throw err;
    }
    if (!status) {
      throw new Error(`Import job ${jobId} returned no data.`);
    }
    if (status.job.status === "succeeded") {
      if (!status.job.importResult) {
        throw new Error(`Import job ${jobId} succeeded but returned no import result.`);
      }
      return status.job.importResult;
    }
    if (status.job.status === "failed") {
      throw new Error(status.job.error?.message || status.error || `Import job ${jobId} failed.`);
    }
    delayMs = status.retryAfterMs ?? DEFAULT_IMPORT_JOB_POLL_MS;
  }
}

export async function applyBoardImport(
  api: Pick<PaperclipApiClient, "get" | "post">,
  importPath: string,
  body: unknown,
  opts: { sleep?: (ms: number) => Promise<void>; onJobAccepted?: (jobId: string) => void } = {},
): Promise<CompanyPortabilityImportResult> {
  let response: unknown;
  try {
    response = await api.post<unknown>(importPath, body);
  } catch (err) {
    // A 409 that carries a job means this same import is already running for
    // this account: adopt it instead of failing or importing twice.
    if (err instanceof ApiRequestError && err.status === 409 && isImportJobHandle(err.body)) {
      response = err.body;
    } else {
      throw err;
    }
  }
  if (!response) {
    throw new Error("Import request returned no data.");
  }
  if (!isImportJobHandle(response)) {
    return response as CompanyPortabilityImportResult;
  }
  opts.onJobAccepted?.(response.job.id);
  return waitForImportJob(api, response, { sleep: opts.sleep });
}

export function registerOrganizationPortabilityCommands(organization: Command): void {
  addCommonClientOptions(
    organization
      .command("export")
      .description("Export the organization into a portable markdown package")
      .requiredOption("--out <path>", "Output directory")
      .option("--include <values>", "Comma-separated include set: organization,agents,projects,issues,tasks,skills", "organization,agents")
      .option("--skills <values>", "Comma-separated skill slugs/keys to export")
      .option("--projects <values>", "Comma-separated project shortnames/ids to export")
      .option("--issues <values>", "Comma-separated issue identifiers/ids to export")
      .option("--project-issues <values>", "Comma-separated project shortnames/ids whose issues should be exported")
      .option("--expand-referenced-skills", "Vendor skill contents instead of exporting upstream references", false)
      .option(
        "--force",
        "Overwrite a non-empty output directory without the interactive confirmation (required for non-interactive/automated runs such as the nightly backup routine)",
        false,
      )
      .action(async (opts: OrganizationExportOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const include = parseInclude(opts.include);
          const exported = await ctx.api.post<CompanyPortabilityExportResult>("/api/organization/export", {
            include,
            skills: parseCsvValues(opts.skills),
            projects: parseCsvValues(opts.projects),
            issues: parseCsvValues(opts.issues),
            projectIssues: parseCsvValues(opts.projectIssues),
            expandReferencedSkills: Boolean(opts.expandReferencedSkills),
          });
          if (!exported) {
            throw new Error("Export request returned no data");
          }
          await confirmOverwriteExportDirectory(opts.out!, { force: Boolean(opts.force) });
          await writeExportToFolder(opts.out!, exported);
          printOutput(
            {
              ok: true,
              out: path.resolve(opts.out!),
              rootPath: exported.rootPath,
              filesWritten: Object.keys(exported.files).length,
              paperclipExtensionPath: exported.paperclipExtensionPath,
              warningCount: exported.warnings.length,
            },
            { json: ctx.json },
          );
          if (!ctx.json && exported.warnings.length > 0) {
            for (const warning of exported.warnings) {
              console.log(`warning=${warning}`);
            }
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    organization
      .command("import")
      .description("Import a portable markdown package into the organization from a local path, zip, URL, or GitHub")
      .argument("<fromPathOrUrl>", "Source path or URL")
      .option("--include <values>", "Comma-separated include set: organization,agents,projects,issues,tasks,skills")
      .option("--agents <list>", "Comma-separated agent slugs to import, or all", "all")
      .option("--collision <mode>", "Collision strategy: rename | skip | replace", "rename")
      .option("--ref <value>", "Git ref to use for GitHub imports (branch, tag, or commit)")
      .option("--paperclip-url <url>", "Alias for --api-base on this command")
      .option(
        "--agent-safe",
        "Use the agent-safe import routes (CEO agent keys; no replace collisions, no chunked transfers, packages up to ~8 MB)",
        false,
      )
      .option("--yes", "Accept default selection and skip the pre-import confirmation prompt", false)
      .option("--dry-run", "Run preview only without applying", false)
      .action(async (fromPathOrUrl: string, opts: OrganizationImportOptions) => {
        try {
          if (!opts.apiBase?.trim() && opts.paperclipUrl?.trim()) {
            opts.apiBase = opts.paperclipUrl.trim();
          }
          const ctx = resolveCommandContext(opts);
          const interactiveView = isInteractiveTerminal() && !ctx.json;
          const from = fromPathOrUrl.trim();
          if (!from) {
            throw new Error("Source path or URL is required.");
          }

          const include = resolveImportInclude(opts.include);
          const agents = parseAgents(opts.agents);
          const collision = (opts.collision ?? "rename").toLowerCase() as ImportCollisionMode;
          if (!["rename", "skip", "replace"].includes(collision)) {
            throw new Error("Invalid --collision value. Use: rename, skip, replace");
          }
          const agentSafe = Boolean(opts.agentSafe);
          if (agentSafe && collision === "replace") {
            throw new Error("--agent-safe imports do not allow --collision replace.");
          }

          const targetPayload = { mode: "existing_company" as const };

          let sourcePayload:
            | { type: "inline"; rootPath?: string | null; files: Record<string, CompanyPortabilityFileEntry> }
            | { type: "github"; url: string };
          let chunkedZip: { zipBytes: Uint8Array; rootPath: string } | null = null;

          const treatAsLocalPath = !isHttpUrl(from) && await pathExists(from);
          const isGithubSource = looksLikeRepoUrl(from) || (isGithubShorthand(from) && !treatAsLocalPath);

          if (isHttpUrl(from) || isGithubSource) {
            if (!looksLikeRepoUrl(from) && !isGithubShorthand(from)) {
              throw new Error(
                "Only GitHub URLs and local paths are supported for import. " +
                "Generic HTTP URLs are not supported. Use a GitHub or GitHub Enterprise URL (https://github.com/... or https://ghe.example.com/...) or a local directory path.",
              );
            }
            sourcePayload = { type: "github", url: normalizeGithubImportSource(from, opts.ref) };
          } else {
            if (opts.ref?.trim()) {
              throw new Error("--ref is only supported for GitHub import sources.");
            }
            chunkedZip = await resolveChunkedImportZip(
              from,
              agentSafe ? AGENT_SAFE_INLINE_IMPORT_THRESHOLD_BYTES : CHUNKED_IMPORT_THRESHOLD_BYTES,
            );
            if (chunkedZip && agentSafe) {
              throw new Error(
                "This package is too large for an --agent-safe import. Re-run without --agent-safe using board authentication so it uploads as a chunked transfer.",
              );
            }
            if (chunkedZip) {
              // Too large for one request: the zip travels as a chunked
              // transfer, so the inline files map is never built or sent.
              sourcePayload = { type: "inline", rootPath: chunkedZip.rootPath, files: {} };
            } else {
              const inline = await resolveInlineSourceFromPath(from);
              sourcePayload = {
                type: "inline",
                rootPath: inline.rootPath,
                files: inline.files,
              };
            }
          }

          const sourceLabel = formatSourceLabel(sourcePayload);
          const previewApiPath = resolveOrganizationImportApiPath({ dryRun: true, agentSafe });

          // The transfer meta mirrors the inline preview payload minus its
          // `source` — the source is the assembled zip, spooled server-side.
          const transferMeta = {
            include,
            target: targetPayload,
            agents,
            collisionStrategy: collision,
          };
          let transferId: string | null = null;
          if (chunkedZip) {
            transferId = await uploadImportTransfer(ctx.api, chunkedZip.zipBytes, {
              onProgress: ctx.json
                ? undefined
                : ({ uploadedParts, totalParts, uploadedBytes, totalBytes }) => {
                    console.log(
                      pc.dim(
                        `Uploaded part ${uploadedParts}/${totalParts} (${Math.round(uploadedBytes / (1024 * 1024))} of ${Math.round(totalBytes / (1024 * 1024))} MB)`,
                      ),
                    );
                  },
            });
          }
          const transferPreviewPath = transferId
            ? `/api/organization${companyImportTransferPreviewPath(transferId)}`
            : null;

          let selectedFiles: string[] | undefined;
          if (interactiveView && !opts.yes && !opts.include?.trim()) {
            const initialPreview = transferPreviewPath
              ? await ctx.api.post<CompanyPortabilityPreviewResult>(transferPreviewPath, transferMeta)
              : await ctx.api.post<CompanyPortabilityPreviewResult>(previewApiPath, {
                  source: sourcePayload,
                  ...transferMeta,
                });
            if (!initialPreview) {
              throw new Error("Import preview returned no data.");
            }
            selectedFiles = await promptForImportSelection(initialPreview);
          }

          const previewPayload = {
            source: sourcePayload,
            ...transferMeta,
            selectedFiles,
          };
          const preview = transferPreviewPath
            ? await ctx.api.post<CompanyPortabilityPreviewResult>(transferPreviewPath, {
                ...transferMeta,
                selectedFiles,
              })
            : await ctx.api.post<CompanyPortabilityPreviewResult>(previewApiPath, previewPayload);
          if (!preview) {
            throw new Error("Import preview returned no data.");
          }
          const targetLabel = formatTargetLabel(preview);
          const adapterOverrides = buildDefaultImportAdapterOverrides(preview);
          const adapterMessages = buildDefaultImportAdapterMessages(adapterOverrides);

          if (opts.dryRun) {
            if (ctx.json) {
              printOutput(preview, { json: true });
            } else {
              printImportView(
                "Import Preview",
                renderImportPreview(preview, { sourceLabel, targetLabel, infoMessages: adapterMessages }),
                { interactive: interactiveView },
              );
            }
            return;
          }

          if (!ctx.json) {
            printImportView(
              "Import Preview",
              renderImportPreview(preview, { sourceLabel, targetLabel, infoMessages: adapterMessages }),
              { interactive: interactiveView },
            );
          }

          const confirmationMode = resolveImportApplyConfirmationMode({
            yes: opts.yes,
            interactive: interactiveView,
            json: ctx.json,
          });
          if (confirmationMode === "prompt") {
            const confirmed = await p.confirm({
              message: "Apply this import? (y/N)",
              initialValue: false,
            });
            if (p.isCancel(confirmed) || !confirmed) {
              p.log.warn("Import cancelled.");
              return;
            }
          }

          const onJobAccepted = ctx.json
            ? undefined
            : (jobId: string) => console.log(pc.dim(`Import running on the server (job ${jobId}); waiting for it to finish...`));
          let imported: CompanyPortabilityImportResult | null;
          if (transferId) {
            imported = await applyBoardImport(
              ctx.api,
              `/api/organization${companyImportTransferApplyPath(transferId)}?async=1`,
              { ...transferMeta, selectedFiles, adapterOverrides },
              { onJobAccepted },
            );
          } else if (agentSafe) {
            imported = await ctx.api.post<CompanyPortabilityImportResult>(
              resolveOrganizationImportApiPath({ dryRun: false, agentSafe: true }),
              { ...previewPayload, adapterOverrides },
            );
          } else {
            imported = await applyBoardImport(
              ctx.api,
              resolveOrganizationImportApiPath({ dryRun: false }),
              { ...previewPayload, adapterOverrides },
              { onJobAccepted },
            );
          }
          if (!imported) {
            throw new Error("Import request returned no data.");
          }
          const tc = getTelemetryClient();
          if (tc) {
            const isPrivate = sourcePayload.type !== "github";
            const sourceRef = sourcePayload.type === "github" ? sourcePayload.url : from;
            trackCompanyImported(tc, { sourceType: sourcePayload.type, sourceRef, isPrivate });
          }
          if (ctx.json) {
            printOutput(imported, { json: true });
            return;
          }
          const dashboardUrl = buildOrganizationDashboardUrl(ctx.api.apiBase);
          printImportView(
            "Import Result",
            renderImportResult(imported, { targetLabel, dashboardUrl, infoMessages: adapterMessages }),
            { interactive: interactiveView },
          );
          if (interactiveView) {
            const openDashboard = await p.confirm({
              message: "Open the organization dashboard in your browser?",
              initialValue: true,
            });
            if (!p.isCancel(openDashboard) && openDashboard) {
              if (await openUrl(dashboardUrl)) {
                p.log.info(`Opened ${dashboardUrl}`);
              } else {
                p.log.warn(`Could not open your browser automatically. Open this URL manually:\n${dashboardUrl}`);
              }
            }
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
