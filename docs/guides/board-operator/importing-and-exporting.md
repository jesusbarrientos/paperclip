---
title: Importing & Exporting Companies
summary: Export the organization to a portable package and import packages from local paths or GitHub
---

A Paperclip instance serves exactly one organization (its company). That organization can be exported to a portable markdown package, and packages can be imported into it from local directories or GitHub repositories. This lets you share company configurations, seed a fresh instance from a template, and version-control your agent teams.

## Package Format

Exported packages follow the [Agent Companies specification](/companies/companies-spec) and use a markdown-first structure:

```text
my-company/
├── COMPANY.md          # Company metadata
├── agents/
│   ├── ceo/AGENT.md    # Agent instructions + frontmatter
│   └── cto/AGENT.md
├── projects/
│   └── main/PROJECT.md
├── skills/
│   └── review/SKILL.md
├── tasks/
│   └── onboarding/TASK.md
└── .paperclip.yaml     # Adapter config, env inputs, routines
```

- **COMPANY.md** defines company name, description, and metadata.
- **AGENT.md** files contain agent identity, role, and instructions.
- **SKILL.md** files are compatible with the Agent Skills ecosystem.
- **.paperclip.yaml** holds Paperclip-specific config (adapter types, env inputs, budgets) as an optional sidecar.

## Export & Import in the App

Both flows are available in the web UI as organization settings pages: **Export** and **Import** appear in the settings navigation.

> **Cloud-managed instances:** when a hosting platform manages the instance, the organization is provisioned by the platform and importing is disabled — the Import page and buttons are hidden, and every import API route answers `403` with `code: "cloud_managed"`. Export stays available, so you can always take your company's data with you. Self-hosted instances keep the full import surface.

The **Export** page lets you pick exactly which files go into the bundle before downloading it. Above the file tree it shows a **"Not included in this export"** panel — the export fidelity report — listing data the bundle will not carry (for example attachments, approvals, cost history, or activity log entries), with blocking issues highlighted.

The **Import** page previews the package, lets you resolve name collisions and adapter assignments, and applies the import. A **"Start imported agents and routines paused"** checkbox (on by default) makes imported agents and routines land paused instead of live. After the import finishes, an **"Activate imported agents and routines"** panel lists everything that was imported paused so you can resume the agents and activate the routines you select — nothing starts running until you say so.

## Exporting the Organization

The `paperclipai company export` command was removed together with the rest of the `company` command group. Export through the app or the API:

```sh
curl -X POST "$PAPERCLIP_API_URL/api/organization/exports" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"include":{"company":true,"agents":true,"projects":true}}'
```

### Request fields

| Field | Description | Default |
|--------|-------------|---------|
| `include` | Object with `company`, `agents`, `projects`, `issues`, `skills` booleans | company and agents |
| `skills` | Export only specific skill slugs | all |
| `projects` | Export only specific project shortnames or IDs | all |
| `issues` | Export specific issue identifiers or IDs | none |
| `projectIssues` | Export issues belonging to specific projects | none |
| `selectedFiles` | Restrict the bundle to these package paths | all |
| `expandReferencedSkills` | Vendor skill file contents instead of keeping upstream references | `false` |

Use `POST /api/organization/exports/preview` with the same body to see the file tree before exporting.

### What Gets Exported

- Organization name, description, and metadata (as `COMPANY.md`)
- Agent names, roles, reporting structure, and instructions
- Project definitions and workspace config
- Task/issue descriptions (when included)
- Skill packages (as references or vendored content)
- Adapter type and env input declarations in `.paperclip.yaml`

Secret values, machine-local paths, and database IDs are **never** exported.

## Importing a Package

Every import targets the instance's single organization. The request `target` is always `{ "mode": "existing_company" }`; a `new_company` target is rejected with `409` and `code: "organization_exists"`. To start a separate company from a package, import it into a fresh instance.

Sources can be an inline file bundle (what the app's Import page uploads) or a GitHub URL:

```sh
curl -X POST "$PAPERCLIP_API_URL/api/organization/imports/preview" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": { "type": "github", "url": "https://github.com/org/repo/tree/main/companies/acme" },
    "target": { "mode": "existing_company" },
    "include": { "agents": true },
    "collisionStrategy": "rename"
  }'
```

### Request fields

| Field | Description | Default |
|--------|-------------|---------|
| `source` | `{ "type": "github", "url": ... }` or `{ "type": "inline", "files": {...} }` | — |
| `target` | `{ "mode": "existing_company" }` | — |
| `include` | Object with `company`, `agents`, `projects`, `issues`, `skills` booleans | auto-detected |
| `agents` | Agent slugs to import, or `"all"` | `"all"` |
| `collisionStrategy` | `rename`, `skip`, or `replace` | `rename` |
| `nameOverrides` | Map of package names to names to use on import | none |
| `selectedFiles` | Restrict the import to these package paths | all |
| `pauseAutomations` | Apply only: land imported agents and routines paused | `false` |

### Collision Strategies

Agent or project names in the package may conflict with existing ones in the organization:

- **`rename`** (default) — Appends a suffix to avoid conflicts (e.g., `ceo` becomes `ceo-2`).
- **`skip`** — Skips entities that already exist.
- **`replace`** — Overwrites existing entities. Only available on the board-only `/api/organization/import` route (not on the safe `/imports/*` routes the CEO can use).

### Preview Before Applying

Always preview first. The preview shows:
- **Package contents** — How many agents, projects, tasks, and skills are in the source
- **Import plan** — What will be created, renamed, skipped, or replaced
- **Env inputs** — Environment variables that may need values after import
- **Warnings** — Potential issues like missing skills or unresolved references

Imported agents always land with timer heartbeats disabled. Assignment/on-demand wake behavior from the package is preserved, but scheduled runs stay off until a board operator re-enables them.

Imports can additionally request `pauseAutomations` (the default in the app's Import page) so imported agents and routines land fully paused. Use the post-import activation panel — or resume the agents and activate the routines individually — when you are ready for them to run.

## API Endpoints

| Action | Endpoint |
|--------|----------|
| Export package | `POST /api/organization/exports` |
| Export preview | `POST /api/organization/exports/preview` |
| Legacy export bundle | `POST /api/organization/export` |
| Export fidelity report | `GET /api/organization/export/fidelity` |
| Preview import (safe, board or CEO) | `POST /api/organization/imports/preview` |
| Apply import (safe, board or CEO) | `POST /api/organization/imports/apply` |
| Preview import (board) | `POST /api/organization/import/preview` |
| Apply import (board, async job) | `POST /api/organization/import` |
| Poll an import job | `GET /api/organization/import/jobs/:jobId` |

Import apply requests accept `pauseAutomations: true` to create imported agents and routines in a paused state.

CEO agents can also use the safe import routes (`/imports/preview` and `/imports/apply`) which enforce non-destructive rules: `replace` is rejected, collisions resolve with `rename` or `skip`, and issues are always created as new.

## GitHub Sources

The `github` source takes a full URL:

- Repository URL: `https://github.com/org/repo`
- Subfolder URL: `https://github.com/org/repo/tree/main/path/to/company`

The `org/repo` shorthand was a feature of the removed `company import` CLI command; the API requires a URL.

Pin a specific branch, tag, or commit by using a `tree/<ref>/...` URL when importing from GitHub.
