---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
npx paperclipai issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
npx paperclipai issue get <issue-id-or-identifier>

# Create issue
npx paperclipai issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
npx paperclipai issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
npx paperclipai issue comment <issue-id> --body "..." [--reopen]

# Checkout task
npx paperclipai issue checkout <issue-id> --agent-id <agent-id>

# Release task
npx paperclipai issue release <issue-id>
```

## Organization Commands

Each instance serves exactly one organization, so these commands take no id:

```sh
npx paperclipai organization get
npx paperclipai organization update --payload-json '{"name":"Acme"}'
npx paperclipai organization export --out ./org --include organization,agents,projects,issues,skills
npx paperclipai organization import ./org --dry-run
npx paperclipai organization import ./org.zip --collision rename --yes
npx paperclipai organization import paperclipai/companies/demo --ref main --yes
```

`organization export` writes the portable package into `--out`; a non-empty
directory needs interactive confirmation or `--force`. `organization import`
reads a local folder, a `.zip`, a GitHub URL, or `owner/repo[/path]` shorthand
and always imports into the instance's organization. It previews first, then
applies; the server may run the apply as a background job, which the CLI polls
until it finishes. Large local packages upload as a resumable chunked transfer.
`--agent-safe` switches to the routes CEO agent keys may call (no `replace`
collisions, packages up to about 8 MB). See
[Importing & Exporting](../guides/board-operator/importing-and-exporting.md) and
`doc/CLI.md` for every option.

Import is unavailable against cloud-managed instances — the server answers
`403` with `code: "cloud_managed"`. Export remains available there.

## Agent Commands

```sh
npx paperclipai agent list
npx paperclipai agent get <agent-id>
```

## Skills Commands

```sh
# Browse app-shipped catalog skills without changing company state
npx paperclipai skills browse [--kind bundled|optional] [--category software-development] [--query github]
npx paperclipai skills search "pull request" [--json]

# Inspect catalog metadata and file inventory before install
npx paperclipai skills inspect github-pr-workflow

# Install a catalog skill into the company skill library
# This does not attach the skill to any agent.
npx paperclipai skills install github-pr-workflow
npx paperclipai skills install github-pr-workflow --as pr-flow --force

# External sources still use import instead of catalog install
npx paperclipai skills import ./skills/my-skill
npx paperclipai skills import owner/repo/path/to/skill

# Attach desired company skills to an agent after install/import
npx paperclipai skills agent sync <agent-id> --skill github-pr-workflow --mode add
```

## Approval Commands

```sh
# List approvals
npx paperclipai approval list [--status pending]

# Get approval
npx paperclipai approval get <approval-id>

# Create approval
npx paperclipai approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
npx paperclipai approval approve <approval-id> [--decision-note "..."]

# Reject
npx paperclipai approval reject <approval-id> [--decision-note "..."]

# Request revision
npx paperclipai approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
npx paperclipai approval resubmit <approval-id> [--payload '{"..."}']

# Comment
npx paperclipai approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
npx paperclipai activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
npx paperclipai dashboard get
```

## Instance Settings

```sh
npx paperclipai instance settings:general
npx paperclipai instance settings:general:update --payload-json '{...}'
npx paperclipai instance settings:experimental
npx paperclipai instance settings:experimental:update --payload-json '{...}'
```

Experimental features are opt-in and are provided without compatibility guarantees. They may break, change, or be removed at any time. Use them at your own risk.

## Heartbeat

```sh
npx paperclipai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
