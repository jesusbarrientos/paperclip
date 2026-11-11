CREATE TABLE "machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text,
	"shared" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"platform" text,
	"arch" text,
	"hostname" text,
	"daemon_version" text,
	"capabilities" jsonb,
	"workspace_root" text,
	"environment_id" uuid,
	"pairing_token_hash" text,
	"pairing_expires_at" timestamp with time zone,
	"credential_hash" text,
	"credential_issued_at" timestamp with time zone,
	"authorized_at" timestamp with time zone,
	"authorized_by_user_id" text,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"machine_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"fencing_token" integer DEFAULT 1 NOT NULL,
	"edit_locked" boolean DEFAULT false NOT NULL,
	"lock_run_id" uuid,
	"sync_state" text DEFAULT 'up_to_date' NOT NULL,
	"sync_error" text,
	"last_snapshot_seq" integer DEFAULT 0 NOT NULL,
	"remote_path" text,
	"client_session_id" text,
	"client_session_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "execution_machine_id" uuid;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_contexts" ADD CONSTRAINT "work_contexts_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_contexts" ADD CONSTRAINT "work_contexts_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "machines_owner_idx" ON "machines" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "machines_credential_hash_uq" ON "machines" USING btree ("credential_hash") WHERE "machines"."credential_hash" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "machines_environment_uq" ON "machines" USING btree ("environment_id") WHERE "machines"."environment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_contexts_active_issue_uq" ON "work_contexts" USING btree ("issue_id") WHERE "work_contexts"."active";--> statement-breakpoint
CREATE INDEX "work_contexts_issue_idx" ON "work_contexts" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "work_contexts_machine_idx" ON "work_contexts" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "work_contexts_client_session_idx" ON "work_contexts" USING btree ("client_session_id");