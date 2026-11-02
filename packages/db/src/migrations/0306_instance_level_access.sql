DO $$
BEGIN
  IF (SELECT count(*) FROM "companies") > 1 THEN
    RAISE EXCEPTION 'Paperclip now supports exactly one organization per instance, but this database holds % companies. Remove the extra companies before migrating.', (SELECT count(*) FROM "companies");
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "agent_api_keys" DROP CONSTRAINT "agent_api_keys_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "company_memberships" DROP CONSTRAINT "company_memberships_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "invites" DROP CONSTRAINT "invites_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "join_requests" DROP CONSTRAINT "join_requests_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "principal_permission_grants" DROP CONSTRAINT "principal_permission_grants_company_id_companies_id_fk";
--> statement-breakpoint
DROP INDEX "agent_api_keys_company_agent_idx";--> statement-breakpoint
DROP INDEX "company_memberships_company_principal_unique_idx";--> statement-breakpoint
DROP INDEX "company_memberships_company_status_idx";--> statement-breakpoint
DROP INDEX "invites_company_invite_state_idx";--> statement-breakpoint
DROP INDEX "join_requests_company_status_type_created_idx";--> statement-breakpoint
DROP INDEX "principal_permission_grants_company_permission_idx";--> statement-breakpoint
DROP INDEX "join_requests_pending_human_user_uq";--> statement-breakpoint
DROP INDEX "join_requests_pending_human_email_uq";--> statement-breakpoint
DROP INDEX "principal_permission_grants_unique_idx";--> statement-breakpoint
CREATE INDEX "agent_api_keys_agent_idx" ON "agent_api_keys" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_memberships_principal_unique_idx" ON "company_memberships" USING btree ("principal_type","principal_id");--> statement-breakpoint
CREATE INDEX "invites_invite_state_idx" ON "invites" USING btree ("invite_type","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "join_requests_status_type_created_idx" ON "join_requests" USING btree ("status","request_type","created_at");--> statement-breakpoint
CREATE INDEX "principal_permission_grants_permission_idx" ON "principal_permission_grants" USING btree ("permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_pending_human_user_uq" ON "join_requests" USING btree ("requesting_user_id") WHERE "join_requests"."request_type" = 'human' AND "join_requests"."status" = 'pending_approval' AND "join_requests"."requesting_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_pending_human_email_uq" ON "join_requests" USING btree (lower("request_email_snapshot")) WHERE "join_requests"."request_type" = 'human' AND "join_requests"."status" = 'pending_approval' AND "join_requests"."request_email_snapshot" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "principal_permission_grants_unique_idx" ON "principal_permission_grants" USING btree ("principal_type","principal_id","permission_key");--> statement-breakpoint
ALTER TABLE "agent_api_keys" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "company_memberships" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "invites" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "join_requests" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "principal_permission_grants" DROP COLUMN "company_id";