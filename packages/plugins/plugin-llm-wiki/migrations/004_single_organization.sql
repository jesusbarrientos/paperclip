ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_instances DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_sources DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_pages DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_page_revisions DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_operations DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_query_sessions DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_resource_bindings DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_spaces DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.paperclip_distillation_cursors DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.paperclip_distillation_work_items DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.paperclip_distillation_runs DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.paperclip_source_snapshots DROP COLUMN IF EXISTS company_id;
ALTER TABLE plugin_llm_wiki_8f50da974f.paperclip_page_bindings DROP COLUMN IF EXISTS company_id;

ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_instances
  ADD CONSTRAINT wiki_instances_wiki_key UNIQUE (wiki_id);
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_resource_bindings
  ADD CONSTRAINT wiki_resource_bindings_wiki_resource_key UNIQUE (wiki_id, resource_kind, resource_key);
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_spaces
  ADD CONSTRAINT wiki_spaces_wiki_slug_key UNIQUE (wiki_id, slug);
ALTER TABLE plugin_llm_wiki_8f50da974f.wiki_pages
  ADD CONSTRAINT wiki_pages_wiki_space_path_key UNIQUE (wiki_id, space_id, path);
ALTER TABLE plugin_llm_wiki_8f50da974f.paperclip_distillation_cursors
  ADD CONSTRAINT distillation_cursors_wiki_space_scope_key UNIQUE (wiki_id, space_id, source_scope, scope_key, source_kind);
ALTER TABLE plugin_llm_wiki_8f50da974f.paperclip_distillation_work_items
  ADD CONSTRAINT distillation_work_items_wiki_space_idempotency_key UNIQUE (wiki_id, space_id, idempotency_key);
ALTER TABLE plugin_llm_wiki_8f50da974f.paperclip_page_bindings
  ADD CONSTRAINT page_bindings_wiki_space_page_path_key UNIQUE (wiki_id, space_id, page_path);

CREATE INDEX IF NOT EXISTS wiki_spaces_wiki_status_idx ON plugin_llm_wiki_8f50da974f.wiki_spaces (wiki_id, status);
CREATE INDEX IF NOT EXISTS wiki_sources_wiki_space_idx ON plugin_llm_wiki_8f50da974f.wiki_sources (wiki_id, space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wiki_operations_wiki_space_idx ON plugin_llm_wiki_8f50da974f.wiki_operations (wiki_id, space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wiki_query_sessions_wiki_space_idx ON plugin_llm_wiki_8f50da974f.wiki_query_sessions (wiki_id, space_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS distillation_runs_wiki_space_idx ON plugin_llm_wiki_8f50da974f.paperclip_distillation_runs (wiki_id, space_id, created_at DESC);
