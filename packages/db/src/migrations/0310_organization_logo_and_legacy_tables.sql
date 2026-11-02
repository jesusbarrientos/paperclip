ALTER TABLE "companies" ADD COLUMN "logo_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_asset_id_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "companies" AS c
SET "logo_asset_id" = l."asset_id"
FROM "company_logos" AS l
WHERE l."company_id" = c."id";--> statement-breakpoint
ALTER TABLE "company_logos" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "company_logos" CASCADE;--> statement-breakpoint
ALTER TABLE "company_onboarding_seeds" DROP CONSTRAINT "company_onboarding_seeds_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "company_transfer_runs" DROP CONSTRAINT "company_transfer_runs_company_id_companies_id_fk";
--> statement-breakpoint
DROP INDEX "company_onboarding_seeds_company_uq";--> statement-breakpoint
DROP INDEX "company_transfer_runs_company_idx";--> statement-breakpoint
ALTER TABLE "company_onboarding_seeds" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "company_transfer_runs" DROP COLUMN "company_id";
