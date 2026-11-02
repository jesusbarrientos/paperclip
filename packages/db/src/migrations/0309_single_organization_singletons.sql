DROP INDEX IF EXISTS "agent_config_revisions_company_agent_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "agent_memberships_company_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "case_events_company_case_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "case_issue_links_company_case_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "case_labels_company_case_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "cases_company_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "company_secret_bindings_target_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "company_secret_proposals_company_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "company_user_sidebar_preferences_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "external_objects_company_provider_object_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feedback_votes_company_issue_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_run_events_company_run_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "inbox_dismissals_company_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "connection_grants_company_connection_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "issue_execution_decisions_company_issue_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "issue_inbox_archives_company_issue_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "issue_read_states_company_issue_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "issue_reference_mentions_company_source_issue_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "issue_relations_company_issue_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_automation_executions_company_case_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_case_blockers_company_case_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_case_events_company_case_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_case_issue_links_company_case_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_company_settings_plugin_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "project_memberships_company_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "project_workspaces_company_project_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "run_identity_contexts_company_run_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "tool_mcp_gateway_tokens_company_expires_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profile_bindings_company_target_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "tool_runtime_metric_counters_company_metric_idx";--> statement-breakpoint
ALTER TABLE "company_skill_policies" ADD COLUMN "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL;--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; this index replaces one dropped with the company columns in 0307.
CREATE UNIQUE INDEX "issues_onboarding_first_task_uq" ON "issues" USING btree ("origin_kind") WHERE "issues"."origin_kind" = 'onboarding_first_task';--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; this index replaces one dropped with the company columns in 0307.
CREATE INDEX "tool_oauth_states_subject_user_idx" ON "tool_oauth_states" USING btree ("subject_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agents_company_built_in_agent_key_unique_idx"
  ON "agents" (((metadata -> 'paperclipBuiltInAgent' ->> 'key')))
  WHERE (metadata -> 'paperclipBuiltInAgent' ->> 'key') IS NOT NULL
    AND status <> 'terminated';
