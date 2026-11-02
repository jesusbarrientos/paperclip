ALTER TABLE "agent_instruction_heads" DROP CONSTRAINT IF EXISTS "agent_instruction_heads_identity_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_instruction_revisions" DROP CONSTRAINT IF EXISTS "agent_instruction_revisions_identity_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_pools" DROP CONSTRAINT IF EXISTS "ai_connection_pools_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_deliveries" DROP CONSTRAINT IF EXISTS "chat_deliveries_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoint_resources" DROP CONSTRAINT IF EXISTS "chat_endpoint_resources_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoints" DROP CONSTRAINT IF EXISTS "chat_endpoints_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_external_principals" DROP CONSTRAINT IF EXISTS "chat_external_principals_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_github_reviews" DROP CONSTRAINT IF EXISTS "chat_github_reviews_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "completion_contracts" DROP CONSTRAINT IF EXISTS "completion_contracts_company_issue_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_queues" DROP CONSTRAINT IF EXISTS "decision_queues_id_company_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" DROP CONSTRAINT IF EXISTS "heartbeat_runs_company_native_issue_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" DROP CONSTRAINT IF EXISTS "heartbeat_runs_company_native_issue_contract_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grants" DROP CONSTRAINT IF EXISTS "connection_grants_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_comments" DROP CONSTRAINT IF EXISTS "issue_comments_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_results" DROP CONSTRAINT IF EXISTS "native_run_results_company_issue_run_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_entities" DROP CONSTRAINT IF EXISTS "plugin_entities_external_idx" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decisions" DROP CONSTRAINT IF EXISTS "status_decisions_company_issue_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decisions" DROP CONSTRAINT IF EXISTS "status_decisions_company_issue_run_assessment_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "summary_slots" DROP CONSTRAINT IF EXISTS "summary_slots_company_scope_slot_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connections" DROP CONSTRAINT IF EXISTS "tool_connections_company_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP CONSTRAINT IF EXISTS "work_assessments_company_issue_run_id_uq" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP CONSTRAINT IF EXISTS "work_assessments_trigger_actor_company_check" CASCADE;
--> statement-breakpoint
ALTER TABLE "activity_log" DROP CONSTRAINT IF EXISTS "activity_log_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "adapter_auth_sessions" DROP CONSTRAINT IF EXISTS "adapter_auth_sessions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_config_revisions" DROP CONSTRAINT IF EXISTS "agent_config_revisions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_instruction_heads" DROP CONSTRAINT IF EXISTS "agent_instruction_heads_company_id_agent_id_entry_file_revision_id_agent_instruction_revisions_company_id_agent_id_entry_file_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_instruction_revisions" DROP CONSTRAINT IF EXISTS "agent_instruction_revisions_company_id_agent_id_agents_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_instruction_working_copies" DROP CONSTRAINT IF EXISTS "agent_instruction_working_copies_company_id_agent_id_agents_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_memberships" DROP CONSTRAINT IF EXISTS "agent_memberships_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_runtime_state" DROP CONSTRAINT IF EXISTS "agent_runtime_state_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_session_goal_actions" DROP CONSTRAINT IF EXISTS "agent_session_goal_actions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_task_sessions" DROP CONSTRAINT IF EXISTS "agent_task_sessions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" DROP CONSTRAINT IF EXISTS "agent_wakeup_requests_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_defaults" DROP CONSTRAINT IF EXISTS "ai_connection_defaults_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_defaults" DROP CONSTRAINT IF EXISTS "ai_connection_defaults_company_grant_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_pools" DROP CONSTRAINT IF EXISTS "ai_connection_pools_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_pools" DROP CONSTRAINT IF EXISTS "ai_connection_pools_company_connection_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_router_cursors" DROP CONSTRAINT IF EXISTS "ai_connection_router_cursors_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_router_cursors" DROP CONSTRAINT IF EXISTS "ai_connection_router_cursors_company_pool_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_task_pins" DROP CONSTRAINT IF EXISTS "ai_connection_task_pins_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_task_pins" DROP CONSTRAINT IF EXISTS "ai_connection_task_pins_company_pool_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_task_pins" DROP CONSTRAINT IF EXISTS "ai_connection_task_pins_company_agent_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_provider_defaults" DROP CONSTRAINT IF EXISTS "ai_provider_defaults_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_provider_defaults" DROP CONSTRAINT IF EXISTS "ai_provider_defaults_company_grant_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "approval_comments" DROP CONSTRAINT IF EXISTS "approval_comments_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "approvals" DROP CONSTRAINT IF EXISTS "approvals_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "browser_use_browsers" DROP CONSTRAINT IF EXISTS "browser_use_browsers_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "browser_use_runs" DROP CONSTRAINT IF EXISTS "browser_use_runs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "browser_use_sessions" DROP CONSTRAINT IF EXISTS "browser_use_sessions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "browser_use_settings" DROP CONSTRAINT IF EXISTS "browser_use_settings_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "budget_incidents" DROP CONSTRAINT IF EXISTS "budget_incidents_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "budget_policies" DROP CONSTRAINT IF EXISTS "budget_policies_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "built_in_managed_resources" DROP CONSTRAINT IF EXISTS "built_in_managed_resources_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_attachments" DROP CONSTRAINT IF EXISTS "case_attachments_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_documents" DROP CONSTRAINT IF EXISTS "case_documents_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_events" DROP CONSTRAINT IF EXISTS "case_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_issue_links" DROP CONSTRAINT IF EXISTS "case_issue_links_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_labels" DROP CONSTRAINT IF EXISTS "case_labels_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "cases" DROP CONSTRAINT IF EXISTS "cases_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_actions" DROP CONSTRAINT IF EXISTS "chat_actions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_actions" DROP CONSTRAINT IF EXISTS "chat_actions_company_delivery_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_actions" DROP CONSTRAINT IF EXISTS "chat_actions_company_conversation_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_actions" DROP CONSTRAINT IF EXISTS "chat_actions_company_principal_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_actions" DROP CONSTRAINT IF EXISTS "chat_actions_company_endpoint_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_agent_routes" DROP CONSTRAINT IF EXISTS "chat_agent_routes_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_agent_routes" DROP CONSTRAINT IF EXISTS "chat_agent_routes_company_source_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_agent_routes" DROP CONSTRAINT IF EXISTS "chat_agent_routes_company_destination_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_company_issue_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_company_endpoint_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_company_resource_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_deliveries" DROP CONSTRAINT IF EXISTS "chat_deliveries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_deliveries" DROP CONSTRAINT IF EXISTS "chat_deliveries_company_endpoint_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_deliveries" DROP CONSTRAINT IF EXISTS "chat_deliveries_company_conversation_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_deliveries" DROP CONSTRAINT IF EXISTS "chat_deliveries_company_principal_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoint_leases" DROP CONSTRAINT IF EXISTS "chat_endpoint_leases_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoint_leases" DROP CONSTRAINT IF EXISTS "chat_endpoint_leases_company_endpoint_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoint_resources" DROP CONSTRAINT IF EXISTS "chat_endpoint_resources_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoint_resources" DROP CONSTRAINT IF EXISTS "chat_endpoint_resources_company_endpoint_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoints" DROP CONSTRAINT IF EXISTS "chat_endpoints_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoints" DROP CONSTRAINT IF EXISTS "chat_endpoints_company_agent_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoints" DROP CONSTRAINT IF EXISTS "chat_endpoints_company_connection_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_external_principals" DROP CONSTRAINT IF EXISTS "chat_external_principals_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_identity_links" DROP CONSTRAINT IF EXISTS "chat_identity_links_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_identity_links" DROP CONSTRAINT IF EXISTS "chat_identity_links_company_endpoint_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_identity_links" DROP CONSTRAINT IF EXISTS "chat_identity_links_company_principal_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_message_links" DROP CONSTRAINT IF EXISTS "chat_message_links_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_message_links" DROP CONSTRAINT IF EXISTS "chat_message_links_company_endpoint_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_message_links" DROP CONSTRAINT IF EXISTS "chat_message_links_company_delivery_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_message_links" DROP CONSTRAINT IF EXISTS "chat_message_links_company_publication_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_message_links" DROP CONSTRAINT IF EXISTS "chat_message_links_company_comment_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_message_links" DROP CONSTRAINT IF EXISTS "chat_message_links_company_conversation_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_publications" DROP CONSTRAINT IF EXISTS "chat_publications_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_publications" DROP CONSTRAINT IF EXISTS "chat_publications_company_issue_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_publications" DROP CONSTRAINT IF EXISTS "chat_publications_company_comment_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_publications" DROP CONSTRAINT IF EXISTS "chat_publications_company_endpoint_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_publications" DROP CONSTRAINT IF EXISTS "chat_publications_company_conversation_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_sdk_state" DROP CONSTRAINT IF EXISTS "chat_sdk_state_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_sdk_state" DROP CONSTRAINT IF EXISTS "chat_sdk_state_company_endpoint_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_completion_deliveries" DROP CONSTRAINT IF EXISTS "chat_completion_deliveries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_task_handoffs" DROP CONSTRAINT IF EXISTS "chat_task_handoffs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_github_configurations" DROP CONSTRAINT IF EXISTS "chat_github_configurations_company_id_endpoint_id_chat_endpoints_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_github_registrations" DROP CONSTRAINT IF EXISTS "chat_github_registrations_company_id_endpoint_id_chat_endpoints_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_github_reviews" DROP CONSTRAINT IF EXISTS "chat_github_reviews_company_id_endpoint_id_chat_endpoints_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_github_reviews" DROP CONSTRAINT IF EXISTS "chat_github_reviews_company_id_issue_id_issues_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" DROP CONSTRAINT IF EXISTS "chat_teams_file_transfers_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" DROP CONSTRAINT IF EXISTS "chat_teams_file_transfers_company_id_endpoint_id_chat_endpoints_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" DROP CONSTRAINT IF EXISTS "chat_teams_file_transfers_company_id_publication_id_chat_publications_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" DROP CONSTRAINT IF EXISTS "chat_teams_file_transfers_company_id_conversation_id_chat_conversations_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" DROP CONSTRAINT IF EXISTS "chat_teams_file_transfers_company_id_principal_id_chat_external_principals_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "cli_auth_challenges" DROP CONSTRAINT IF EXISTS "cli_auth_challenges_requested_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_secret_bindings" DROP CONSTRAINT IF EXISTS "company_secret_bindings_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_secret_proposals" DROP CONSTRAINT IF EXISTS "company_secret_proposals_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_secret_provider_configs" DROP CONSTRAINT IF EXISTS "company_secret_provider_configs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_secrets" DROP CONSTRAINT IF EXISTS "company_secrets_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_policies" DROP CONSTRAINT IF EXISTS "company_skill_policies_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_source_entries" DROP CONSTRAINT IF EXISTS "company_skill_source_entries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_sources" DROP CONSTRAINT IF EXISTS "company_skill_sources_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_comments" DROP CONSTRAINT IF EXISTS "company_skill_comments_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_stars" DROP CONSTRAINT IF EXISTS "company_skill_stars_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_test_inputs" DROP CONSTRAINT IF EXISTS "company_skill_test_inputs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_test_run_templates" DROP CONSTRAINT IF EXISTS "company_skill_test_run_templates_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_test_runs" DROP CONSTRAINT IF EXISTS "company_skill_test_runs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_versions" DROP CONSTRAINT IF EXISTS "company_skill_versions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skills" DROP CONSTRAINT IF EXISTS "company_skills_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skills" DROP CONSTRAINT IF EXISTS "company_skills_forked_from_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_user_sidebar_preferences" DROP CONSTRAINT IF EXISTS "company_user_sidebar_preferences_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "completion_contracts" DROP CONSTRAINT IF EXISTS "completion_contracts_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "completion_contracts" DROP CONSTRAINT IF EXISTS "completion_contracts_issue_company_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "completion_contracts" DROP CONSTRAINT IF EXISTS "completion_contracts_supersedes_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_event_deliveries" DROP CONSTRAINT IF EXISTS "connection_event_deliveries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_intent_deliveries" DROP CONSTRAINT IF EXISTS "connection_intent_deliveries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_archive_notification_outbox" DROP CONSTRAINT IF EXISTS "decision_archive_notification_outbox_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_queue_items" DROP CONSTRAINT IF EXISTS "decision_queue_items_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_queue_items" DROP CONSTRAINT IF EXISTS "decision_queue_items_queue_company_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_queues" DROP CONSTRAINT IF EXISTS "decision_queues_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_retention" DROP CONSTRAINT IF EXISTS "decision_retention_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_triage" DROP CONSTRAINT IF EXISTS "decision_triage_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_triage_events" DROP CONSTRAINT IF EXISTS "decision_triage_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_training_examples" DROP CONSTRAINT IF EXISTS "decision_training_examples_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_bundles" DROP CONSTRAINT IF EXISTS "decision_bundles_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_target_issues" DROP CONSTRAINT IF EXISTS "decision_target_issues_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "decisions" DROP CONSTRAINT IF EXISTS "decisions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_annotation_anchor_snapshots" DROP CONSTRAINT IF EXISTS "document_annotation_anchor_snapshots_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_annotation_comments" DROP CONSTRAINT IF EXISTS "document_annotation_comments_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_annotation_threads" DROP CONSTRAINT IF EXISTS "document_annotation_threads_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_memberships" DROP CONSTRAINT IF EXISTS "document_memberships_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_revisions" DROP CONSTRAINT IF EXISTS "document_revisions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "email_endpoints" DROP CONSTRAINT IF EXISTS "email_endpoints_company_id_endpoint_id_chat_endpoints_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "email_messages" DROP CONSTRAINT IF EXISTS "email_messages_company_id_endpoint_id_chat_endpoints_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "email_messages" DROP CONSTRAINT IF EXISTS "email_messages_company_id_conversation_id_chat_conversations_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "email_sends" DROP CONSTRAINT IF EXISTS "email_sends_company_id_endpoint_id_chat_endpoints_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "email_sends" DROP CONSTRAINT IF EXISTS "email_sends_company_id_publication_id_chat_publications_company_id_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "environment_leases" DROP CONSTRAINT IF EXISTS "environment_leases_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "execution_workspace_runtime_leases" DROP CONSTRAINT IF EXISTS "execution_workspace_runtime_leases_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "execution_workspaces" DROP CONSTRAINT IF EXISTS "execution_workspaces_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "external_object_mentions" DROP CONSTRAINT IF EXISTS "external_object_mentions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "external_objects" DROP CONSTRAINT IF EXISTS "external_objects_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "feedback_exports" DROP CONSTRAINT IF EXISTS "feedback_exports_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "feedback_votes" DROP CONSTRAINT IF EXISTS "feedback_votes_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "finance_events" DROP CONSTRAINT IF EXISTS "finance_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "folders" DROP CONSTRAINT IF EXISTS "folders_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "goals_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" DROP CONSTRAINT IF EXISTS "heartbeat_run_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "heartbeat_run_watchdog_decisions" DROP CONSTRAINT IF EXISTS "heartbeat_run_watchdog_decisions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" DROP CONSTRAINT IF EXISTS "heartbeat_runs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "inbox_dismissals" DROP CONSTRAINT IF EXISTS "inbox_dismissals_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grant_delegations" DROP CONSTRAINT IF EXISTS "connection_grant_delegations_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grant_delegations" DROP CONSTRAINT IF EXISTS "connection_grant_delegations_company_grant_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grant_members" DROP CONSTRAINT IF EXISTS "connection_grant_members_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grant_members" DROP CONSTRAINT IF EXISTS "connection_grant_members_company_grant_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grants" DROP CONSTRAINT IF EXISTS "connection_grants_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grants" DROP CONSTRAINT IF EXISTS "connection_grants_company_connection_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_token_issuances" DROP CONSTRAINT IF EXISTS "connection_token_issuances_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_approvals" DROP CONSTRAINT IF EXISTS "issue_approvals_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_attachments" DROP CONSTRAINT IF EXISTS "issue_attachments_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_comments" DROP CONSTRAINT IF EXISTS "issue_comments_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_create_idempotency_keys" DROP CONSTRAINT IF EXISTS "issue_create_idempotency_keys_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_documents" DROP CONSTRAINT IF EXISTS "issue_documents_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_execution_decisions" DROP CONSTRAINT IF EXISTS "issue_execution_decisions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_inbox_archives" DROP CONSTRAINT IF EXISTS "issue_inbox_archives_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_labels" DROP CONSTRAINT IF EXISTS "issue_labels_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_plan_decompositions" DROP CONSTRAINT IF EXISTS "issue_plan_decompositions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_question_response_deliveries" DROP CONSTRAINT IF EXISTS "issue_question_response_deliveries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_read_states" DROP CONSTRAINT IF EXISTS "issue_read_states_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_recovery_actions" DROP CONSTRAINT IF EXISTS "issue_recovery_actions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_reference_mentions" DROP CONSTRAINT IF EXISTS "issue_reference_mentions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_relations" DROP CONSTRAINT IF EXISTS "issue_relations_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_thread_interactions" DROP CONSTRAINT IF EXISTS "issue_thread_interactions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_tree_hold_members" DROP CONSTRAINT IF EXISTS "issue_tree_hold_members_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_tree_holds" DROP CONSTRAINT IF EXISTS "issue_tree_holds_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_watchdogs" DROP CONSTRAINT IF EXISTS "issue_watchdogs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_work_products" DROP CONSTRAINT IF EXISTS "issue_work_products_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "labels" DROP CONSTRAINT IF EXISTS "labels_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "managed_agent_profiles" DROP CONSTRAINT IF EXISTS "managed_agent_profiles_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" DROP CONSTRAINT IF EXISTS "native_run_finalizations_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" DROP CONSTRAINT IF EXISTS "native_run_finalizations_issue_company_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" DROP CONSTRAINT IF EXISTS "native_run_finalizations_run_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" DROP CONSTRAINT IF EXISTS "native_run_finalizations_result_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" DROP CONSTRAINT IF EXISTS "native_run_finalizations_assessment_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" DROP CONSTRAINT IF EXISTS "native_run_finalizations_decision_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_results" DROP CONSTRAINT IF EXISTS "native_run_results_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_results" DROP CONSTRAINT IF EXISTS "native_run_results_issue_company_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_results" DROP CONSTRAINT IF EXISTS "native_run_results_run_contract_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_results" DROP CONSTRAINT IF EXISTS "native_run_results_completion_contract_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_automation_executions" DROP CONSTRAINT IF EXISTS "pipeline_automation_executions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_case_blockers" DROP CONSTRAINT IF EXISTS "pipeline_case_blockers_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_case_documents" DROP CONSTRAINT IF EXISTS "pipeline_case_documents_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_case_events" DROP CONSTRAINT IF EXISTS "pipeline_case_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_case_issue_links" DROP CONSTRAINT IF EXISTS "pipeline_case_issue_links_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_cases" DROP CONSTRAINT IF EXISTS "pipeline_cases_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_documents" DROP CONSTRAINT IF EXISTS "pipeline_documents_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipelines" DROP CONSTRAINT IF EXISTS "pipelines_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_company_settings" DROP CONSTRAINT IF EXISTS "plugin_company_settings_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_config" DROP CONSTRAINT IF EXISTS "plugin_config_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_entities" DROP CONSTRAINT IF EXISTS "plugin_entities_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_job_runs" DROP CONSTRAINT IF EXISTS "plugin_job_runs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_logs" DROP CONSTRAINT IF EXISTS "plugin_logs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_managed_resources" DROP CONSTRAINT IF EXISTS "plugin_managed_resources_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_webhook_deliveries" DROP CONSTRAINT IF EXISTS "plugin_webhook_deliveries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "project_goals" DROP CONSTRAINT IF EXISTS "project_goals_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "project_memberships" DROP CONSTRAINT IF EXISTS "project_memberships_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "project_workspaces" DROP CONSTRAINT IF EXISTS "project_workspaces_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "provider_trace_records" DROP CONSTRAINT IF EXISTS "provider_trace_records_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "remote_agent_profiles" DROP CONSTRAINT IF EXISTS "remote_agent_profiles_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "resource_lifecycle_events" DROP CONSTRAINT IF EXISTS "resource_lifecycle_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_documents" DROP CONSTRAINT IF EXISTS "routine_documents_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_revisions" DROP CONSTRAINT IF EXISTS "routine_revisions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_runs" DROP CONSTRAINT IF EXISTS "routine_runs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_triggers" DROP CONSTRAINT IF EXISTS "routine_triggers_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_webhook_test_receipts" DROP CONSTRAINT IF EXISTS "routine_webhook_test_receipts_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "routines" DROP CONSTRAINT IF EXISTS "routines_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "run_identity_contexts" DROP CONSTRAINT IF EXISTS "run_identity_contexts_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "runner_api_response_reservations" DROP CONSTRAINT IF EXISTS "runner_api_response_reservations_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "secret_access_events" DROP CONSTRAINT IF EXISTS "secret_access_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "smoke_run_steps" DROP CONSTRAINT IF EXISTS "smoke_run_steps_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "smoke_runs" DROP CONSTRAINT IF EXISTS "smoke_runs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_cards" DROP CONSTRAINT IF EXISTS "status_cards_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decision_effects" DROP CONSTRAINT IF EXISTS "status_decision_effects_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decision_effects" DROP CONSTRAINT IF EXISTS "status_decision_effects_issue_company_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decision_effects" DROP CONSTRAINT IF EXISTS "status_decision_effects_decision_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decisions" DROP CONSTRAINT IF EXISTS "status_decisions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decisions" DROP CONSTRAINT IF EXISTS "status_decisions_issue_company_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decisions" DROP CONSTRAINT IF EXISTS "status_decisions_assessment_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decisions" DROP CONSTRAINT IF EXISTS "status_decisions_supersedes_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "summary_slots" DROP CONSTRAINT IF EXISTS "summary_slots_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_access_audit_events" DROP CONSTRAINT IF EXISTS "tool_access_audit_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_action_deliveries" DROP CONSTRAINT IF EXISTS "tool_action_deliveries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_action_requests" DROP CONSTRAINT IF EXISTS "tool_action_requests_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_applications" DROP CONSTRAINT IF EXISTS "tool_applications_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_call_events" DROP CONSTRAINT IF EXISTS "tool_call_events_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_catalog_entries" DROP CONSTRAINT IF EXISTS "tool_catalog_entries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connection_app_snapshots" DROP CONSTRAINT IF EXISTS "tool_connection_app_snapshots_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connection_app_snapshots" DROP CONSTRAINT IF EXISTS "tool_connection_app_snapshots_company_connection_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connection_app_syncs" DROP CONSTRAINT IF EXISTS "tool_connection_app_syncs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connection_app_syncs" DROP CONSTRAINT IF EXISTS "tool_connection_app_syncs_company_connection_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connection_installs" DROP CONSTRAINT IF EXISTS "tool_connection_installs_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connections" DROP CONSTRAINT IF EXISTS "tool_connections_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_gateway_rate_limit_counters" DROP CONSTRAINT IF EXISTS "tool_gateway_rate_limit_counters_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_gateway_sessions" DROP CONSTRAINT IF EXISTS "tool_gateway_sessions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_invocations" DROP CONSTRAINT IF EXISTS "tool_invocations_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_mcp_gateway_tokens" DROP CONSTRAINT IF EXISTS "tool_mcp_gateway_tokens_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_mcp_gateways" DROP CONSTRAINT IF EXISTS "tool_mcp_gateways_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_oauth_states" DROP CONSTRAINT IF EXISTS "tool_oauth_states_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_policies" DROP CONSTRAINT IF EXISTS "tool_policies_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_profile_bindings" DROP CONSTRAINT IF EXISTS "tool_profile_bindings_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_profile_entries" DROP CONSTRAINT IF EXISTS "tool_profile_entries_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_profiles" DROP CONSTRAINT IF EXISTS "tool_profiles_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_rate_limit_counters" DROP CONSTRAINT IF EXISTS "tool_rate_limit_counters_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_runtime_metric_counters" DROP CONSTRAINT IF EXISTS "tool_runtime_metric_counters_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_runtime_slots" DROP CONSTRAINT IF EXISTS "tool_runtime_slots_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_stdio_command_templates" DROP CONSTRAINT IF EXISTS "tool_stdio_command_templates_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "user_inbox_agent_policies" DROP CONSTRAINT IF EXISTS "user_inbox_agent_policies_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "user_secret_declarations" DROP CONSTRAINT IF EXISTS "user_secret_declarations_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "user_secret_definitions" DROP CONSTRAINT IF EXISTS "user_secret_definitions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP CONSTRAINT IF EXISTS "work_assessments_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP CONSTRAINT IF EXISTS "work_assessments_trigger_actor_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP CONSTRAINT IF EXISTS "work_assessments_issue_company_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP CONSTRAINT IF EXISTS "work_assessments_run_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP CONSTRAINT IF EXISTS "work_assessments_contract_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP CONSTRAINT IF EXISTS "work_assessments_result_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP CONSTRAINT IF EXISTS "work_assessments_supersedes_owner_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "workspace_operations" DROP CONSTRAINT IF EXISTS "workspace_operations_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" DROP CONSTRAINT IF EXISTS "workspace_runtime_services_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_event_admissions" DROP CONSTRAINT IF EXISTS "mcp_event_admissions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_event_subscriptions" DROP CONSTRAINT IF EXISTS "mcp_event_subscriptions_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_mutation_receipts" DROP CONSTRAINT IF EXISTS "mcp_mutation_receipts_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_oauth_grants" DROP CONSTRAINT IF EXISTS "mcp_oauth_grants_company_id_companies_id_fk" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "approval_comments_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "built_in_managed_resources_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_endpoints_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_external_principals_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_publications_company_id_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cli_auth_challenges_requested_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secret_bindings_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secret_provider_configs_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secrets_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_user_sidebar_preferences_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "goals_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_approvals_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_comments_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_labels_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_onboarding_first_task_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "labels_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "managed_agent_profiles_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_cases_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipelines_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_company_settings_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_entities_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_job_runs_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_logs_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_managed_resources_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_webhook_deliveries_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "project_goals_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "projects_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "remote_agent_profiles_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "runner_api_response_reservations_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_applications_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_catalog_entries_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_connections_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_gateway_rate_limit_counters_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_mcp_gateways_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_oauth_states_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_rate_limit_counters_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_runtime_slots_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_stdio_command_templates_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_secret_declarations_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "mcp_event_admissions_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "mcp_event_subscriptions_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "mcp_mutation_receipts_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "activity_log_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "activity_log_company_agent_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "activity_log_company_responsible_user_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "adapter_auth_sessions_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "adapter_auth_sessions_company_owner_adapter_active_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_config_revisions_company_agent_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_instruction_revisions_history_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_instruction_copies_agent_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_memberships_company_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_memberships_company_user_starred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_memberships_company_user_agent_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_runtime_state_company_agent_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_runtime_state_company_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_session_goal_actions_company_status_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_task_sessions_company_agent_adapter_task_uniq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_task_sessions_company_agent_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_task_sessions_company_task_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_wakeup_requests_company_agent_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_wakeup_requests_company_requested_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_wakeup_requests_review_path_recovery_idempotency_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_wakeup_requests_disposition_repair_idempotency_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_wakeup_requests_question_response_delivery_idempotency_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_wakeup_requests_connection_intent_delivery_idempotency_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_wakeup_requests_tool_action_delivery_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_wakeup_requests_chat_completion_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_wakeup_requests_company_payload_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agents_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agents_company_reports_to_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "agents_company_default_environment_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "ai_connection_defaults_owner_method_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "ai_connection_task_pins_affinity_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "ai_provider_defaults_owner_provider_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "approvals_company_status_type_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "assets_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "assets_company_provider_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "assets_company_object_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "browser_use_sessions_task_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "budget_incidents_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "budget_incidents_company_scope_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "budget_policies_company_scope_active_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "budget_policies_company_window_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "budget_policies_company_scope_metric_unique_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "built_in_managed_resources_company_bundle_resource_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "case_attachments_company_case_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "case_documents_company_case_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "case_documents_company_case_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "case_events_company_case_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "case_issue_links_company_case_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "case_labels_company_case_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cases_company_case_number_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cases_company_type_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cases_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cases_company_type_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cases_company_project_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_conversations_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_endpoint_resources_endpoint_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_endpoints_agent_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_endpoints_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_external_principals_external_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_identity_links_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_publications_idempotency_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_task_handoffs_source_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_github_reviews_task_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_teams_file_transfers_publication_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secret_bindings_target_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secret_bindings_target_path_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secret_proposals_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secret_provider_configs_company_provider_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secret_provider_configs_default_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secrets_company_scope_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secrets_company_owner_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secrets_user_definition_owner_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secrets_company_provider_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secrets_company_name_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secrets_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_secrets_user_definition_owner_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_source_entries_company_skill_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_sources_repository_ref_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_sources_identity_ref_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_comments_company_skill_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_stars_company_skill_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_test_inputs_company_skill_name_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_test_inputs_company_skill_active_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_test_run_templates_company_active_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_test_runs_company_skill_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_test_runs_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_test_runs_company_input_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_test_runs_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_test_runs_company_harness_expires_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skill_versions_company_skill_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skills_company_key_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skills_company_name_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skills_company_folder_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skills_company_sharing_scope_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skills_company_current_version_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_skills_company_forked_from_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "company_user_sidebar_preferences_company_user_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_event_deliveries_company_provider_id_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_event_deliveries_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cost_events_company_occurred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cost_events_company_agent_occurred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cost_events_company_provider_occurred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cost_events_company_biller_occurred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "cost_events_company_heartbeat_run_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_archive_notification_outbox_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_queue_items_company_source_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_queues_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_queues_company_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_retention_company_source_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_retention_company_archived_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_triage_company_source_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_triage_company_decide_by_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_triage_events_company_source_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_training_examples_company_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decision_bundles_company_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decisions_company_status_expires_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "decisions_company_idempotency_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_anchor_snapshots_company_thread_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_anchor_snapshots_company_document_revision_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_comments_company_thread_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_comments_company_issue_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_comments_company_routine_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_comments_company_case_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_comments_company_document_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_threads_company_document_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_threads_company_issue_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_threads_company_routine_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_threads_company_case_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_threads_company_current_revision_open_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_annotation_threads_company_anchor_state_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_memberships_company_user_starred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_memberships_company_user_document_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "document_revisions_company_document_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "documents_company_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "documents_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "email_messages_conversation_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "environment_leases_company_environment_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "environment_leases_company_execution_workspace_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "environment_leases_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "environment_leases_company_last_used_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "execution_workspace_runtime_leases_company_workspace_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "execution_workspace_runtime_leases_company_owner_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "execution_workspaces_company_project_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "execution_workspaces_company_project_workspace_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "execution_workspaces_company_source_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "execution_workspaces_company_last_used_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "execution_workspaces_company_branch_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_object_mentions_company_source_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_object_mentions_company_object_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_object_mentions_company_provider_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_object_mentions_company_source_record_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_object_mentions_company_source_null_record_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_objects_company_provider_object_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_objects_company_provider_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_objects_company_refresh_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_objects_company_external_id_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "external_objects_company_identity_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "feedback_exports_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "feedback_exports_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "feedback_exports_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "feedback_exports_company_project_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "feedback_exports_company_author_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "feedback_votes_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "feedback_votes_company_target_author_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "finance_events_company_occurred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "finance_events_company_biller_occurred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "finance_events_company_kind_occurred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "finance_events_company_direction_occurred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "finance_events_company_heartbeat_run_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "finance_events_company_cost_event_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "folders_company_kind_position_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "folders_company_kind_root_slug_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "folders_company_kind_parent_slug_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "folders_company_kind_system_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "folders_company_kind_parent_position_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_run_events_company_run_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_run_events_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_run_watchdog_decisions_company_run_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_run_watchdog_decisions_company_run_snooze_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_native_replacement_predecessor_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_company_agent_started_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_company_responsible_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_company_liveness_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_company_status_last_output_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_company_status_process_started_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_company_created_at_desc_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_company_ctx_issue_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_company_ctx_task_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "heartbeat_runs_company_ctx_taskkey_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "inbox_dismissals_company_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "inbox_dismissals_company_item_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "inbox_dismissals_company_user_item_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_grant_delegations_company_agent_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_grant_members_company_subject_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_grants_company_connection_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_grants_subject_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_grants_subject_agent_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_token_issuances_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_token_issuances_connection_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_token_issuances_agent_connection_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "connection_token_issuances_run_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_attachments_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_comments_company_issue_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_comments_company_author_issue_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_create_idempotency_keys_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_create_idempotency_keys_company_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_documents_company_issue_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_documents_company_issue_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_execution_decisions_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_inbox_archives_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_inbox_archives_company_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_inbox_archives_company_issue_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_plan_decompositions_company_source_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_plan_decompositions_active_owner_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_plan_decompositions_source_revision_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_question_response_deliveries_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_read_states_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_read_states_company_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_read_states_company_issue_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_recovery_actions_company_source_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_recovery_actions_company_owner_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_recovery_actions_company_recovery_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_recovery_actions_active_source_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_recovery_actions_active_fingerprint_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_reference_mentions_company_source_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_reference_mentions_company_target_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_reference_mentions_company_issue_pair_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_reference_mentions_company_source_mention_record_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_reference_mentions_company_source_mention_null_record_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_relations_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_relations_company_related_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_relations_company_type_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_relations_company_edge_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_thread_interactions_company_issue_created_at_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_thread_interactions_company_issue_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_thread_interactions_company_issue_idempotency_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_tree_hold_members_company_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_tree_holds_company_root_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_tree_holds_company_status_mode_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_watchdogs_company_issue_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_watchdogs_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_watchdogs_company_agent_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_watchdogs_company_watchdog_issue_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_work_products_company_issue_type_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_work_products_company_execution_workspace_type_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_work_products_company_provider_external_id_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issue_work_products_company_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_conversation_identity_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_harness_kind_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_assignee_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_assignee_user_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_responsible_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_parent_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_project_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_origin_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_project_workspace_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_execution_workspace_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_monitor_due_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_open_normalized_title_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_company_priority_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_open_routine_execution_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_active_liveness_recovery_incident_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_active_liveness_recovery_leaf_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_active_stale_run_evaluation_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_active_task_watchdog_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_active_productivity_review_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "issues_active_stranded_issue_recovery_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "labels_company_name_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "managed_agent_profiles_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "managed_agent_profiles_company_resource_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_automation_executions_company_case_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_case_blockers_company_case_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_case_documents_company_case_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_case_documents_company_case_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_case_events_company_case_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_case_issue_links_company_case_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_cases_retired_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_documents_company_pipeline_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipeline_documents_company_pipeline_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipelines_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "pipelines_company_project_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_company_settings_company_plugin_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_config_plugin_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "plugin_managed_resources_company_plugin_resource_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "project_memberships_company_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "project_memberships_company_user_starred_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "project_memberships_company_user_project_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "project_workspaces_company_project_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "project_workspaces_company_shared_key_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "provider_trace_records_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "remote_agent_profiles_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "resource_lifecycle_events_creation_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "resource_lifecycle_events_company_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routine_documents_company_routine_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routine_documents_company_routine_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routine_revisions_company_routine_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routine_revisions_company_responsible_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routine_runs_company_routine_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routine_runs_company_responsible_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routine_triggers_company_routine_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routine_triggers_company_kind_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routines_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routines_company_assignee_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routines_company_project_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routines_company_folder_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routines_company_responsible_user_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "routines_company_origin_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "run_identity_contexts_company_run_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "secret_access_events_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "secret_access_events_company_credential_owner_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "secret_access_events_consumer_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "smoke_run_steps_company_run_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "smoke_run_steps_company_path_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "smoke_runs_company_started_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "smoke_runs_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "status_cards_company_archived_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "status_cards_company_next_eval_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "status_decision_effects_company_idempotency_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "status_decisions_company_issue_version_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "status_decisions_company_assessment_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "status_decisions_company_issue_digest_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "summary_slots_company_scope_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "summary_slots_company_generating_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "summary_slots_company_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_access_audit_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_access_audit_gateway_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_action_requests_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_action_requests_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_applications_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_applications_company_name_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_applications_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_call_events_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_call_events_run_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_call_events_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_call_events_gateway_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_catalog_entries_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_connection_app_snapshots_owner_toolkit_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_connection_app_syncs_owner_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_connection_installs_company_target_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_connection_installs_connection_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_connection_installs_target_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_connections_company_enabled_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_connections_company_uid_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_gateway_rate_limit_counters_window_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_gateway_sessions_company_agent_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_gateway_sessions_company_expires_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_gateway_sessions_run_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_gateway_sessions_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_gateway_sessions_gateway_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_invocations_company_created_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_invocations_run_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_invocations_issue_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_invocations_gateway_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_invocations_company_idempotency_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_mcp_gateway_tokens_gateway_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_mcp_gateway_tokens_subject_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_mcp_gateway_tokens_company_expires_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_mcp_gateways_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_mcp_gateways_profile_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_mcp_gateways_company_slug_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_mcp_gateways_company_name_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_oauth_states_subject_agent_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_policies_company_enabled_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_policies_company_type_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_policies_company_name_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profile_bindings_company_target_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profile_bindings_target_profile_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profile_entries_company_profile_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profile_entries_application_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profile_entries_connection_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profile_entries_catalog_entry_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profiles_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profiles_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_profiles_company_name_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_rate_limit_counters_window_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_runtime_metric_counters_company_metric_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_runtime_metric_counters_bucket_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_runtime_slots_execution_workspace_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_runtime_slots_slot_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_stdio_command_templates_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "tool_stdio_command_templates_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_inbox_agent_policies_company_user_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_secret_declarations_target_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_secret_declarations_company_required_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_secret_declarations_target_path_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_secret_declarations_required_override_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_secret_definitions_company_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_secret_definitions_company_provider_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_secret_definitions_company_key_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "work_assessments_company_issue_input_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_operations_company_run_started_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_operations_company_workspace_started_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_operations_company_workspace_issue_started_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_runtime_services_company_workspace_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_runtime_services_company_execution_workspace_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_runtime_services_company_project_status_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspace_runtime_services_company_updated_idx" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "mcp_mutation_receipts_request_uq" CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS "mcp_oauth_grants_user_company_idx" CASCADE;
--> statement-breakpoint
ALTER TABLE "activity_log" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "adapter_auth_sessions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_config_revisions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_instruction_heads" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_instruction_revisions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_instruction_working_copies" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_memberships" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_runtime_state" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_session_goal_actions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_task_sessions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_defaults" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_pools" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_router_cursors" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_connection_task_pins" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "ai_provider_defaults" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "approval_comments" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "approvals" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "browser_use_browsers" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "browser_use_runs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "browser_use_sessions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "browser_use_settings" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "budget_incidents" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "budget_policies" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "built_in_managed_resources" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_attachments" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_documents" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_issue_links" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "case_labels" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "cases" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_actions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_agent_routes" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_conversations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_deliveries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoint_leases" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoint_resources" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_endpoints" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_external_principals" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_identity_links" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_message_links" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_publications" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_sdk_state" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_completion_deliveries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_task_handoffs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_discord_command_owners" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_github_configurations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_github_registrations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_github_reviews" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "cli_auth_challenges" DROP COLUMN IF EXISTS "requested_company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_secret_bindings" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_secret_proposals" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_secret_provider_configs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_secrets" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_policies" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_source_entries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_sources" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_comments" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_stars" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_test_inputs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_test_run_templates" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_test_runs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skill_versions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skills" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_skills" DROP COLUMN IF EXISTS "forked_from_company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "company_user_sidebar_preferences" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "completion_contracts" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_event_deliveries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_intent_deliveries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "cost_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_archive_notification_outbox" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_queue_items" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_queues" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_retention" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_triage" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_triage_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_training_examples" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_bundles" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decision_target_issues" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "decisions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_annotation_anchor_snapshots" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_annotation_comments" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_annotation_threads" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_memberships" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "document_revisions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "email_endpoints" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "email_messages" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "email_sends" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "environment_leases" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "execution_workspace_runtime_leases" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "execution_workspaces" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "external_object_mentions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "external_objects" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "feedback_exports" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "feedback_votes" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "finance_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "folders" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "heartbeat_run_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "heartbeat_run_watchdog_decisions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "inbox_dismissals" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grant_delegations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grant_members" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_grants" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "connection_token_issuances" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_approvals" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_attachments" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_comments" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_create_idempotency_keys" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_documents" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_execution_decisions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_inbox_archives" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_labels" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_plan_decompositions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_question_response_deliveries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_read_states" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_recovery_actions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_reference_mentions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_relations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_thread_interactions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_tree_hold_members" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_tree_holds" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_watchdogs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "labels" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "managed_agent_profiles" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "native_run_results" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_automation_executions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_case_blockers" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_case_documents" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_case_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_case_issue_links" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_cases" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipeline_documents" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "pipelines" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_company_settings" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_config" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_entities" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_job_runs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_logs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_managed_resources" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "plugin_webhook_deliveries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "project_goals" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "project_memberships" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "project_workspaces" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "provider_trace_records" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "remote_agent_profiles" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "resource_lifecycle_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_documents" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_revisions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_runs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_triggers" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "routine_webhook_test_receipts" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "run_identity_contexts" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "runner_api_response_reservations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "secret_access_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "smoke_run_steps" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "smoke_runs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_cards" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decision_effects" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "status_decisions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "summary_slots" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_access_audit_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_action_deliveries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_action_requests" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_applications" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_call_events" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_catalog_entries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connection_app_snapshots" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connection_app_syncs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connection_installs" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_connections" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_gateway_rate_limit_counters" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_gateway_sessions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_invocations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_mcp_gateway_tokens" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_mcp_gateways" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_oauth_states" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_policies" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_profile_bindings" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_profile_entries" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_profiles" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_rate_limit_counters" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_runtime_metric_counters" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_runtime_slots" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "tool_stdio_command_templates" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "user_inbox_agent_policies" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "user_secret_declarations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "user_secret_definitions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "work_assessments" DROP COLUMN IF EXISTS "trigger_actor_company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "workspace_operations" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "workspace_runtime_services" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_event_admissions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_event_subscriptions" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_mutation_receipts" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_oauth_device_requests" DROP COLUMN IF EXISTS "requested_company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_oauth_grants" DROP COLUMN IF EXISTS "company_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "mcp_oauth_requests" DROP COLUMN IF EXISTS "requested_company_id" CASCADE;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "activity_log_company_created_idx" ON "activity_log" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "activity_log_company_agent_created_idx" ON "activity_log" USING btree ("agent_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "activity_log_company_responsible_user_created_idx" ON "activity_log" USING btree ("responsible_user_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "adapter_auth_sessions_company_status_idx" ON "adapter_auth_sessions" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "adapter_auth_sessions_company_owner_adapter_active_uq" ON "adapter_auth_sessions" USING btree ("started_by_user_id","adapter_type") WHERE "adapter_auth_sessions"."status" IN ('starting', 'waiting_for_user', 'promoting', 'awaiting_code', 'submitting');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_config_revisions_company_agent_created_idx" ON "agent_config_revisions" USING btree ("agent_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_instruction_revisions_history_idx" ON "agent_instruction_revisions" USING btree ("agent_id","entry_file","created_at","id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_instruction_copies_agent_idx" ON "agent_instruction_working_copies" USING btree ("agent_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_memberships_company_user_idx" ON "agent_memberships" USING btree ("user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_memberships_company_user_starred_idx" ON "agent_memberships" USING btree ("user_id","starred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "agent_memberships_company_user_agent_uq" ON "agent_memberships" USING btree ("user_id","agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_runtime_state_company_agent_idx" ON "agent_runtime_state" USING btree ("agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_runtime_state_company_updated_idx" ON "agent_runtime_state" USING btree ("updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_session_goal_actions_company_status_created_idx" ON "agent_session_goal_actions" USING btree ("status","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "agent_task_sessions_company_agent_adapter_task_uniq" ON "agent_task_sessions" USING btree ("agent_id","adapter_type","task_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_task_sessions_company_agent_updated_idx" ON "agent_task_sessions" USING btree ("agent_id","updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_task_sessions_company_task_updated_idx" ON "agent_task_sessions" USING btree ("task_key","updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_wakeup_requests_company_agent_status_idx" ON "agent_wakeup_requests" USING btree ("agent_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_wakeup_requests_company_requested_idx" ON "agent_wakeup_requests" USING btree ("requested_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "agent_wakeup_requests_review_path_recovery_idempotency_uq" ON "agent_wakeup_requests" USING btree ("idempotency_key") WHERE "agent_wakeup_requests"."idempotency_key" LIKE 'issue_review_path_lost:%' AND "agent_wakeup_requests"."status" <> 'skipped';
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "agent_wakeup_requests_disposition_repair_idempotency_uq" ON "agent_wakeup_requests" USING btree ("idempotency_key") WHERE "agent_wakeup_requests"."idempotency_key" LIKE 'issue_disposition_repair:%' AND "agent_wakeup_requests"."status" <> 'skipped';
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "agent_wakeup_requests_question_response_delivery_idempotency_uq" ON "agent_wakeup_requests" USING btree ("idempotency_key") WHERE ("agent_wakeup_requests"."idempotency_key" LIKE 'question-response:%' OR "agent_wakeup_requests"."idempotency_key" LIKE 'interaction:%') AND "agent_wakeup_requests"."status" NOT IN ('skipped', 'failed', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "agent_wakeup_requests_connection_intent_delivery_idempotency_uq" ON "agent_wakeup_requests" USING btree ("idempotency_key") WHERE "agent_wakeup_requests"."idempotency_key" LIKE 'connection-intent:%' AND "agent_wakeup_requests"."status" NOT IN ('skipped', 'failed', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "agent_wakeup_requests_tool_action_delivery_uq" ON "agent_wakeup_requests" USING btree ("idempotency_key") WHERE "agent_wakeup_requests"."idempotency_key" LIKE 'tool-action-response:%' AND "agent_wakeup_requests"."status" NOT IN ('skipped', 'failed', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "agent_wakeup_requests_chat_completion_uq" ON "agent_wakeup_requests" USING btree ("idempotency_key") WHERE "agent_wakeup_requests"."idempotency_key" LIKE 'chat-completion:%';
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agent_wakeup_requests_company_payload_issue_idx" ON "agent_wakeup_requests" USING btree (("payload" ->> 'issueId'));
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agents_company_status_idx" ON "agents" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agents_company_reports_to_idx" ON "agents" USING btree ("reports_to");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "agents_company_default_environment_idx" ON "agents" USING btree ("default_environment_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "ai_connection_defaults_owner_method_uq" ON "ai_connection_defaults" USING btree ("user_id","provider","method");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "ai_connection_task_pins_affinity_uq" ON "ai_connection_task_pins" USING btree ("pool_id","agent_id","task_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "ai_provider_defaults_owner_provider_uq" ON "ai_provider_defaults" USING btree ("user_id","provider");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "approvals_company_status_type_idx" ON "approvals" USING btree ("status","type");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "assets_company_created_idx" ON "assets" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "assets_company_provider_idx" ON "assets" USING btree ("provider");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "assets_company_object_key_uq" ON "assets" USING btree ("object_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "browser_use_sessions_task_idx" ON "browser_use_sessions" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "budget_incidents_company_status_idx" ON "budget_incidents" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "budget_incidents_company_scope_idx" ON "budget_incidents" USING btree ("scope_type","scope_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "budget_policies_company_scope_active_idx" ON "budget_policies" USING btree ("scope_type","scope_id","is_active");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "budget_policies_company_window_idx" ON "budget_policies" USING btree ("window_kind","metric");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "budget_policies_company_scope_metric_unique_idx" ON "budget_policies" USING btree ("scope_type","scope_id","metric","window_kind");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "built_in_managed_resources_company_bundle_resource_uq" ON "built_in_managed_resources" USING btree ("bundle_key","resource_kind","resource_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "case_attachments_company_case_idx" ON "case_attachments" USING btree ("case_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "case_documents_company_case_key_uq" ON "case_documents" USING btree ("case_id","key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "case_documents_company_case_updated_idx" ON "case_documents" USING btree ("case_id","updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "case_events_company_case_idx" ON "case_events" USING btree ("case_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "case_issue_links_company_case_idx" ON "case_issue_links" USING btree ("case_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "case_labels_company_case_idx" ON "case_labels" USING btree ("case_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "cases_company_case_number_uq" ON "cases" USING btree ("case_number");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "cases_company_type_key_uq" ON "cases" USING btree ("case_type","key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "cases_company_status_idx" ON "cases" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "cases_company_type_idx" ON "cases" USING btree ("case_type");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "cases_company_project_idx" ON "cases" USING btree ("project_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "chat_conversations_issue_idx" ON "chat_conversations" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "chat_endpoint_resources_endpoint_idx" ON "chat_endpoint_resources" USING btree ("endpoint_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "chat_endpoints_agent_idx" ON "chat_endpoints" USING btree ("assigned_agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "chat_endpoints_status_idx" ON "chat_endpoints" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "chat_external_principals_external_uq" ON "chat_external_principals" USING btree ("provider","provider_account_id","external_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "chat_identity_links_user_idx" ON "chat_identity_links" USING btree ("paperclip_user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "chat_publications_idempotency_uq" ON "chat_publications" USING btree ("idempotency_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "chat_task_handoffs_source_idx" ON "chat_task_handoffs" USING btree ("conversation_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "chat_github_reviews_task_idx" ON "chat_github_reviews" USING btree ("issue_id","run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "chat_teams_file_transfers_publication_uq" ON "chat_teams_file_transfers" USING btree ("publication_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_secret_bindings_target_idx" ON "company_secret_bindings" USING btree ("target_type","target_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_secret_bindings_target_path_uq" ON "company_secret_bindings" USING btree ("target_type","target_id","config_path");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_secret_proposals_company_status_idx" ON "company_secret_proposals" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_secret_provider_configs_company_provider_idx" ON "company_secret_provider_configs" USING btree ("provider");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_secret_provider_configs_default_uq" ON "company_secret_provider_configs" USING btree ("provider") WHERE "company_secret_provider_configs"."is_default" = true;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_secrets_company_scope_idx" ON "company_secrets" USING btree ("scope");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_secrets_company_owner_idx" ON "company_secrets" USING btree ("owner_user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_secrets_user_definition_owner_idx" ON "company_secrets" USING btree ("user_secret_definition_id","owner_user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_secrets_company_provider_idx" ON "company_secrets" USING btree ("provider");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_secrets_company_name_uq" ON "company_secrets" USING btree ("name") WHERE "company_secrets"."scope" = 'company' and "company_secrets"."deleted_at" is null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_secrets_company_key_uq" ON "company_secrets" USING btree ("key") WHERE "company_secrets"."scope" = 'company' and "company_secrets"."deleted_at" is null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_secrets_user_definition_owner_uq" ON "company_secrets" USING btree ("user_secret_definition_id","owner_user_id") WHERE "company_secrets"."scope" = 'user' and "company_secrets"."deleted_at" is null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_source_entries_company_skill_idx" ON "company_skill_source_entries" USING btree ("skill_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_skill_sources_repository_ref_idx" ON "company_skill_sources" USING btree ("repository_url","tracking_ref");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_skill_sources_identity_ref_idx" ON "company_skill_sources" USING btree ("repository_id","tracking_ref");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_comments_company_skill_created_idx" ON "company_skill_comments" USING btree ("company_skill_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_stars_company_skill_created_idx" ON "company_skill_stars" USING btree ("company_skill_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_test_inputs_company_skill_name_idx" ON "company_skill_test_inputs" USING btree ("skill_id","name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_test_inputs_company_skill_active_idx" ON "company_skill_test_inputs" USING btree ("skill_id","deleted_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_test_run_templates_company_active_idx" ON "company_skill_test_run_templates" USING btree ("deleted_at","name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_test_runs_company_skill_created_idx" ON "company_skill_test_runs" USING btree ("skill_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_skill_test_runs_company_issue_idx" ON "company_skill_test_runs" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_test_runs_company_input_created_idx" ON "company_skill_test_runs" USING btree ("input_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_test_runs_company_status_idx" ON "company_skill_test_runs" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_test_runs_company_harness_expires_idx" ON "company_skill_test_runs" USING btree ("harness_issue_expires_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skill_versions_company_skill_created_idx" ON "company_skill_versions" USING btree ("company_skill_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_skills_company_key_idx" ON "company_skills" USING btree ("key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skills_company_name_idx" ON "company_skills" USING btree ("name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skills_company_folder_idx" ON "company_skills" USING btree ("folder_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skills_company_sharing_scope_idx" ON "company_skills" USING btree ("sharing_scope");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skills_company_current_version_idx" ON "company_skills" USING btree ("current_version_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "company_skills_company_forked_from_idx" ON "company_skills" USING btree ("forked_from_skill_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "company_user_sidebar_preferences_company_user_uq" ON "company_user_sidebar_preferences" USING btree ("user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "connection_event_deliveries_company_provider_id_uq" ON "connection_event_deliveries" USING btree ("provider","provider_delivery_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_event_deliveries_company_status_idx" ON "connection_event_deliveries" USING btree ("status","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "cost_events_company_occurred_idx" ON "cost_events" USING btree ("occurred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "cost_events_company_agent_occurred_idx" ON "cost_events" USING btree ("agent_id","occurred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "cost_events_company_provider_occurred_idx" ON "cost_events" USING btree ("provider","occurred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "cost_events_company_biller_occurred_idx" ON "cost_events" USING btree ("biller","occurred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "cost_events_company_heartbeat_run_idx" ON "cost_events" USING btree ("heartbeat_run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "decision_archive_notification_outbox_uq" ON "decision_archive_notification_outbox" USING btree ("source_kind","source_id","archive_version","origin_agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "decision_queue_items_company_source_idx" ON "decision_queue_items" USING btree ("source_kind","source_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "decision_queues_company_key_uq" ON "decision_queues" USING btree ("key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "decision_queues_company_updated_idx" ON "decision_queues" USING btree ("updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "decision_retention_company_source_uq" ON "decision_retention" USING btree ("source_kind","source_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "decision_retention_company_archived_idx" ON "decision_retention" USING btree ("archived_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "decision_triage_company_source_uq" ON "decision_triage" USING btree ("source_kind","source_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "decision_triage_company_decide_by_idx" ON "decision_triage" USING btree ("decide_by");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "decision_triage_events_company_source_created_idx" ON "decision_triage_events" USING btree ("source_kind","source_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "decision_training_examples_company_created_at_idx" ON "decision_training_examples" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "decision_bundles_company_created_at_idx" ON "decision_bundles" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "decisions_company_status_expires_at_idx" ON "decisions" USING btree ("status","expires_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "decisions_company_idempotency_uq" ON "decisions" USING btree ("idempotency_key") WHERE "decisions"."idempotency_key" IS NOT NULL;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_anchor_snapshots_company_thread_created_at_idx" ON "document_annotation_anchor_snapshots" USING btree ("thread_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_anchor_snapshots_company_document_revision_idx" ON "document_annotation_anchor_snapshots" USING btree ("document_id","to_revision_number");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_comments_company_thread_created_at_idx" ON "document_annotation_comments" USING btree ("thread_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_comments_company_issue_created_at_idx" ON "document_annotation_comments" USING btree ("issue_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_comments_company_routine_created_at_idx" ON "document_annotation_comments" USING btree ("routine_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_comments_company_case_created_at_idx" ON "document_annotation_comments" USING btree ("case_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_comments_company_document_created_at_idx" ON "document_annotation_comments" USING btree ("document_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_threads_company_document_status_idx" ON "document_annotation_threads" USING btree ("document_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_threads_company_issue_status_idx" ON "document_annotation_threads" USING btree ("issue_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_threads_company_routine_status_idx" ON "document_annotation_threads" USING btree ("routine_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_threads_company_case_status_idx" ON "document_annotation_threads" USING btree ("case_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_threads_company_current_revision_open_idx" ON "document_annotation_threads" USING btree ("document_id","current_revision_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_annotation_threads_company_anchor_state_idx" ON "document_annotation_threads" USING btree ("anchor_state");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_memberships_company_user_starred_idx" ON "document_memberships" USING btree ("user_id","starred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "document_memberships_company_user_document_uq" ON "document_memberships" USING btree ("user_id","document_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "document_revisions_company_document_created_idx" ON "document_revisions" USING btree ("document_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "documents_company_updated_idx" ON "documents" USING btree ("updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "documents_company_created_idx" ON "documents" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "email_messages_conversation_idx" ON "email_messages" USING btree ("conversation_id","timestamp");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "environment_leases_company_environment_status_idx" ON "environment_leases" USING btree ("environment_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "environment_leases_company_execution_workspace_idx" ON "environment_leases" USING btree ("execution_workspace_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "environment_leases_company_issue_idx" ON "environment_leases" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "environment_leases_company_last_used_idx" ON "environment_leases" USING btree ("last_used_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "execution_workspace_runtime_leases_company_workspace_idx" ON "execution_workspace_runtime_leases" USING btree ("execution_workspace_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "execution_workspace_runtime_leases_company_owner_idx" ON "execution_workspace_runtime_leases" USING btree ("owner_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "execution_workspaces_company_project_status_idx" ON "execution_workspaces" USING btree ("project_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "execution_workspaces_company_project_workspace_status_idx" ON "execution_workspaces" USING btree ("project_workspace_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "execution_workspaces_company_source_issue_idx" ON "execution_workspaces" USING btree ("source_issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "execution_workspaces_company_last_used_idx" ON "execution_workspaces" USING btree ("last_used_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "execution_workspaces_company_branch_idx" ON "execution_workspaces" USING btree ("branch_name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "external_object_mentions_company_source_issue_idx" ON "external_object_mentions" USING btree ("source_issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "external_object_mentions_company_object_idx" ON "external_object_mentions" USING btree ("object_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "external_object_mentions_company_provider_idx" ON "external_object_mentions" USING btree ("provider_key","object_type");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "external_object_mentions_company_source_record_uq" ON "external_object_mentions" USING btree ("source_issue_id","source_kind","source_record_id","document_key","property_key","canonical_identity_hash") WHERE "external_object_mentions"."source_record_id" is not null and "external_object_mentions"."canonical_identity_hash" is not null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "external_object_mentions_company_source_null_record_uq" ON "external_object_mentions" USING btree ("source_issue_id","source_kind","document_key","property_key","canonical_identity_hash") WHERE "external_object_mentions"."source_record_id" is null and "external_object_mentions"."canonical_identity_hash" is not null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "external_objects_company_provider_object_idx" ON "external_objects" USING btree ("provider_key","object_type");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "external_objects_company_provider_status_idx" ON "external_objects" USING btree ("provider_key","status_category");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "external_objects_company_refresh_idx" ON "external_objects" USING btree ("next_refresh_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "external_objects_company_external_id_uq" ON "external_objects" USING btree ("provider_key","object_type","external_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "external_objects_company_identity_uq" ON "external_objects" USING btree ("provider_key","object_type","canonical_identity_hash");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "feedback_exports_company_created_idx" ON "feedback_exports" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "feedback_exports_company_status_idx" ON "feedback_exports" USING btree ("status","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "feedback_exports_company_issue_idx" ON "feedback_exports" USING btree ("issue_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "feedback_exports_company_project_idx" ON "feedback_exports" USING btree ("project_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "feedback_exports_company_author_idx" ON "feedback_exports" USING btree ("author_user_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "feedback_votes_company_issue_idx" ON "feedback_votes" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "feedback_votes_company_target_author_idx" ON "feedback_votes" USING btree ("target_type","target_id","author_user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "finance_events_company_occurred_idx" ON "finance_events" USING btree ("occurred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "finance_events_company_biller_occurred_idx" ON "finance_events" USING btree ("biller","occurred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "finance_events_company_kind_occurred_idx" ON "finance_events" USING btree ("event_kind","occurred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "finance_events_company_direction_occurred_idx" ON "finance_events" USING btree ("direction","occurred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "finance_events_company_heartbeat_run_idx" ON "finance_events" USING btree ("heartbeat_run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "finance_events_company_cost_event_idx" ON "finance_events" USING btree ("cost_event_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "folders_company_kind_position_idx" ON "folders" USING btree ("kind","position","name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "folders_company_kind_root_slug_uq" ON "folders" USING btree ("kind","slug") WHERE "folders"."parent_id" is null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "folders_company_kind_parent_slug_uq" ON "folders" USING btree ("kind","parent_id","slug") WHERE "folders"."parent_id" is not null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "folders_company_kind_system_key_uq" ON "folders" USING btree ("kind","system_key") WHERE "folders"."system_key" is not null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "folders_company_kind_parent_position_idx" ON "folders" USING btree ("kind","parent_id","position","name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_run_events_company_run_idx" ON "heartbeat_run_events" USING btree ("run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_run_events_company_created_idx" ON "heartbeat_run_events" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_run_watchdog_decisions_company_run_created_idx" ON "heartbeat_run_watchdog_decisions" USING btree ("run_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_run_watchdog_decisions_company_run_snooze_idx" ON "heartbeat_run_watchdog_decisions" USING btree ("run_id","snoozed_until");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "heartbeat_runs_native_replacement_predecessor_uq" ON "heartbeat_runs" USING btree ("retry_of_run_id") WHERE "heartbeat_runs"."scheduled_retry_reason" = 'native_safe_replacement';
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_runs_company_agent_started_idx" ON "heartbeat_runs" USING btree ("agent_id","started_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_runs_company_responsible_user_idx" ON "heartbeat_runs" USING btree ("responsible_user_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_runs_company_liveness_idx" ON "heartbeat_runs" USING btree ("liveness_state","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_runs_company_status_last_output_idx" ON "heartbeat_runs" USING btree ("status","last_output_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_runs_company_status_process_started_idx" ON "heartbeat_runs" USING btree ("status","process_started_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_runs_company_created_at_desc_idx" ON "heartbeat_runs" USING btree ("created_at" DESC NULLS LAST);
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_runs_company_ctx_issue_created_idx" ON "heartbeat_runs" USING btree (("context_snapshot" ->> 'issueId'),"created_at" DESC NULLS LAST);
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_runs_company_ctx_task_created_idx" ON "heartbeat_runs" USING btree (("context_snapshot" ->> 'taskId'),"created_at" DESC NULLS LAST);
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "heartbeat_runs_company_ctx_taskkey_created_idx" ON "heartbeat_runs" USING btree (("context_snapshot" ->> 'taskKey'),"created_at" DESC NULLS LAST);
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "inbox_dismissals_company_user_idx" ON "inbox_dismissals" USING btree ("user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "inbox_dismissals_company_item_idx" ON "inbox_dismissals" USING btree ("item_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "inbox_dismissals_company_user_item_idx" ON "inbox_dismissals" USING btree ("user_id","item_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_grant_delegations_company_agent_idx" ON "connection_grant_delegations" USING btree ("agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_grant_members_company_subject_idx" ON "connection_grant_members" USING btree ("subject_type","subject_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_grants_company_connection_idx" ON "connection_grants" USING btree ("connection_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_grants_subject_user_idx" ON "connection_grants" USING btree ("subject_user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_grants_subject_agent_idx" ON "connection_grants" USING btree ("subject_agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_token_issuances_company_created_idx" ON "connection_token_issuances" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_token_issuances_connection_created_idx" ON "connection_token_issuances" USING btree ("connection_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_token_issuances_agent_connection_idx" ON "connection_token_issuances" USING btree ("agent_id","connection_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "connection_token_issuances_run_idx" ON "connection_token_issuances" USING btree ("run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_attachments_company_issue_idx" ON "issue_attachments" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_comments_company_issue_created_at_idx" ON "issue_comments" USING btree ("issue_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_comments_company_author_issue_created_at_idx" ON "issue_comments" USING btree ("author_user_id","issue_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_create_idempotency_keys_company_key_uq" ON "issue_create_idempotency_keys" USING btree ("idempotency_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_create_idempotency_keys_company_created_at_idx" ON "issue_create_idempotency_keys" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_documents_company_issue_key_uq" ON "issue_documents" USING btree ("issue_id","key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_documents_company_issue_updated_idx" ON "issue_documents" USING btree ("issue_id","updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_execution_decisions_company_issue_idx" ON "issue_execution_decisions" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_inbox_archives_company_issue_idx" ON "issue_inbox_archives" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_inbox_archives_company_user_idx" ON "issue_inbox_archives" USING btree ("user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_inbox_archives_company_issue_user_idx" ON "issue_inbox_archives" USING btree ("issue_id","user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_plan_decompositions_company_source_status_idx" ON "issue_plan_decompositions" USING btree ("source_issue_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_plan_decompositions_active_owner_idx" ON "issue_plan_decompositions" USING btree ("owner_agent_id") WHERE "issue_plan_decompositions"."status" = 'in_flight';
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_plan_decompositions_source_revision_uq" ON "issue_plan_decompositions" USING btree ("source_issue_id","accepted_plan_revision_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_question_response_deliveries_company_issue_idx" ON "issue_question_response_deliveries" USING btree ("issue_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_read_states_company_issue_idx" ON "issue_read_states" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_read_states_company_user_idx" ON "issue_read_states" USING btree ("user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_read_states_company_issue_user_idx" ON "issue_read_states" USING btree ("issue_id","user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_recovery_actions_company_source_status_idx" ON "issue_recovery_actions" USING btree ("source_issue_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_recovery_actions_company_owner_status_idx" ON "issue_recovery_actions" USING btree ("owner_agent_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_recovery_actions_company_recovery_issue_idx" ON "issue_recovery_actions" USING btree ("recovery_issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_recovery_actions_active_source_uq" ON "issue_recovery_actions" USING btree ("source_issue_id") WHERE "issue_recovery_actions"."status" in ('active', 'escalated');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_recovery_actions_active_fingerprint_uq" ON "issue_recovery_actions" USING btree ("source_issue_id","cause","fingerprint") WHERE "issue_recovery_actions"."status" in ('active', 'escalated');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_reference_mentions_company_source_issue_idx" ON "issue_reference_mentions" USING btree ("source_issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_reference_mentions_company_target_issue_idx" ON "issue_reference_mentions" USING btree ("target_issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_reference_mentions_company_issue_pair_idx" ON "issue_reference_mentions" USING btree ("source_issue_id","target_issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_reference_mentions_company_source_mention_record_uq" ON "issue_reference_mentions" USING btree ("source_issue_id","target_issue_id","source_kind","source_record_id") WHERE "issue_reference_mentions"."source_record_id" is not null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_reference_mentions_company_source_mention_null_record_uq" ON "issue_reference_mentions" USING btree ("source_issue_id","target_issue_id","source_kind") WHERE "issue_reference_mentions"."source_record_id" is null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_relations_company_issue_idx" ON "issue_relations" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_relations_company_related_issue_idx" ON "issue_relations" USING btree ("related_issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_relations_company_type_idx" ON "issue_relations" USING btree ("type");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_relations_company_edge_uq" ON "issue_relations" USING btree ("issue_id","related_issue_id","type");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_thread_interactions_company_issue_created_at_idx" ON "issue_thread_interactions" USING btree ("issue_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_thread_interactions_company_issue_status_idx" ON "issue_thread_interactions" USING btree ("issue_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_thread_interactions_company_issue_idempotency_uq" ON "issue_thread_interactions" USING btree ("issue_id","idempotency_key") WHERE "issue_thread_interactions"."idempotency_key" IS NOT NULL;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_tree_hold_members_company_issue_idx" ON "issue_tree_hold_members" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_tree_holds_company_root_status_idx" ON "issue_tree_holds" USING btree ("root_issue_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_tree_holds_company_status_mode_idx" ON "issue_tree_holds" USING btree ("status","mode");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_watchdogs_company_issue_uq" ON "issue_watchdogs" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_watchdogs_company_status_idx" ON "issue_watchdogs" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_watchdogs_company_agent_idx" ON "issue_watchdogs" USING btree ("watchdog_agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issue_watchdogs_company_watchdog_issue_uq" ON "issue_watchdogs" USING btree ("watchdog_issue_id") WHERE "issue_watchdogs"."watchdog_issue_id" is not null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_work_products_company_issue_type_idx" ON "issue_work_products" USING btree ("issue_id","type");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_work_products_company_execution_workspace_type_idx" ON "issue_work_products" USING btree ("execution_workspace_id","type");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_work_products_company_provider_external_id_idx" ON "issue_work_products" USING btree ("provider","external_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issue_work_products_company_updated_idx" ON "issue_work_products" USING btree ("updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issues_conversation_identity_idx" ON "issues" USING btree ("conversation_agent_id","conversation_user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_status_idx" ON "issues" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_harness_kind_idx" ON "issues" USING btree ("harness_kind");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_assignee_status_idx" ON "issues" USING btree ("assignee_agent_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_assignee_user_status_idx" ON "issues" USING btree ("assignee_user_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_responsible_user_idx" ON "issues" USING btree ("responsible_user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_parent_idx" ON "issues" USING btree ("parent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_project_idx" ON "issues" USING btree ("project_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_origin_idx" ON "issues" USING btree ("origin_kind","origin_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_project_workspace_idx" ON "issues" USING btree ("project_workspace_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_execution_workspace_idx" ON "issues" USING btree ("execution_workspace_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_monitor_due_idx" ON "issues" USING btree ("monitor_next_check_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_updated_idx" ON "issues" USING btree ("updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_created_idx" ON "issues" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_open_normalized_title_created_idx" ON "issues" USING btree ("parent_id",lower(regexp_replace(btrim("title"), '\s+', ' ', 'g')),"created_at") WHERE "issues"."hidden_at" is null and "issues"."status" not in ('done', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "issues_company_priority_idx" ON "issues" USING btree ("priority");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issues_open_routine_execution_uq" ON "issues" USING btree ("origin_kind","origin_id","origin_fingerprint") WHERE "issues"."origin_kind" = 'routine_execution'
          and "issues"."origin_id" is not null
          and "issues"."hidden_at" is null
          and "issues"."execution_run_id" is not null
          and "issues"."status" in ('backlog', 'todo', 'in_progress', 'in_review', 'blocked');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issues_active_liveness_recovery_incident_uq" ON "issues" USING btree ("origin_kind","origin_id") WHERE "issues"."origin_kind" = 'harness_liveness_escalation'
          and "issues"."origin_id" is not null
          and "issues"."hidden_at" is null
          and "issues"."status" not in ('done', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issues_active_liveness_recovery_leaf_uq" ON "issues" USING btree ("origin_kind","origin_fingerprint") WHERE "issues"."origin_kind" = 'harness_liveness_escalation'
          and "issues"."origin_fingerprint" <> 'default'
          and "issues"."hidden_at" is null
          and "issues"."status" not in ('done', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issues_active_stale_run_evaluation_uq" ON "issues" USING btree ("origin_kind","origin_id") WHERE "issues"."origin_kind" = 'stale_active_run_evaluation'
          and "issues"."origin_id" is not null
          and "issues"."hidden_at" is null
          and "issues"."status" not in ('done', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issues_active_task_watchdog_uq" ON "issues" USING btree ("origin_kind","origin_id") WHERE "issues"."origin_kind" = 'task_watchdog'
          and "issues"."origin_id" is not null
          and "issues"."hidden_at" is null
          and "issues"."status" not in ('done', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issues_active_productivity_review_uq" ON "issues" USING btree ("origin_kind","origin_id") WHERE "issues"."origin_kind" = 'issue_productivity_review'
          and "issues"."origin_id" is not null
          and "issues"."hidden_at" is null
          and "issues"."status" not in ('done', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "issues_active_stranded_issue_recovery_uq" ON "issues" USING btree ("origin_kind","origin_id") WHERE "issues"."origin_kind" = 'stranded_issue_recovery'
          and "issues"."origin_id" is not null
          and "issues"."hidden_at" is null
          and "issues"."status" not in ('done', 'cancelled');
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "labels_company_name_idx" ON "labels" USING btree ("name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "managed_agent_profiles_company_key_uq" ON "managed_agent_profiles" USING btree ("profile_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "managed_agent_profiles_company_resource_uq" ON "managed_agent_profiles" USING btree ("anthropic_agent_id","agent_version","environment_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "pipeline_automation_executions_company_case_idx" ON "pipeline_automation_executions" USING btree ("case_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "pipeline_case_blockers_company_case_idx" ON "pipeline_case_blockers" USING btree ("case_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "pipeline_case_documents_company_case_key_uq" ON "pipeline_case_documents" USING btree ("case_id","key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "pipeline_case_documents_company_case_updated_idx" ON "pipeline_case_documents" USING btree ("case_id","updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "pipeline_case_events_company_case_idx" ON "pipeline_case_events" USING btree ("case_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "pipeline_case_issue_links_company_case_idx" ON "pipeline_case_issue_links" USING btree ("case_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "pipeline_cases_retired_idx" ON "pipeline_cases" USING btree ("retired_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "pipeline_documents_company_pipeline_key_uq" ON "pipeline_documents" USING btree ("pipeline_id","key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "pipeline_documents_company_pipeline_updated_idx" ON "pipeline_documents" USING btree ("pipeline_id","updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "pipelines_company_key_uq" ON "pipelines" USING btree ("key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "pipelines_company_project_idx" ON "pipelines" USING btree ("project_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "plugin_company_settings_company_plugin_uq" ON "plugin_company_settings" USING btree ("plugin_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "plugin_config_plugin_company_idx" ON "plugin_config" USING btree ("plugin_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "plugin_managed_resources_company_plugin_resource_uq" ON "plugin_managed_resources" USING btree ("plugin_id","resource_kind","resource_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "project_memberships_company_user_idx" ON "project_memberships" USING btree ("user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "project_memberships_company_user_starred_idx" ON "project_memberships" USING btree ("user_id","starred_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "project_memberships_company_user_project_uq" ON "project_memberships" USING btree ("user_id","project_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "project_workspaces_company_project_idx" ON "project_workspaces" USING btree ("project_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "project_workspaces_company_shared_key_idx" ON "project_workspaces" USING btree ("shared_workspace_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "provider_trace_records_company_created_idx" ON "provider_trace_records" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "remote_agent_profiles_company_key_uq" ON "remote_agent_profiles" USING btree ("profile_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "resource_lifecycle_events_creation_idx" ON "resource_lifecycle_events" USING btree ("resource_type","resource_id") WHERE "resource_lifecycle_events"."action" = 'create';
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "resource_lifecycle_events_company_idx" ON "resource_lifecycle_events" USING btree ("id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "routine_documents_company_routine_key_uq" ON "routine_documents" USING btree ("routine_id","key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routine_documents_company_routine_updated_idx" ON "routine_documents" USING btree ("routine_id","updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routine_revisions_company_routine_created_idx" ON "routine_revisions" USING btree ("routine_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routine_revisions_company_responsible_user_idx" ON "routine_revisions" USING btree ("responsible_user_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routine_runs_company_routine_idx" ON "routine_runs" USING btree ("routine_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routine_runs_company_responsible_user_idx" ON "routine_runs" USING btree ("responsible_user_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routine_triggers_company_routine_idx" ON "routine_triggers" USING btree ("routine_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routine_triggers_company_kind_idx" ON "routine_triggers" USING btree ("kind");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routines_company_status_idx" ON "routines" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routines_company_assignee_idx" ON "routines" USING btree ("assignee_agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routines_company_project_idx" ON "routines" USING btree ("project_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routines_company_folder_idx" ON "routines" USING btree ("folder_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routines_company_responsible_user_idx" ON "routines" USING btree ("responsible_user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "routines_company_origin_idx" ON "routines" USING btree ("origin_kind","origin_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "run_identity_contexts_company_run_idx" ON "run_identity_contexts" USING btree ("run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "secret_access_events_company_created_idx" ON "secret_access_events" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "secret_access_events_company_credential_owner_idx" ON "secret_access_events" USING btree ("credential_owner_user_id","created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "secret_access_events_consumer_idx" ON "secret_access_events" USING btree ("consumer_type","consumer_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "smoke_run_steps_company_run_idx" ON "smoke_run_steps" USING btree ("run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "smoke_run_steps_company_path_idx" ON "smoke_run_steps" USING btree ("path");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "smoke_runs_company_started_idx" ON "smoke_runs" USING btree ("started_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "smoke_runs_company_status_idx" ON "smoke_runs" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "status_cards_company_archived_idx" ON "status_cards" USING btree ("archived_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "status_cards_company_next_eval_idx" ON "status_cards" USING btree ("next_eval_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "status_decision_effects_company_idempotency_uq" ON "status_decision_effects" USING btree ("idempotency_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "status_decisions_company_issue_version_uq" ON "status_decisions" USING btree ("issue_id","decision_version");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "status_decisions_company_assessment_uq" ON "status_decisions" USING btree ("assessment_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "status_decisions_company_issue_digest_uq" ON "status_decisions" USING btree ("issue_id","decision_digest");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "summary_slots_company_scope_idx" ON "summary_slots" USING btree ("scope_kind","scope_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "summary_slots_company_generating_issue_idx" ON "summary_slots" USING btree ("generating_issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "summary_slots_company_updated_idx" ON "summary_slots" USING btree ("updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_access_audit_company_created_idx" ON "tool_access_audit_events" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_access_audit_gateway_idx" ON "tool_access_audit_events" USING btree ("gateway_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_action_requests_company_status_idx" ON "tool_action_requests" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_action_requests_issue_idx" ON "tool_action_requests" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_applications_company_status_idx" ON "tool_applications" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_applications_company_name_uq" ON "tool_applications" USING btree ("name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_applications_company_key_uq" ON "tool_applications" USING btree ("application_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_call_events_company_created_idx" ON "tool_call_events" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_call_events_run_idx" ON "tool_call_events" USING btree ("run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_call_events_issue_idx" ON "tool_call_events" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_call_events_gateway_idx" ON "tool_call_events" USING btree ("gateway_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_catalog_entries_company_status_idx" ON "tool_catalog_entries" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_connection_app_snapshots_owner_toolkit_uq" ON "tool_connection_app_snapshots" USING btree ("connection_id","user_id","toolkit");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_connection_app_syncs_owner_key_uq" ON "tool_connection_app_syncs" USING btree ("connection_id","user_id","credential_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_connection_installs_company_target_idx" ON "tool_connection_installs" USING btree ("target_type","target_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_connection_installs_connection_idx" ON "tool_connection_installs" USING btree ("connection_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_connection_installs_target_uq" ON "tool_connection_installs" USING btree ("connection_id","target_type","target_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_connections_company_enabled_idx" ON "tool_connections" USING btree ("enabled");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_connections_company_uid_uq" ON "tool_connections" USING btree ("uid");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_gateway_rate_limit_counters_window_uq" ON "tool_gateway_rate_limit_counters" USING btree ("counter_key","window_start_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_gateway_sessions_company_agent_idx" ON "tool_gateway_sessions" USING btree ("agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_gateway_sessions_company_expires_idx" ON "tool_gateway_sessions" USING btree ("expires_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_gateway_sessions_run_idx" ON "tool_gateway_sessions" USING btree ("run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_gateway_sessions_issue_idx" ON "tool_gateway_sessions" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_gateway_sessions_gateway_idx" ON "tool_gateway_sessions" USING btree ("gateway_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_invocations_company_created_idx" ON "tool_invocations" USING btree ("created_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_invocations_run_idx" ON "tool_invocations" USING btree ("run_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_invocations_issue_idx" ON "tool_invocations" USING btree ("issue_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_invocations_gateway_idx" ON "tool_invocations" USING btree ("gateway_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_invocations_company_idempotency_uq" ON "tool_invocations" USING btree ("idempotency_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_mcp_gateway_tokens_gateway_idx" ON "tool_mcp_gateway_tokens" USING btree ("gateway_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_mcp_gateway_tokens_subject_idx" ON "tool_mcp_gateway_tokens" USING btree ("subject_type","subject_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_mcp_gateway_tokens_company_expires_idx" ON "tool_mcp_gateway_tokens" USING btree ("expires_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_mcp_gateways_company_status_idx" ON "tool_mcp_gateways" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_mcp_gateways_profile_idx" ON "tool_mcp_gateways" USING btree ("profile_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_mcp_gateways_company_slug_uq" ON "tool_mcp_gateways" USING btree ("slug");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_mcp_gateways_company_name_uq" ON "tool_mcp_gateways" USING btree ("name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_oauth_states_subject_agent_idx" ON "tool_oauth_states" USING btree ("subject_agent_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_policies_company_enabled_idx" ON "tool_policies" USING btree ("enabled");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_policies_company_type_idx" ON "tool_policies" USING btree ("policy_type");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_policies_company_name_uq" ON "tool_policies" USING btree ("name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_profile_bindings_company_target_idx" ON "tool_profile_bindings" USING btree ("target_type","target_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_profile_bindings_target_profile_uq" ON "tool_profile_bindings" USING btree ("target_type","target_id","profile_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_profile_entries_company_profile_idx" ON "tool_profile_entries" USING btree ("profile_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_profile_entries_application_idx" ON "tool_profile_entries" USING btree ("application_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_profile_entries_connection_idx" ON "tool_profile_entries" USING btree ("connection_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_profile_entries_catalog_entry_idx" ON "tool_profile_entries" USING btree ("catalog_entry_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_profiles_company_status_idx" ON "tool_profiles" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_profiles_company_key_uq" ON "tool_profiles" USING btree ("profile_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_profiles_company_name_uq" ON "tool_profiles" USING btree ("name");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_rate_limit_counters_window_uq" ON "tool_rate_limit_counters" USING btree ("policy_id","counter_key","window_kind","window_start_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_runtime_metric_counters_company_metric_idx" ON "tool_runtime_metric_counters" USING btree ("metric","bucket_start_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_runtime_metric_counters_bucket_uq" ON "tool_runtime_metric_counters" USING btree ("metric","bucket_start_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_runtime_slots_execution_workspace_idx" ON "tool_runtime_slots" USING btree ("execution_workspace_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_runtime_slots_slot_key_uq" ON "tool_runtime_slots" USING btree ("slot_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "tool_stdio_command_templates_company_status_idx" ON "tool_stdio_command_templates" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "tool_stdio_command_templates_company_key_uq" ON "tool_stdio_command_templates" USING btree ("template_key");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "user_inbox_agent_policies_company_user_uq" ON "user_inbox_agent_policies" USING btree ("user_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "user_secret_declarations_target_idx" ON "user_secret_declarations" USING btree ("target_type","target_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "user_secret_declarations_company_required_idx" ON "user_secret_declarations" USING btree ("required");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "user_secret_declarations_target_path_uq" ON "user_secret_declarations" USING btree ("target_type","target_id","config_path");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "user_secret_declarations_required_override_idx" ON "user_secret_declarations" USING btree ("allow_missing_override") WHERE "user_secret_declarations"."allow_missing_override" = true;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "user_secret_definitions_company_status_idx" ON "user_secret_definitions" USING btree ("status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "user_secret_definitions_company_provider_idx" ON "user_secret_definitions" USING btree ("provider");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "user_secret_definitions_company_key_uq" ON "user_secret_definitions" USING btree ("key") WHERE "user_secret_definitions"."deleted_at" is null;
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "work_assessments_company_issue_input_uq" ON "work_assessments" USING btree ("issue_id","input_digest");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "workspace_operations_company_run_started_idx" ON "workspace_operations" USING btree ("heartbeat_run_id","started_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "workspace_operations_company_workspace_started_idx" ON "workspace_operations" USING btree ("execution_workspace_id","started_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "workspace_operations_company_workspace_issue_started_idx" ON "workspace_operations" USING btree ("execution_workspace_id","issue_id","started_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "workspace_runtime_services_company_workspace_status_idx" ON "workspace_runtime_services" USING btree ("project_workspace_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "workspace_runtime_services_company_execution_workspace_status_idx" ON "workspace_runtime_services" USING btree ("execution_workspace_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "workspace_runtime_services_company_project_status_idx" ON "workspace_runtime_services" USING btree ("project_id","status");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "workspace_runtime_services_company_updated_idx" ON "workspace_runtime_services" USING btree ("updated_at");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE UNIQUE INDEX "mcp_mutation_receipts_request_uq" ON "mcp_mutation_receipts" USING btree ("user_id","operation","request_id");
--> statement-breakpoint
-- paperclip:migration-safety-ignore large-create-index-not-concurrently: Drizzle migrations run transactionally, so CONCURRENTLY is unavailable; these indexes replace the company-scoped ones dropped in the same migration.
CREATE INDEX "mcp_oauth_grants_user_company_idx" ON "mcp_oauth_grants" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "agent_instruction_heads" ADD CONSTRAINT "agent_instruction_heads_identity_uq" UNIQUE("agent_id","entry_file");
--> statement-breakpoint
ALTER TABLE "agent_instruction_revisions" ADD CONSTRAINT "agent_instruction_revisions_identity_uq" UNIQUE("agent_id","entry_file","id");
--> statement-breakpoint
ALTER TABLE "completion_contracts" ADD CONSTRAINT "completion_contracts_company_issue_id_uq" UNIQUE("issue_id","id");
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_company_native_issue_id_uq" UNIQUE("native_issue_id","id");
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_company_native_issue_contract_id_uq" UNIQUE("native_issue_id","id","completion_contract_id");
--> statement-breakpoint
ALTER TABLE "native_run_results" ADD CONSTRAINT "native_run_results_company_issue_run_id_uq" UNIQUE("issue_id","run_id","id");
--> statement-breakpoint
ALTER TABLE "plugin_entities" ADD CONSTRAINT "plugin_entities_external_idx" UNIQUE NULLS NOT DISTINCT("plugin_id","entity_type","external_id");
--> statement-breakpoint
ALTER TABLE "status_decisions" ADD CONSTRAINT "status_decisions_company_issue_id_uq" UNIQUE("issue_id","id");
--> statement-breakpoint
ALTER TABLE "status_decisions" ADD CONSTRAINT "status_decisions_company_issue_run_assessment_id_uq" UNIQUE("issue_id","run_id","assessment_id","id");
--> statement-breakpoint
ALTER TABLE "summary_slots" ADD CONSTRAINT "summary_slots_company_scope_slot_uq" UNIQUE NULLS NOT DISTINCT("scope_kind","scope_id","slot_key");
--> statement-breakpoint
ALTER TABLE "work_assessments" ADD CONSTRAINT "work_assessments_company_issue_run_id_uq" UNIQUE("issue_id","run_id","id");
--> statement-breakpoint
ALTER TABLE "agent_instruction_heads" ADD CONSTRAINT "agent_instruction_heads_agent_id_entry_file_revision_id_agent_instruction_revisions_agent_id_entry_file_id_fk" FOREIGN KEY ("agent_id","entry_file","revision_id") REFERENCES "public"."agent_instruction_revisions"("agent_id","entry_file","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_instruction_revisions" ADD CONSTRAINT "agent_instruction_revisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_instruction_working_copies" ADD CONSTRAINT "agent_instruction_working_copies_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_connection_defaults" ADD CONSTRAINT "ai_connection_defaults_company_grant_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."connection_grants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_connection_pools" ADD CONSTRAINT "ai_connection_pools_company_connection_fk" FOREIGN KEY ("id") REFERENCES "public"."tool_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_connection_router_cursors" ADD CONSTRAINT "ai_connection_router_cursors_company_pool_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."ai_connection_pools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_connection_task_pins" ADD CONSTRAINT "ai_connection_task_pins_company_pool_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."ai_connection_pools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_connection_task_pins" ADD CONSTRAINT "ai_connection_task_pins_company_agent_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_provider_defaults" ADD CONSTRAINT "ai_provider_defaults_company_grant_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."connection_grants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_company_delivery_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."chat_deliveries"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_company_conversation_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_company_principal_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."chat_external_principals"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_company_endpoint_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_agent_routes" ADD CONSTRAINT "chat_agent_routes_company_source_fk" FOREIGN KEY ("source_endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_agent_routes" ADD CONSTRAINT "chat_agent_routes_company_destination_fk" FOREIGN KEY ("destination_endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_company_issue_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_company_endpoint_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_company_resource_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."chat_endpoint_resources"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_deliveries" ADD CONSTRAINT "chat_deliveries_company_endpoint_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_deliveries" ADD CONSTRAINT "chat_deliveries_company_conversation_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_deliveries" ADD CONSTRAINT "chat_deliveries_company_principal_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."chat_external_principals"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_endpoint_leases" ADD CONSTRAINT "chat_endpoint_leases_company_endpoint_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_endpoint_resources" ADD CONSTRAINT "chat_endpoint_resources_company_endpoint_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_endpoints" ADD CONSTRAINT "chat_endpoints_company_agent_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_endpoints" ADD CONSTRAINT "chat_endpoints_company_connection_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."tool_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_identity_links" ADD CONSTRAINT "chat_identity_links_company_endpoint_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_identity_links" ADD CONSTRAINT "chat_identity_links_company_principal_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."chat_external_principals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_message_links" ADD CONSTRAINT "chat_message_links_company_endpoint_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_message_links" ADD CONSTRAINT "chat_message_links_company_delivery_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."chat_deliveries"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_message_links" ADD CONSTRAINT "chat_message_links_company_publication_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."chat_publications"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_message_links" ADD CONSTRAINT "chat_message_links_company_comment_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_message_links" ADD CONSTRAINT "chat_message_links_company_conversation_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_publications" ADD CONSTRAINT "chat_publications_company_issue_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_publications" ADD CONSTRAINT "chat_publications_company_comment_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_publications" ADD CONSTRAINT "chat_publications_company_endpoint_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_publications" ADD CONSTRAINT "chat_publications_company_conversation_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_sdk_state" ADD CONSTRAINT "chat_sdk_state_company_endpoint_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_github_configurations" ADD CONSTRAINT "chat_github_configurations_endpoint_id_chat_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_github_registrations" ADD CONSTRAINT "chat_github_registrations_endpoint_id_chat_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_github_reviews" ADD CONSTRAINT "chat_github_reviews_endpoint_id_chat_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_github_reviews" ADD CONSTRAINT "chat_github_reviews_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" ADD CONSTRAINT "chat_teams_file_transfers_endpoint_id_chat_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" ADD CONSTRAINT "chat_teams_file_transfers_publication_id_chat_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."chat_publications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" ADD CONSTRAINT "chat_teams_file_transfers_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_teams_file_transfers" ADD CONSTRAINT "chat_teams_file_transfers_principal_id_chat_external_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."chat_external_principals"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "completion_contracts" ADD CONSTRAINT "completion_contracts_issue_company_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "completion_contracts" ADD CONSTRAINT "completion_contracts_supersedes_owner_fk" FOREIGN KEY ("issue_id","supersedes_contract_id") REFERENCES "public"."completion_contracts"("issue_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "decision_queue_items" ADD CONSTRAINT "decision_queue_items_queue_company_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."decision_queues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_endpoints" ADD CONSTRAINT "email_endpoints_endpoint_id_chat_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_endpoint_id_chat_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_endpoint_id_chat_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."chat_endpoints"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_publication_id_chat_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."chat_publications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "connection_grant_delegations" ADD CONSTRAINT "connection_grant_delegations_company_grant_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."connection_grants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "connection_grant_members" ADD CONSTRAINT "connection_grant_members_company_grant_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."connection_grants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "connection_grants" ADD CONSTRAINT "connection_grants_company_connection_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."tool_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" ADD CONSTRAINT "native_run_finalizations_issue_company_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" ADD CONSTRAINT "native_run_finalizations_run_owner_fk" FOREIGN KEY ("issue_id","run_id") REFERENCES "public"."heartbeat_runs"("native_issue_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" ADD CONSTRAINT "native_run_finalizations_result_owner_fk" FOREIGN KEY ("issue_id","run_id","result_id") REFERENCES "public"."native_run_results"("issue_id","run_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" ADD CONSTRAINT "native_run_finalizations_assessment_owner_fk" FOREIGN KEY ("issue_id","run_id","assessment_id") REFERENCES "public"."work_assessments"("issue_id","run_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "native_run_finalizations" ADD CONSTRAINT "native_run_finalizations_decision_owner_fk" FOREIGN KEY ("issue_id","run_id","assessment_id","decision_id") REFERENCES "public"."status_decisions"("issue_id","run_id","assessment_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "native_run_results" ADD CONSTRAINT "native_run_results_issue_company_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "native_run_results" ADD CONSTRAINT "native_run_results_run_contract_owner_fk" FOREIGN KEY ("issue_id","run_id","completion_contract_id") REFERENCES "public"."heartbeat_runs"("native_issue_id","id","completion_contract_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "native_run_results" ADD CONSTRAINT "native_run_results_completion_contract_owner_fk" FOREIGN KEY ("issue_id","completion_contract_id") REFERENCES "public"."completion_contracts"("issue_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "status_decision_effects" ADD CONSTRAINT "status_decision_effects_issue_company_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "status_decision_effects" ADD CONSTRAINT "status_decision_effects_decision_owner_fk" FOREIGN KEY ("issue_id","decision_id") REFERENCES "public"."status_decisions"("issue_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "status_decisions" ADD CONSTRAINT "status_decisions_issue_company_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "status_decisions" ADD CONSTRAINT "status_decisions_assessment_owner_fk" FOREIGN KEY ("issue_id","run_id","assessment_id") REFERENCES "public"."work_assessments"("issue_id","run_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "status_decisions" ADD CONSTRAINT "status_decisions_supersedes_owner_fk" FOREIGN KEY ("issue_id","supersedes_decision_id") REFERENCES "public"."status_decisions"("issue_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tool_connection_app_snapshots" ADD CONSTRAINT "tool_connection_app_snapshots_company_connection_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."tool_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tool_connection_app_syncs" ADD CONSTRAINT "tool_connection_app_syncs_company_connection_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."tool_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "work_assessments" ADD CONSTRAINT "work_assessments_issue_company_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "work_assessments" ADD CONSTRAINT "work_assessments_run_owner_fk" FOREIGN KEY ("issue_id","run_id") REFERENCES "public"."heartbeat_runs"("native_issue_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "work_assessments" ADD CONSTRAINT "work_assessments_contract_owner_fk" FOREIGN KEY ("issue_id","contract_id") REFERENCES "public"."completion_contracts"("issue_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "work_assessments" ADD CONSTRAINT "work_assessments_result_owner_fk" FOREIGN KEY ("issue_id","run_id","result_id") REFERENCES "public"."native_run_results"("issue_id","run_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "work_assessments" ADD CONSTRAINT "work_assessments_supersedes_owner_fk" FOREIGN KEY ("issue_id","run_id","supersedes_assessment_id") REFERENCES "public"."work_assessments"("issue_id","run_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_ai_provider_default() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ai_provider_defaults (user_id, provider, grant_id, updated_at)
    VALUES (NEW.user_id, NEW.provider, NEW.grant_id, NEW.updated_at)
    ON CONFLICT (user_id, provider) DO NOTHING;
  ELSE
    INSERT INTO ai_provider_defaults (user_id, provider, grant_id, updated_at)
    VALUES (NEW.user_id, NEW.provider, NEW.grant_id, NEW.updated_at)
    ON CONFLICT (user_id, provider) DO UPDATE
    SET grant_id = EXCLUDED.grant_id, updated_at = EXCLUDED.updated_at;
  END IF;
  RETURN NEW;
END $$;
