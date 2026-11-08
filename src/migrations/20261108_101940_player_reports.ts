import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_report_cycles_status" AS ENUM('open', 'closed');
  CREATE TYPE "public"."enum_player_reports_strands_strand" AS ENUM('ATT', 'DEF', 'PHY', 'PAS', 'TAC', 'CHA');
  CREATE TYPE "public"."enum_player_reports_strands_rating" AS ENUM('well_below', 'below', 'at', 'above', 'well_above');
  CREATE TYPE "public"."enum_player_reports_status" AS ENUM('not_started', 'draft', 'submitted', 'returned', 'approved', 'released');
  CREATE TYPE "public"."enum_player_reports_level" AS ENUM('F', '8', '9', '10', '11', '12', '13');
  CREATE TYPE "public"."enum_player_reports_source" AS ENUM('term', 'team');
  CREATE TYPE "public"."enum_report_reminder_log_kind" AS ENUM('14d', '7d', '3d', '1d');
  CREATE TABLE "report_cycles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"season" numeric NOT NULL,
  	"due_date" timestamp(3) with time zone NOT NULL,
  	"status" "enum_report_cycles_status" DEFAULT 'open' NOT NULL,
  	"reports_created_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "report_cycles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"programs_id" integer,
  	"teams_id" integer
  );
  
  CREATE TABLE "player_reports_strands" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"strand" "enum_player_reports_strands_strand" NOT NULL,
  	"rating" "enum_player_reports_strands_rating",
  	"comment" varchar
  );
  
  CREATE TABLE "player_reports_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"action" varchar,
  	"by_id" integer,
  	"at" timestamp(3) with time zone,
  	"note" varchar
  );
  
  CREATE TABLE "player_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cycle_id" integer NOT NULL,
  	"status" "enum_player_reports_status" DEFAULT 'not_started' NOT NULL,
  	"key" varchar NOT NULL,
  	"player_name" varchar NOT NULL,
  	"birth_year" numeric,
  	"level" "enum_player_reports_level" NOT NULL,
  	"coach_id" integer,
  	"source" "enum_player_reports_source",
  	"source_label" varchar,
  	"participant_id" integer,
  	"account_id" integer,
  	"registration_id" integer,
  	"team_id" integer,
  	"overall" varchar,
  	"return_note" varchar,
  	"saved_at" timestamp(3) with time zone,
  	"submitted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "report_reminder_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cycle_id" integer NOT NULL,
  	"coach_id" integer NOT NULL,
  	"kind" "enum_report_reminder_log_kind" NOT NULL,
  	"outstanding" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "report_cycles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "player_reports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "report_reminder_log_id" integer;
  ALTER TABLE "report_cycles_rels" ADD CONSTRAINT "report_cycles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."report_cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "report_cycles_rels" ADD CONSTRAINT "report_cycles_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "report_cycles_rels" ADD CONSTRAINT "report_cycles_rels_teams_fk" FOREIGN KEY ("teams_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "player_reports_strands" ADD CONSTRAINT "player_reports_strands_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."player_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "player_reports_history" ADD CONSTRAINT "player_reports_history_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "player_reports_history" ADD CONSTRAINT "player_reports_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."player_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_cycle_id_report_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."report_cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_registration_id_academy_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."academy_registrations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "report_reminder_log" ADD CONSTRAINT "report_reminder_log_cycle_id_report_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."report_cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "report_reminder_log" ADD CONSTRAINT "report_reminder_log_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "report_cycles_updated_at_idx" ON "report_cycles" USING btree ("updated_at");
  CREATE INDEX "report_cycles_created_at_idx" ON "report_cycles" USING btree ("created_at");
  CREATE INDEX "report_cycles_rels_order_idx" ON "report_cycles_rels" USING btree ("order");
  CREATE INDEX "report_cycles_rels_parent_idx" ON "report_cycles_rels" USING btree ("parent_id");
  CREATE INDEX "report_cycles_rels_path_idx" ON "report_cycles_rels" USING btree ("path");
  CREATE INDEX "report_cycles_rels_programs_id_idx" ON "report_cycles_rels" USING btree ("programs_id");
  CREATE INDEX "report_cycles_rels_teams_id_idx" ON "report_cycles_rels" USING btree ("teams_id");
  CREATE INDEX "player_reports_strands_order_idx" ON "player_reports_strands" USING btree ("_order");
  CREATE INDEX "player_reports_strands_parent_id_idx" ON "player_reports_strands" USING btree ("_parent_id");
  CREATE INDEX "player_reports_history_order_idx" ON "player_reports_history" USING btree ("_order");
  CREATE INDEX "player_reports_history_parent_id_idx" ON "player_reports_history" USING btree ("_parent_id");
  CREATE INDEX "player_reports_history_by_idx" ON "player_reports_history" USING btree ("by_id");
  CREATE INDEX "player_reports_cycle_idx" ON "player_reports" USING btree ("cycle_id");
  CREATE INDEX "player_reports_status_idx" ON "player_reports" USING btree ("status");
  CREATE INDEX "player_reports_coach_idx" ON "player_reports" USING btree ("coach_id");
  CREATE INDEX "player_reports_participant_idx" ON "player_reports" USING btree ("participant_id");
  CREATE INDEX "player_reports_account_idx" ON "player_reports" USING btree ("account_id");
  CREATE INDEX "player_reports_registration_idx" ON "player_reports" USING btree ("registration_id");
  CREATE INDEX "player_reports_team_idx" ON "player_reports" USING btree ("team_id");
  CREATE INDEX "player_reports_updated_at_idx" ON "player_reports" USING btree ("updated_at");
  CREATE INDEX "player_reports_created_at_idx" ON "player_reports" USING btree ("created_at");
  CREATE UNIQUE INDEX "cycle_key_idx" ON "player_reports" USING btree ("cycle_id","key");
  CREATE INDEX "report_reminder_log_cycle_idx" ON "report_reminder_log" USING btree ("cycle_id");
  CREATE INDEX "report_reminder_log_coach_idx" ON "report_reminder_log" USING btree ("coach_id");
  CREATE INDEX "report_reminder_log_updated_at_idx" ON "report_reminder_log" USING btree ("updated_at");
  CREATE INDEX "report_reminder_log_created_at_idx" ON "report_reminder_log" USING btree ("created_at");
  CREATE UNIQUE INDEX "cycle_coach_kind_idx" ON "report_reminder_log" USING btree ("cycle_id","coach_id","kind");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_report_cycles_fk" FOREIGN KEY ("report_cycles_id") REFERENCES "public"."report_cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_player_reports_fk" FOREIGN KEY ("player_reports_id") REFERENCES "public"."player_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_report_reminder_log_fk" FOREIGN KEY ("report_reminder_log_id") REFERENCES "public"."report_reminder_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_report_cycles_id_idx" ON "payload_locked_documents_rels" USING btree ("report_cycles_id");
  CREATE INDEX "payload_locked_documents_rels_player_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("player_reports_id");
  CREATE INDEX "payload_locked_documents_rels_report_reminder_log_id_idx" ON "payload_locked_documents_rels" USING btree ("report_reminder_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "report_cycles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "report_cycles_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "player_reports_strands" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "player_reports_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "player_reports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "report_reminder_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "report_cycles" CASCADE;
  DROP TABLE "report_cycles_rels" CASCADE;
  DROP TABLE "player_reports_strands" CASCADE;
  DROP TABLE "player_reports_history" CASCADE;
  DROP TABLE "player_reports" CASCADE;
  DROP TABLE "report_reminder_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_report_cycles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_player_reports_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_report_reminder_log_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_report_cycles_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_player_reports_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_report_reminder_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "report_cycles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "player_reports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "report_reminder_log_id";
  DROP TYPE "public"."enum_report_cycles_status";
  DROP TYPE "public"."enum_player_reports_strands_strand";
  DROP TYPE "public"."enum_player_reports_strands_rating";
  DROP TYPE "public"."enum_player_reports_status";
  DROP TYPE "public"."enum_player_reports_level";
  DROP TYPE "public"."enum_player_reports_source";
  DROP TYPE "public"."enum_report_reminder_log_kind";`)
}
