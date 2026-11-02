UPDATE "company_skills"
SET "key" = regexp_replace("key", '^company/[0-9a-fA-F-]{36}/', 'company/')
WHERE "key" ~ '^company/[0-9a-fA-F-]{36}/';
--> statement-breakpoint
UPDATE "agents"
SET "adapter_config" = regexp_replace("adapter_config"::text, '"company/[0-9a-fA-F-]{36}/', '"company/', 'g')::jsonb
WHERE "adapter_config"::text ~ '"company/[0-9a-fA-F-]{36}/';
