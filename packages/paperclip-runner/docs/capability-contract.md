<!-- GENERATED FILE — DO NOT EDIT. Run pnpm generate:capability-inventory. -->

# Capability Capability Contract

This generated contract is a self-contained derivative of the Paperclip skill, its seven references, the Paperclip Evals corpus, and the legacy MCP tool surface. It does not import or contact the Paperclip control plane.

The skill/reference inventory and eval cases are the only normative behavior sources. Paperclip does not use the legacy MCP calls as a production capability surface; all MCP names below are traceability aliases folded into normative eval rows. Their disposition, grants, assertions, and evidence contract are inherited from the target row rather than classified independently.

## Baseline Counts

- Skill/reference headings: 161
- Eval cases: 106 across 16 groups
- Total normative rows: 267
- Legacy MCP aliases folded into normative rows: 42

| Eval group | Cases |
| --- | ---: |
| hb | 5 |
| co | 6 |
| st | 8 |
| cm | 6 |
| se | 4 |
| su | 4 |
| bl | 5 |
| dp | 3 |
| ix | 9 |
| ap | 6 |
| ar | 4 |
| er | 9 |
| rf | 22 |
| mh | 4 |
| rs | 3 |
| wk | 8 |

## Regeneration

- `pnpm --dir packages/paperclip-runner generate:capability-inventory` imports the canonical baselines and rewrites every generated file.
- `pnpm --dir packages/paperclip-runner check:capability-inventory` validates counts, uniqueness, normative dispositions, one-to-one MCP folds, required fields, and generated-file drift without requiring the external eval repository.

## Skill / Reference Rows

| Capability | Primary disposition | Source anchor |
| --- | --- | --- |
| skill:skills/paperclip/SKILL.md:paperclip-skill:10 | optional_agent_tool | skills/paperclip/SKILL.md:10 |
| skill:skills/paperclip/SKILL.md:terminology:14 | optional_agent_tool | skills/paperclip/SKILL.md:14 |
| skill:skills/paperclip/SKILL.md:authentication:20 | control_plane_owned | skills/paperclip/SKILL.md:20 |
| skill:skills/paperclip/SKILL.md:conversation-tasks:32 | optional_agent_tool | skills/paperclip/SKILL.md:32 |
| skill:skills/paperclip/SKILL.md:server-verified-external-chat-turns:49 | control_plane_owned | skills/paperclip/SKILL.md:49 |
| skill:skills/paperclip/SKILL.md:the-heartbeat-procedure:89 | optional_agent_tool | skills/paperclip/SKILL.md:89 |
| skill:skills/paperclip/SKILL.md:generated-artifacts-and-work-products:198 | always_agent_tool | skills/paperclip/SKILL.md:198 |
| skill:skills/paperclip/SKILL.md:status-quick-guide:246 | control_plane_owned | skills/paperclip/SKILL.md:246 |
| skill:skills/paperclip/SKILL.md:monitors-and-watchers-say-only-what-you-actually-scheduled:256 | optional_agent_tool | skills/paperclip/SKILL.md:256 |
| skill:skills/paperclip/SKILL.md:delegating-review-tasks:269 | always_agent_tool | skills/paperclip/SKILL.md:269 |
| skill:skills/paperclip/SKILL.md:managing-a-user-s-inbox:280 | control_plane_owned | skills/paperclip/SKILL.md:280 |
| skill:skills/paperclip/SKILL.md:issue-dependencies-blockers:288 | control_plane_owned | skills/paperclip/SKILL.md:288 |
| skill:skills/paperclip/SKILL.md:requesting-board-approval:313 | optional_agent_tool | skills/paperclip/SKILL.md:313 |
| skill:skills/paperclip/SKILL.md:issue-thread-interactions:334 | optional_agent_tool | skills/paperclip/SKILL.md:334 |
| skill:skills/paperclip/SKILL.md:standalone-decisions:363 | optional_agent_tool | skills/paperclip/SKILL.md:363 |
| skill:skills/paperclip/SKILL.md:mcp-tool-approval-gates:467 | optional_agent_tool | skills/paperclip/SKILL.md:467 |
| skill:skills/paperclip/SKILL.md:niche-workflow-pointers:509 | optional_agent_tool | skills/paperclip/SKILL.md:509 |
| skill:skills/paperclip/SKILL.md:cases:519 | optional_agent_tool | skills/paperclip/SKILL.md:519 |
| skill:skills/paperclip/SKILL.md:company-skills-workflow:524 | optional_agent_tool | skills/paperclip/SKILL.md:524 |
| skill:skills/paperclip/SKILL.md:routines:535 | optional_agent_tool | skills/paperclip/SKILL.md:535 |
| skill:skills/paperclip/SKILL.md:issue-workspace-runtime-controls:546 | optional_agent_tool | skills/paperclip/SKILL.md:546 |
| skill:skills/paperclip/SKILL.md:proposing-credentials-safely:553 | optional_agent_tool | skills/paperclip/SKILL.md:553 |
| skill:skills/paperclip/SKILL.md:reading-granted-secrets:560 | optional_agent_tool | skills/paperclip/SKILL.md:560 |
| skill:skills/paperclip/SKILL.md:critical-rules:586 | optional_agent_tool | skills/paperclip/SKILL.md:586 |
| skill:skills/paperclip/SKILL.md:comment-style-required:607 | always_agent_tool | skills/paperclip/SKILL.md:607 |
| skill:skills/paperclip/SKILL.md:update:637 | optional_agent_tool | skills/paperclip/SKILL.md:637 |
| skill:skills/paperclip/SKILL.md:task-documents-and-deliverables:647 | always_agent_tool | skills/paperclip/SKILL.md:647 |
| skill:skills/paperclip/SKILL.md:planning-required-when-planning-requested:661 | optional_agent_tool | skills/paperclip/SKILL.md:661 |
| skill:skills/paperclip/SKILL.md:key-endpoints-hot-routes:692 | optional_agent_tool | skills/paperclip/SKILL.md:692 |
| skill:skills/paperclip/SKILL.md:searching-issues:721 | optional_agent_tool | skills/paperclip/SKILL.md:721 |
| skill:skills/paperclip/SKILL.md:full-reference:731 | optional_agent_tool | skills/paperclip/SKILL.md:731 |
| skill:skills/paperclip/SKILL.md:conversational-confirmation-answers:735 | always_agent_tool | skills/paperclip/SKILL.md:735 |
| skill:skills/paperclip/references/api-reference.md:paperclip-api-reference:1 | optional_agent_tool | skills/paperclip/references/api-reference.md:1 |
| skill:skills/paperclip/references/api-reference.md:response-schemas:9 | optional_agent_tool | skills/paperclip/references/api-reference.md:9 |
| skill:skills/paperclip/references/api-reference.md:agent-record-get-api-agents-me-or-get-api-agents-agentid:11 | optional_agent_tool | skills/paperclip/references/api-reference.md:11 |
| skill:skills/paperclip/references/api-reference.md:company-portability:43 | optional_agent_tool | skills/paperclip/references/api-reference.md:43 |
| skill:skills/paperclip/references/api-reference.md:issue-with-ancestors-get-api-issues-issueid:109 | optional_agent_tool | skills/paperclip/references/api-reference.md:109 |
| skill:skills/paperclip/references/api-reference.md:issue-update-response-patch-api-issues-issueid:195 | optional_agent_tool | skills/paperclip/references/api-reference.md:195 |
| skill:skills/paperclip/references/api-reference.md:blocker-diagnostics-get-api-issues-issueid-diagnostics-blockers:237 | control_plane_owned | skills/paperclip/references/api-reference.md:237 |
| skill:skills/paperclip/references/api-reference.md:wake-diagnostics-get-api-issues-issueid-diagnostics-wakes:276 | control_plane_owned | skills/paperclip/references/api-reference.md:276 |
| skill:skills/paperclip/references/api-reference.md:subtree-diagnostics-get-api-issues-issueid-diagnostics-subtree:320 | optional_agent_tool | skills/paperclip/references/api-reference.md:320 |
| skill:skills/paperclip/references/api-reference.md:execution-policy-fields-on-an-issue:368 | optional_agent_tool | skills/paperclip/references/api-reference.md:368 |
| skill:skills/paperclip/references/api-reference.md:cross-agent-review-gates:420 | always_agent_tool | skills/paperclip/references/api-reference.md:420 |
| skill:skills/paperclip/references/api-reference.md:worked-example-ic-heartbeat:453 | optional_agent_tool | skills/paperclip/references/api-reference.md:453 |
| skill:skills/paperclip/references/api-reference.md:1-identity-skip-if-already-in-context:458 | control_plane_owned | skills/paperclip/references/api-reference.md:458 |
| skill:skills/paperclip/references/api-reference.md:2-check-inbox:462 | control_plane_owned | skills/paperclip/references/api-reference.md:462 |
| skill:skills/paperclip/references/api-reference.md:3-already-have-issue-101-inprogress-highest-priority-continue-it:469 | optional_agent_tool | skills/paperclip/references/api-reference.md:469 |
| skill:skills/paperclip/references/api-reference.md:4-do-the-actual-work-write-code-run-tests:476 | optional_agent_tool | skills/paperclip/references/api-reference.md:476 |
| skill:skills/paperclip/references/api-reference.md:5-work-is-done-update-status-and-comment-in-one-call:478 | always_agent_tool | skills/paperclip/references/api-reference.md:478 |
| skill:skills/paperclip/references/api-reference.md:6-still-have-time-checkout-the-next-task:482 | control_plane_owned | skills/paperclip/references/api-reference.md:482 |
| skill:skills/paperclip/references/api-reference.md:7-made-partial-progress-not-done-yet-comment-and-exit:489 | always_agent_tool | skills/paperclip/references/api-reference.md:489 |
| skill:skills/paperclip/references/api-reference.md:worked-example-report-a-board-user-s-mine-inbox:494 | control_plane_owned | skills/paperclip/references/api-reference.md:494 |
| skill:skills/paperclip/references/api-reference.md:board-user-created-the-requesting-issue:499 | optional_agent_tool | skills/paperclip/references/api-reference.md:499 |
| skill:skills/paperclip/references/api-reference.md:fetch-the-board-user-s-mine-inbox-issues:503 | control_plane_owned | skills/paperclip/references/api-reference.md:503 |
| skill:skills/paperclip/references/api-reference.md:summarize-it-back-to-the-board-in-a-comment-or-document:517 | always_agent_tool | skills/paperclip/references/api-reference.md:517 |
| skill:skills/paperclip/references/api-reference.md:worked-example-archive-a-resolved-inbox-item:522 | control_plane_owned | skills/paperclip/references/api-reference.md:522 |
| skill:skills/paperclip/references/api-reference.md:the-responsible-user-s-id-is-resolved-from-the-authenticated-agent-run:527 | optional_agent_tool | skills/paperclip/references/api-reference.md:527 |
| skill:skills/paperclip/references/api-reference.md:reverse-the-archive-if-it-was-premature-or-no-longer-desired:536 | optional_agent_tool | skills/paperclip/references/api-reference.md:536 |
| skill:skills/paperclip/references/api-reference.md:worked-example-reviewer-approver-heartbeat:546 | always_agent_tool | skills/paperclip/references/api-reference.md:546 |
| skill:skills/paperclip/references/api-reference.md:worked-example-manager-heartbeat:585 | optional_agent_tool | skills/paperclip/references/api-reference.md:585 |
| skill:skills/paperclip/references/api-reference.md:1-identity-skip-if-already-in-context:588 | control_plane_owned | skills/paperclip/references/api-reference.md:588 |
| skill:skills/paperclip/references/api-reference.md:2-check-team-status:592 | optional_agent_tool | skills/paperclip/references/api-reference.md:592 |
| skill:skills/paperclip/references/api-reference.md:3-agent-42-is-blocked-read-comments:599 | control_plane_owned | skills/paperclip/references/api-reference.md:599 |
| skill:skills/paperclip/references/api-reference.md:4-unblock-reassign-and-comment:603 | control_plane_owned | skills/paperclip/references/api-reference.md:603 |
| skill:skills/paperclip/references/api-reference.md:5-check-own-assignments:607 | optional_agent_tool | skills/paperclip/references/api-reference.md:607 |
| skill:skills/paperclip/references/api-reference.md:6-create-subtasks-and-delegate:614 | optional_agent_tool | skills/paperclip/references/api-reference.md:614 |
| skill:skills/paperclip/references/api-reference.md:load-tests-depend-on-caching-layer-being-done-first-paperclip-will-auto-wake-agent-55-when-the-blocker-resolves:620 | control_plane_owned | skills/paperclip/references/api-reference.md:620 |
| skill:skills/paperclip/references/api-reference.md:7-dashboard-for-health-check:625 | optional_agent_tool | skills/paperclip/references/api-reference.md:625 |
| skill:skills/paperclip/references/api-reference.md:comments-and-mentions:631 | always_agent_tool | skills/paperclip/references/api-reference.md:631 |
| skill:skills/paperclip/references/api-reference.md:update:638 | optional_agent_tool | skills/paperclip/references/api-reference.md:638 |
| skill:skills/paperclip/references/api-reference.md:cross-team-work-and-delegation:660 | optional_agent_tool | skills/paperclip/references/api-reference.md:660 |
| skill:skills/paperclip/references/api-reference.md:receiving-cross-team-work:664 | optional_agent_tool | skills/paperclip/references/api-reference.md:664 |
| skill:skills/paperclip/references/api-reference.md:questions-and-dependencies:674 | always_agent_tool | skills/paperclip/references/api-reference.md:674 |
| skill:skills/paperclip/references/api-reference.md:company-context:686 | optional_agent_tool | skills/paperclip/references/api-reference.md:686 |
| skill:skills/paperclip/references/api-reference.md:company-branding-ceo-board:698 | optional_agent_tool | skills/paperclip/references/api-reference.md:698 |
| skill:skills/paperclip/references/api-reference.md:openclaw-invite-prompt-ceo:718 | optional_agent_tool | skills/paperclip/references/api-reference.md:718 |
| skill:skills/paperclip/references/api-reference.md:setting-agent-instructions-path:737 | optional_agent_tool | skills/paperclip/references/api-reference.md:737 |
| skill:skills/paperclip/references/api-reference.md:project-setup-create-workspace:770 | optional_agent_tool | skills/paperclip/references/api-reference.md:770 |
| skill:skills/paperclip/references/api-reference.md:option-a-one-call-create-with-workspace:794 | optional_agent_tool | skills/paperclip/references/api-reference.md:794 |
| skill:skills/paperclip/references/api-reference.md:option-b-two-calls-project-first-then-workspace:813 | optional_agent_tool | skills/paperclip/references/api-reference.md:813 |
| skill:skills/paperclip/references/api-reference.md:governance-and-approvals:842 | optional_agent_tool | skills/paperclip/references/api-reference.md:842 |
| skill:skills/paperclip/references/api-reference.md:requesting-a-hire-management-only:846 | optional_agent_tool | skills/paperclip/references/api-reference.md:846 |
| skill:skills/paperclip/references/api-reference.md:ceo-strategy-approval:911 | optional_agent_tool | skills/paperclip/references/api-reference.md:911 |
| skill:skills/paperclip/references/api-reference.md:questions-and-waiting-for-human-input:920 | always_agent_tool | skills/paperclip/references/api-reference.md:920 |
| skill:skills/paperclip/references/api-reference.md:issue-thread-confirmations:1024 | always_agent_tool | skills/paperclip/references/api-reference.md:1024 |
| skill:skills/paperclip/references/api-reference.md:conversational-confirmation-answers:1082 | always_agent_tool | skills/paperclip/references/api-reference.md:1082 |
| skill:skills/paperclip/references/api-reference.md:checkbox-confirmations:1088 | always_agent_tool | skills/paperclip/references/api-reference.md:1088 |
| skill:skills/paperclip/references/api-reference.md:item-verdict-requests:1203 | optional_agent_tool | skills/paperclip/references/api-reference.md:1203 |
| skill:skills/paperclip/references/api-reference.md:checking-approval-status:1313 | optional_agent_tool | skills/paperclip/references/api-reference.md:1313 |
| skill:skills/paperclip/references/api-reference.md:approval-follow-up-requesting-agent:1319 | always_agent_tool | skills/paperclip/references/api-reference.md:1319 |
| skill:skills/paperclip/references/api-reference.md:issue-lifecycle:1337 | always_agent_tool | skills/paperclip/references/api-reference.md:1337 |
| skill:skills/paperclip/references/api-reference.md:error-handling:1367 | control_plane_owned | skills/paperclip/references/api-reference.md:1367 |
| skill:skills/paperclip/references/api-reference.md:full-api-reference:1381 | optional_agent_tool | skills/paperclip/references/api-reference.md:1381 |
| skill:skills/paperclip/references/api-reference.md:agents:1383 | optional_agent_tool | skills/paperclip/references/api-reference.md:1383 |
| skill:skills/paperclip/references/api-reference.md:issues-tasks:1404 | optional_agent_tool | skills/paperclip/references/api-reference.md:1404 |
| skill:skills/paperclip/references/api-reference.md:organization-projects-goals:1445 | optional_agent_tool | skills/paperclip/references/api-reference.md:1445 |
| skill:skills/paperclip/references/api-reference.md:routines:1466 | optional_agent_tool | skills/paperclip/references/api-reference.md:1466 |
| skill:skills/paperclip/references/api-reference.md:approvals-costs-activity-dashboard:1482 | optional_agent_tool | skills/paperclip/references/api-reference.md:1482 |
| skill:skills/paperclip/references/api-reference.md:secrets:1504 | optional_agent_tool | skills/paperclip/references/api-reference.md:1504 |
| skill:skills/paperclip/references/api-reference.md:agent-secret-proposals:1517 | optional_agent_tool | skills/paperclip/references/api-reference.md:1517 |
| skill:skills/paperclip/references/api-reference.md:agent-secret-access:1617 | optional_agent_tool | skills/paperclip/references/api-reference.md:1617 |
| skill:skills/paperclip/references/api-reference.md:common-mistakes:1657 | optional_agent_tool | skills/paperclip/references/api-reference.md:1657 |
| skill:skills/paperclip/references/artifacts.md:generated-artifacts-and-work-products:1 | always_agent_tool | skills/paperclip/references/artifacts.md:1 |
| skill:skills/paperclip/references/artifacts.md:workspace-only-file-references:15 | optional_agent_tool | skills/paperclip/references/artifacts.md:15 |
| skill:skills/paperclip/references/cases.md:cases:1 | optional_agent_tool | skills/paperclip/references/cases.md:1 |
| skill:skills/paperclip/references/cases.md:core-model:12 | optional_agent_tool | skills/paperclip/references/cases.md:12 |
| skill:skills/paperclip/references/cases.md:upsert-semantics:29 | optional_agent_tool | skills/paperclip/references/cases.md:29 |
| skill:skills/paperclip/references/cases.md:read-and-search:67 | optional_agent_tool | skills/paperclip/references/cases.md:67 |
| skill:skills/paperclip/references/cases.md:documents:90 | always_agent_tool | skills/paperclip/references/cases.md:90 |
| skill:skills/paperclip/references/cases.md:fields:118 | optional_agent_tool | skills/paperclip/references/cases.md:118 |
| skill:skills/paperclip/references/cases.md:issue-links:151 | optional_agent_tool | skills/paperclip/references/cases.md:151 |
| skill:skills/paperclip/references/cases.md:child-cases:176 | optional_agent_tool | skills/paperclip/references/cases.md:176 |
| skill:skills/paperclip/references/cases.md:attachments:195 | optional_agent_tool | skills/paperclip/references/cases.md:195 |
| skill:skills/paperclip/references/cases.md:lifecycle:208 | optional_agent_tool | skills/paperclip/references/cases.md:208 |
| skill:skills/paperclip/references/cases.md:worked-blog-post-example:222 | optional_agent_tool | skills/paperclip/references/cases.md:222 |
| skill:skills/paperclip/references/company-skills.md:company-skills-workflow:1 | optional_agent_tool | skills/paperclip/references/company-skills.md:1 |
| skill:skills/paperclip/references/company-skills.md:what-exists:5 | optional_agent_tool | skills/paperclip/references/company-skills.md:5 |
| skill:skills/paperclip/references/company-skills.md:permission-model:22 | optional_agent_tool | skills/paperclip/references/company-skills.md:22 |
| skill:skills/paperclip/references/company-skills.md:core-endpoints:29 | optional_agent_tool | skills/paperclip/references/company-skills.md:29 |
| skill:skills/paperclip/references/company-skills.md:install-a-skill-into-the-company:65 | optional_agent_tool | skills/paperclip/references/company-skills.md:65 |
| skill:skills/paperclip/references/company-skills.md:app-shipped-catalog:75 | optional_agent_tool | skills/paperclip/references/company-skills.md:75 |
| skill:skills/paperclip/references/company-skills.md:external-source-import:101 | optional_agent_tool | skills/paperclip/references/company-skills.md:101 |
| skill:skills/paperclip/references/company-skills.md:source-types-in-order-of-preference:105 | optional_agent_tool | skills/paperclip/references/company-skills.md:105 |
| skill:skills/paperclip/references/company-skills.md:example-skills-sh-import-preferred:116 | optional_agent_tool | skills/paperclip/references/company-skills.md:116 |
| skill:skills/paperclip/references/company-skills.md:example-github-import:138 | optional_agent_tool | skills/paperclip/references/company-skills.md:138 |
| skill:skills/paperclip/references/company-skills.md:inspect-what-was-installed:164 | optional_agent_tool | skills/paperclip/references/company-skills.md:164 |
| skill:skills/paperclip/references/company-skills.md:assign-skills-to-an-existing-agent:181 | optional_agent_tool | skills/paperclip/references/company-skills.md:181 |
| skill:skills/paperclip/references/company-skills.md:include-skills-during-hire-or-create:216 | optional_agent_tool | skills/paperclip/references/company-skills.md:216 |
| skill:skills/paperclip/references/company-skills.md:notes:256 | optional_agent_tool | skills/paperclip/references/company-skills.md:256 |
| skill:skills/paperclip/references/issue-documents.md:issue-documents-through-the-api:1 | always_agent_tool | skills/paperclip/references/issue-documents.md:1 |
| skill:skills/paperclip/references/issue-documents.md:create-a-document:8 | always_agent_tool | skills/paperclip/references/issue-documents.md:8 |
| skill:skills/paperclip/references/issue-documents.md:update-or-resolve-an-unclear-write:49 | optional_agent_tool | skills/paperclip/references/issue-documents.md:49 |
| skill:skills/paperclip/references/issue-workspaces.md:issue-workspace-runtime-controls:1 | optional_agent_tool | skills/paperclip/references/issue-workspaces.md:1 |
| skill:skills/paperclip/references/issue-workspaces.md:discover-the-workspace:5 | optional_agent_tool | skills/paperclip/references/issue-workspaces.md:5 |
| skill:skills/paperclip/references/issue-workspaces.md:control-services:23 | optional_agent_tool | skills/paperclip/references/issue-workspaces.md:23 |
| skill:skills/paperclip/references/issue-workspaces.md:start-all-configured-services-waits-for-configured-readiness-checks:28 | optional_agent_tool | skills/paperclip/references/issue-workspaces.md:28 |
| skill:skills/paperclip/references/issue-workspaces.md:restart-all-configured-services:36 | optional_agent_tool | skills/paperclip/references/issue-workspaces.md:36 |
| skill:skills/paperclip/references/issue-workspaces.md:stop-all-running-services:44 | optional_agent_tool | skills/paperclip/references/issue-workspaces.md:44 |
| skill:skills/paperclip/references/issue-workspaces.md:read-the-url:63 | optional_agent_tool | skills/paperclip/references/issue-workspaces.md:63 |
| skill:skills/paperclip/references/issue-workspaces.md:mcp-tools:72 | optional_agent_tool | skills/paperclip/references/issue-workspaces.md:72 |
| skill:skills/paperclip/references/routines.md:paperclip-routines:1 | optional_agent_tool | skills/paperclip/references/routines.md:1 |
| skill:skills/paperclip/references/routines.md:lifecycle:16 | optional_agent_tool | skills/paperclip/references/routines.md:16 |
| skill:skills/paperclip/references/routines.md:creating-a-routine:27 | optional_agent_tool | skills/paperclip/references/routines.md:27 |
| skill:skills/paperclip/references/routines.md:concurrency-policies:64 | optional_agent_tool | skills/paperclip/references/routines.md:64 |
| skill:skills/paperclip/references/routines.md:catch-up-policies:76 | optional_agent_tool | skills/paperclip/references/routines.md:76 |
| skill:skills/paperclip/references/routines.md:activity-gated-scheduled-runs:87 | optional_agent_tool | skills/paperclip/references/routines.md:87 |
| skill:skills/paperclip/references/routines.md:example-skip-quiet-nights:107 | optional_agent_tool | skills/paperclip/references/routines.md:107 |
| skill:skills/paperclip/references/routines.md:adding-triggers:126 | optional_agent_tool | skills/paperclip/references/routines.md:126 |
| skill:skills/paperclip/references/routines.md:schedule-cron:136 | optional_agent_tool | skills/paperclip/references/routines.md:136 |
| skill:skills/paperclip/references/routines.md:webhook:150 | optional_agent_tool | skills/paperclip/references/routines.md:150 |
| skill:skills/paperclip/references/routines.md:api-manual-only:167 | optional_agent_tool | skills/paperclip/references/routines.md:167 |
| skill:skills/paperclip/references/routines.md:updating-and-deleting-triggers:179 | optional_agent_tool | skills/paperclip/references/routines.md:179 |
| skill:skills/paperclip/references/routines.md:manual-run:196 | optional_agent_tool | skills/paperclip/references/routines.md:196 |
| skill:skills/paperclip/references/routines.md:updating-a-routine:212 | optional_agent_tool | skills/paperclip/references/routines.md:212 |
| skill:skills/paperclip/references/routines.md:reading-routines-and-runs:223 | optional_agent_tool | skills/paperclip/references/routines.md:223 |
| skill:skills/paperclip/references/workflows.md:paperclip-workflow-playbooks:1 | optional_agent_tool | skills/paperclip/references/workflows.md:1 |
| skill:skills/paperclip/references/workflows.md:project-setup-ceo-manager:7 | optional_agent_tool | skills/paperclip/references/workflows.md:7 |
| skill:skills/paperclip/references/workflows.md:openclaw-invite-ceo:22 | optional_agent_tool | skills/paperclip/references/workflows.md:22 |
| skill:skills/paperclip/references/workflows.md:setting-agent-instructions-path:50 | optional_agent_tool | skills/paperclip/references/workflows.md:50 |
| skill:skills/paperclip/references/workflows.md:company-import-export:79 | optional_agent_tool | skills/paperclip/references/workflows.md:79 |
| skill:skills/paperclip/references/workflows.md:self-test-playbook-app-level:106 | optional_agent_tool | skills/paperclip/references/workflows.md:106 |

## Legacy MCP Alias Index

This is a compatibility/traceability index, not a tool catalog. “Inherited disposition” is shown only to make the normative target easy to audit.

| Legacy MCP name | Folded into normative row | Inherited disposition | Source anchor |
| --- | --- | --- | --- |
| paperclipMe | eval:hb-inbox-lite-01 | control_plane_owned | packages/mcp-server/src/tools.ts:284 |
| paperclipInboxLite | eval:hb-inbox-lite-01 | control_plane_owned | packages/mcp-server/src/tools.ts:290 |
| paperclipListAgents | eval:rf-api-mgr-heartbeat-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:296 |
| paperclipListSkills | eval:rf-cskill-audit-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:302 |
| paperclipGetAgent | eval:rf-api-mgr-heartbeat-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:308 |
| paperclipListIssues | eval:se-q-filters-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:316 |
| paperclipGetIssue | eval:se-get-issue-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:330 |
| paperclipGetHeartbeatContext | eval:hb-context-01 | control_plane_owned | packages/mcp-server/src/tools.ts:336 |
| paperclipListComments | eval:se-get-issue-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:345 |
| paperclipGetComment | eval:hb-wake-comment-01 | control_plane_owned | packages/mcp-server/src/tools.ts:358 |
| paperclipListIssueApprovals | eval:ap-board-approval-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:365 |
| paperclipListDocuments | eval:dp-base-revision-01 | always_agent_tool | packages/mcp-server/src/tools.ts:371 |
| paperclipGetDocument | eval:dp-base-revision-01 | always_agent_tool | packages/mcp-server/src/tools.ts:377 |
| paperclipListDocumentRevisions | eval:dp-base-revision-01 | always_agent_tool | packages/mcp-server/src/tools.ts:384 |
| paperclipListProjects | eval:rf-wf-project-setup-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:394 |
| paperclipGetProject | eval:rf-wf-project-setup-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:400 |
| paperclipGetIssueWorkspaceRuntime | eval:rf-iws-start-url-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:408 |
| paperclipControlIssueWorkspaceServices | eval:rf-iws-start-url-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:414 |
| paperclipWaitForIssueWorkspaceService | eval:rf-iws-target-restart-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:431 |
| paperclipListGoals | eval:su-parent-goal-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:457 |
| paperclipGetGoal | eval:su-parent-goal-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:463 |
| paperclipListApprovals | eval:ap-approval-wake-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:469 |
| paperclipCreateApproval | eval:ap-board-approval-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:478 |
| paperclipGetApproval | eval:ap-approval-wake-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:487 |
| paperclipGetApprovalIssues | eval:ap-approval-wake-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:493 |
| paperclipListApprovalComments | eval:ap-approval-deny-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:499 |
| paperclipCreateIssue | eval:su-parent-goal-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:505 |
| paperclipUpdateIssue | eval:st-done-comment-01 | always_agent_tool | packages/mcp-server/src/tools.ts:512 |
| paperclipCheckoutIssue | eval:co-body-contract-01 | control_plane_owned | packages/mcp-server/src/tools.ts:519 |
| paperclipReleaseIssue | eval:er-release-01 | control_plane_owned | packages/mcp-server/src/tools.ts:531 |
| paperclipAddComment | eval:cm-multiline-01 | always_agent_tool | packages/mcp-server/src/tools.ts:537 |
| paperclipSuggestTasks | eval:ix-suggest-tasks-01 | always_agent_tool | packages/mcp-server/src/tools.ts:544 |
| paperclipAskUserQuestions | eval:ix-questions-01 | always_agent_tool | packages/mcp-server/src/tools.ts:556 |
| paperclipRequestConfirmation | eval:ix-confirmation-plan-01 | always_agent_tool | packages/mcp-server/src/tools.ts:568 |
| paperclipRequestCheckboxConfirmation | eval:ix-checkbox-01 | always_agent_tool | packages/mcp-server/src/tools.ts:580 |
| paperclipUpsertIssueDocument | eval:dp-plan-doc-01 | always_agent_tool | packages/mcp-server/src/tools.ts:592 |
| paperclipRestoreIssueDocumentRevision | eval:dp-base-revision-01 | always_agent_tool | packages/mcp-server/src/tools.ts:603 |
| paperclipLinkIssueApproval | eval:ap-board-approval-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:618 |
| paperclipUnlinkIssueApproval | eval:ap-board-approval-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:627 |
| paperclipApprovalDecision | eval:ap-approval-wake-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:637 |
| paperclipAddApprovalComment | eval:ap-approval-deny-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:659 |
| paperclipApiRequest | eval:rf-api-404-report-01 | optional_agent_tool | packages/mcp-server/src/tools.ts:668 |
