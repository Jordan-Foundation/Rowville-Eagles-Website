import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pdr_submissions_type" AS ENUM('verification', 'feedback');
  CREATE TYPE "public"."enum_pdr_submissions_status" AS ENUM('uploading', 'pending', 'verified', 'rejected', 'feedback_given');
  CREATE TYPE "public"."enum_pdr_audit_action" AS ENUM('verify', 'reject', 'feedback', 'score_change', 'promote', 'revoke');
  CREATE TABLE "pdr_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"player_id" integer NOT NULL,
  	"stage_id" integer NOT NULL,
  	"area_id" integer,
  	"level_number" numeric,
  	"type" "enum_pdr_submissions_type" DEFAULT 'verification' NOT NULL,
  	"status" "enum_pdr_submissions_status" DEFAULT 'uploading' NOT NULL,
  	"claimed_score" numeric,
  	"verified_score" numeric,
  	"passed" boolean,
  	"player_note" varchar,
  	"feedback" varchar,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"submitted_by_id" integer,
  	"stream_uid" varchar,
  	"delete_video_after" timestamp(3) with time zone,
  	"video_deleted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pdr_audit" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar,
  	"action" "enum_pdr_audit_action" NOT NULL,
  	"actor_id" integer,
  	"player_id" integer,
  	"stage_id" integer,
  	"submission_id" integer,
  	"before" varchar,
  	"after" varchar,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "pdr_progress" ADD COLUMN "promoted_score" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_submissions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_audit_id" integer;
  ALTER TABLE "pdr_submissions" ADD CONSTRAINT "pdr_submissions_player_id_participants_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_submissions" ADD CONSTRAINT "pdr_submissions_stage_id_pdr_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pdr_stages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_submissions" ADD CONSTRAINT "pdr_submissions_area_id_pdr_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."pdr_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_submissions" ADD CONSTRAINT "pdr_submissions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_submissions" ADD CONSTRAINT "pdr_submissions_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_audit" ADD CONSTRAINT "pdr_audit_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_audit" ADD CONSTRAINT "pdr_audit_player_id_participants_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_audit" ADD CONSTRAINT "pdr_audit_stage_id_pdr_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pdr_stages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_audit" ADD CONSTRAINT "pdr_audit_submission_id_pdr_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."pdr_submissions"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pdr_submissions_player_idx" ON "pdr_submissions" USING btree ("player_id");
  CREATE INDEX "pdr_submissions_stage_idx" ON "pdr_submissions" USING btree ("stage_id");
  CREATE INDEX "pdr_submissions_area_idx" ON "pdr_submissions" USING btree ("area_id");
  CREATE INDEX "pdr_submissions_level_number_idx" ON "pdr_submissions" USING btree ("level_number");
  CREATE INDEX "pdr_submissions_type_idx" ON "pdr_submissions" USING btree ("type");
  CREATE INDEX "pdr_submissions_status_idx" ON "pdr_submissions" USING btree ("status");
  CREATE INDEX "pdr_submissions_reviewed_by_idx" ON "pdr_submissions" USING btree ("reviewed_by_id");
  CREATE INDEX "pdr_submissions_submitted_by_idx" ON "pdr_submissions" USING btree ("submitted_by_id");
  CREATE INDEX "pdr_submissions_stream_uid_idx" ON "pdr_submissions" USING btree ("stream_uid");
  CREATE INDEX "pdr_submissions_delete_video_after_idx" ON "pdr_submissions" USING btree ("delete_video_after");
  CREATE INDEX "pdr_submissions_updated_at_idx" ON "pdr_submissions" USING btree ("updated_at");
  CREATE INDEX "pdr_submissions_created_at_idx" ON "pdr_submissions" USING btree ("created_at");
  CREATE INDEX "pdr_audit_action_idx" ON "pdr_audit" USING btree ("action");
  CREATE INDEX "pdr_audit_actor_idx" ON "pdr_audit" USING btree ("actor_id");
  CREATE INDEX "pdr_audit_player_idx" ON "pdr_audit" USING btree ("player_id");
  CREATE INDEX "pdr_audit_stage_idx" ON "pdr_audit" USING btree ("stage_id");
  CREATE INDEX "pdr_audit_submission_idx" ON "pdr_audit" USING btree ("submission_id");
  CREATE INDEX "pdr_audit_updated_at_idx" ON "pdr_audit" USING btree ("updated_at");
  CREATE INDEX "pdr_audit_created_at_idx" ON "pdr_audit" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_submissions_fk" FOREIGN KEY ("pdr_submissions_id") REFERENCES "public"."pdr_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_audit_fk" FOREIGN KEY ("pdr_audit_id") REFERENCES "public"."pdr_audit"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_pdr_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_pdr_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_audit_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pdr_submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pdr_audit" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pdr_submissions" CASCADE;
  DROP TABLE "pdr_audit" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_submissions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_audit_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_submissions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_audit_id_idx";
  ALTER TABLE "pdr_progress" DROP COLUMN "promoted_score";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_submissions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_audit_id";
  DROP TYPE "public"."enum_pdr_submissions_type";
  DROP TYPE "public"."enum_pdr_submissions_status";
  DROP TYPE "public"."enum_pdr_audit_action";`)
}
