-- Runs on the STAGING database right after restoring a production dump.
-- Keeps only one company (psql var :company, e.g. -v company='Apartment List'),
-- strips every external integration so staging cannot mutate GitHub, Slack,
-- Jira or any MCP/tool target, and pauses all automation.
--
-- FK triggers are disabled for the session so rows can be removed in any
-- order; the dump has no cross-company references worth preserving.

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL session_replication_role = replica;

CREATE TEMP TABLE keep_company AS
  SELECT id FROM companies WHERE name = :'company';

DO $$
BEGIN
  IF (SELECT count(*) FROM keep_company) <> 1 THEN
    RAISE EXCEPTION 'expected exactly one company with that name, found %',
      (SELECT count(*) FROM keep_company);
  END IF;
END $$;

-- 1. Drop every other company's rows from each table with a company_id column.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND c.column_name = 'company_id'
      AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM keep_company)',
      t.table_name);
  END LOOP;
END $$;
DELETE FROM companies WHERE id NOT IN (SELECT id FROM keep_company);

-- 2. Integrations (DELETE, not TRUNCATE CASCADE: cascade would wipe
--    routine_triggers and skill sources too): chat connectors (Slack, GitHub, Teams, Discord...), tool
--    connections and MCP gateways, connection grants, plugins, OAuth state.
--    Secrets are encrypted with production's master key and unreadable here
--    anyway; dropping them avoids half-working configs.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND (
         table_name LIKE 'chat\_%'
      OR table_name LIKE 'tool\_%'
      OR table_name LIKE 'connection\_%'
      OR table_name LIKE 'mcp\_%'
      OR table_name LIKE 'plugin%'
      OR table_name LIKE 'company\_secret%'
      OR table_name LIKE 'user\_secret%'
      OR table_name IN ('secret_access_events', 'external_objects',
                        'external_object_mentions', 'public_mcp_tokens',
                        'routine_webhook_test_receipts')
    )
  LOOP
    EXECUTE format('DELETE FROM public.%I', t.table_name);
  END LOOP;
END $$;

-- Rows outside those families that point into them. FK triggers are off,
-- so do by hand what the constraints would: null optional links, drop rows
-- that make no sense without the integration.
UPDATE routine_triggers      SET secret_id = NULL;
UPDATE company_skill_sources SET connection_id = NULL;
DELETE FROM managed_agent_profiles;   -- API key lives in a dropped secret
DELETE FROM ai_connection_pools;      -- id = dropped tool connection
DELETE FROM ai_connection_defaults;
DELETE FROM ai_provider_defaults;
DELETE FROM browser_use_sessions;
DELETE FROM browser_use_settings;
DELETE FROM email_messages;
DELETE FROM email_sends;
DELETE FROM email_endpoints;

-- 3. No automation until someone turns it on in staging on purpose.
UPDATE agents   SET status = 'paused', paused_at = now() WHERE status <> 'terminated';
UPDATE routines SET status = 'paused' WHERE status = 'active';
UPDATE routine_triggers SET enabled = false;

-- 4. Production web sessions and API keys stay in production. Users and
--    password hashes are kept so the same logins work on staging.
DELETE FROM session;
DELETE FROM agent_api_keys;

COMMIT;

SELECT (SELECT name FROM companies) AS company,
       (SELECT count(*) FROM agents) AS agents,
       (SELECT count(*) FROM issues) AS issues;
