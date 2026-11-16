import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_match_reflections_moments_type" AS ENUM('great', 'improve');
  CREATE TYPE "public"."enum_match_reflections_status" AS ENUM('draft', 'submitted');
  CREATE TYPE "public"."enum_match_reflections_source" AS ENUM('family', 'link');
  CREATE TYPE "public"."enum_welfare_flags_source" AS ENUM('keyword', 'ai');
  CREATE TYPE "public"."enum_welfare_flags_severity" AS ENUM('low', 'medium', 'high');
  CREATE TYPE "public"."enum_welfare_flags_status" AS ENUM('open', 'reviewed');
  CREATE TYPE "public"."enum_reflection_reports_scope_type" AS ENUM('team', 'age_group', 'club');
  CREATE TYPE "public"."enum_reflection_reports_status" AS ENUM('ok', 'failed', 'stats_only', 'empty');
  CREATE TYPE "public"."enum_reflection_reminders_kind" AS ENUM('open', 'closing');
  CREATE TYPE "public"."enum_reflection_settings_report_day" AS ENUM('0', '1', '2', '3', '4', '5', '6');
  CREATE TABLE "reflection_pillars" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"hint" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "match_reflections_moments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_match_reflections_moments_type" NOT NULL,
  	"position" numeric,
  	"pillar_id" integer,
  	"pillar_name" varchar,
  	"comment" varchar
  );
  
  CREATE TABLE "match_reflections_feedback" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"coach_id" integer,
  	"seen_at" timestamp(3) with time zone,
  	"comment" varchar
  );
  
  CREATE TABLE "match_reflections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"participant_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"team_id" integer NOT NULL,
  	"fixture_id" varchar NOT NULL,
  	"fixture_at" timestamp(3) with time zone NOT NULL,
  	"opponent" varchar,
  	"age_group" varchar,
  	"feeling" numeric,
  	"status" "enum_match_reflections_status" DEFAULT 'draft' NOT NULL,
  	"submitted_at" timestamp(3) with time zone,
  	"source" "enum_match_reflections_source",
  	"focus" varchar,
  	"welfare_checked_at" timestamp(3) with time zone,
  	"welfare_checked_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "welfare_flags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reflection_id" integer NOT NULL,
  	"participant_id" integer,
  	"team_id" integer,
  	"excerpt" varchar,
  	"reason" varchar,
  	"source" "enum_welfare_flags_source" NOT NULL,
  	"severity" "enum_welfare_flags_severity",
  	"status" "enum_welfare_flags_status" DEFAULT 'open' NOT NULL,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"notified_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reflection_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"scope_type" "enum_reflection_reports_scope_type" NOT NULL,
  	"scope_key" varchar NOT NULL,
  	"scope_label" varchar,
  	"period_from" varchar NOT NULL,
  	"period_to" varchar NOT NULL,
  	"stats" jsonb,
  	"summary" jsonb,
  	"status" "enum_reflection_reports_status" NOT NULL,
  	"model" varchar,
  	"prompt_version" varchar,
  	"generated_at" timestamp(3) with time zone,
  	"error" varchar,
  	"notified_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reflection_reminders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"participant_id" integer NOT NULL,
  	"fixture_id" varchar NOT NULL,
  	"kind" "enum_reflection_reminders_kind" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reflection_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"opens_after_hours" numeric DEFAULT 3,
  	"closes_after_days" numeric DEFAULT 4,
  	"remind_on_open" boolean DEFAULT true,
  	"closing_reminder_hours" numeric DEFAULT 24,
  	"show_streak" boolean DEFAULT true,
  	"ai_reports" boolean DEFAULT true,
  	"report_day" "enum_reflection_settings_report_day" DEFAULT '1',
  	"report_hour" numeric DEFAULT 9,
  	"ai_welfare_check" boolean DEFAULT true,
  	"safeguarding_email" varchar,
  	"keywords" varchar DEFAULT 'hurt me
  hits me
  hit me
  kicked me
  punched me
  abuse
  abused
  touched me
  unsafe
  scared
  afraid
  bullied
  bully
  bullying
  hate myself
  kill myself
  want to die
  suicide
  self harm
  self-harm
  cut myself
  hurt myself
  nobody likes me
  no one likes me
  starving
  not eating
  threatened
  secret
  yelled at me
  screamed at me',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "reflection_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"teams_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reflection_pillars_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "match_reflections_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "welfare_flags_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reflection_reports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reflection_reminders_id" integer;
  ALTER TABLE "match_reflections_moments" ADD CONSTRAINT "match_reflections_moments_pillar_id_reflection_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."reflection_pillars"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "match_reflections_moments" ADD CONSTRAINT "match_reflections_moments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."match_reflections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "match_reflections_feedback" ADD CONSTRAINT "match_reflections_feedback_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "match_reflections_feedback" ADD CONSTRAINT "match_reflections_feedback_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."match_reflections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "match_reflections" ADD CONSTRAINT "match_reflections_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "match_reflections" ADD CONSTRAINT "match_reflections_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "match_reflections" ADD CONSTRAINT "match_reflections_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "welfare_flags" ADD CONSTRAINT "welfare_flags_reflection_id_match_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."match_reflections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "welfare_flags" ADD CONSTRAINT "welfare_flags_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "welfare_flags" ADD CONSTRAINT "welfare_flags_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "welfare_flags" ADD CONSTRAINT "welfare_flags_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reflection_reminders" ADD CONSTRAINT "reflection_reminders_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reflection_settings_rels" ADD CONSTRAINT "reflection_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reflection_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reflection_settings_rels" ADD CONSTRAINT "reflection_settings_rels_teams_fk" FOREIGN KEY ("teams_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "reflection_pillars_updated_at_idx" ON "reflection_pillars" USING btree ("updated_at");
  CREATE INDEX "reflection_pillars_created_at_idx" ON "reflection_pillars" USING btree ("created_at");
  CREATE INDEX "match_reflections_moments_order_idx" ON "match_reflections_moments" USING btree ("_order");
  CREATE INDEX "match_reflections_moments_parent_id_idx" ON "match_reflections_moments" USING btree ("_parent_id");
  CREATE INDEX "match_reflections_moments_pillar_idx" ON "match_reflections_moments" USING btree ("pillar_id");
  CREATE INDEX "match_reflections_feedback_order_idx" ON "match_reflections_feedback" USING btree ("_order");
  CREATE INDEX "match_reflections_feedback_parent_id_idx" ON "match_reflections_feedback" USING btree ("_parent_id");
  CREATE INDEX "match_reflections_feedback_coach_idx" ON "match_reflections_feedback" USING btree ("coach_id");
  CREATE INDEX "match_reflections_participant_idx" ON "match_reflections" USING btree ("participant_id");
  CREATE INDEX "match_reflections_account_idx" ON "match_reflections" USING btree ("account_id");
  CREATE INDEX "match_reflections_team_idx" ON "match_reflections" USING btree ("team_id");
  CREATE INDEX "match_reflections_fixture_id_idx" ON "match_reflections" USING btree ("fixture_id");
  CREATE INDEX "match_reflections_fixture_at_idx" ON "match_reflections" USING btree ("fixture_at");
  CREATE INDEX "match_reflections_age_group_idx" ON "match_reflections" USING btree ("age_group");
  CREATE INDEX "match_reflections_status_idx" ON "match_reflections" USING btree ("status");
  CREATE INDEX "match_reflections_submitted_at_idx" ON "match_reflections" USING btree ("submitted_at");
  CREATE INDEX "match_reflections_welfare_checked_at_idx" ON "match_reflections" USING btree ("welfare_checked_at");
  CREATE INDEX "match_reflections_updated_at_idx" ON "match_reflections" USING btree ("updated_at");
  CREATE INDEX "match_reflections_created_at_idx" ON "match_reflections" USING btree ("created_at");
  CREATE UNIQUE INDEX "participant_fixtureId_idx" ON "match_reflections" USING btree ("participant_id","fixture_id");
  CREATE INDEX "welfare_flags_reflection_idx" ON "welfare_flags" USING btree ("reflection_id");
  CREATE INDEX "welfare_flags_participant_idx" ON "welfare_flags" USING btree ("participant_id");
  CREATE INDEX "welfare_flags_team_idx" ON "welfare_flags" USING btree ("team_id");
  CREATE INDEX "welfare_flags_status_idx" ON "welfare_flags" USING btree ("status");
  CREATE INDEX "welfare_flags_reviewed_by_idx" ON "welfare_flags" USING btree ("reviewed_by_id");
  CREATE INDEX "welfare_flags_updated_at_idx" ON "welfare_flags" USING btree ("updated_at");
  CREATE INDEX "welfare_flags_created_at_idx" ON "welfare_flags" USING btree ("created_at");
  CREATE INDEX "reflection_reports_scope_type_idx" ON "reflection_reports" USING btree ("scope_type");
  CREATE INDEX "reflection_reports_scope_key_idx" ON "reflection_reports" USING btree ("scope_key");
  CREATE INDEX "reflection_reports_period_from_idx" ON "reflection_reports" USING btree ("period_from");
  CREATE INDEX "reflection_reports_updated_at_idx" ON "reflection_reports" USING btree ("updated_at");
  CREATE INDEX "reflection_reports_created_at_idx" ON "reflection_reports" USING btree ("created_at");
  CREATE UNIQUE INDEX "scopeType_scopeKey_periodFrom_idx" ON "reflection_reports" USING btree ("scope_type","scope_key","period_from");
  CREATE INDEX "reflection_reminders_participant_idx" ON "reflection_reminders" USING btree ("participant_id");
  CREATE INDEX "reflection_reminders_fixture_id_idx" ON "reflection_reminders" USING btree ("fixture_id");
  CREATE INDEX "reflection_reminders_updated_at_idx" ON "reflection_reminders" USING btree ("updated_at");
  CREATE INDEX "reflection_reminders_created_at_idx" ON "reflection_reminders" USING btree ("created_at");
  CREATE UNIQUE INDEX "participant_fixtureId_kind_idx" ON "reflection_reminders" USING btree ("participant_id","fixture_id","kind");
  CREATE INDEX "reflection_settings_rels_order_idx" ON "reflection_settings_rels" USING btree ("order");
  CREATE INDEX "reflection_settings_rels_parent_idx" ON "reflection_settings_rels" USING btree ("parent_id");
  CREATE INDEX "reflection_settings_rels_path_idx" ON "reflection_settings_rels" USING btree ("path");
  CREATE INDEX "reflection_settings_rels_teams_id_idx" ON "reflection_settings_rels" USING btree ("teams_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reflection_pillars_fk" FOREIGN KEY ("reflection_pillars_id") REFERENCES "public"."reflection_pillars"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_match_reflections_fk" FOREIGN KEY ("match_reflections_id") REFERENCES "public"."match_reflections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_welfare_flags_fk" FOREIGN KEY ("welfare_flags_id") REFERENCES "public"."welfare_flags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reflection_reports_fk" FOREIGN KEY ("reflection_reports_id") REFERENCES "public"."reflection_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reflection_reminders_fk" FOREIGN KEY ("reflection_reminders_id") REFERENCES "public"."reflection_reminders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_reflection_pillars_id_idx" ON "payload_locked_documents_rels" USING btree ("reflection_pillars_id");
  CREATE INDEX "payload_locked_documents_rels_match_reflections_id_idx" ON "payload_locked_documents_rels" USING btree ("match_reflections_id");
  CREATE INDEX "payload_locked_documents_rels_welfare_flags_id_idx" ON "payload_locked_documents_rels" USING btree ("welfare_flags_id");
  CREATE INDEX "payload_locked_documents_rels_reflection_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("reflection_reports_id");
  CREATE INDEX "payload_locked_documents_rels_reflection_reminders_id_idx" ON "payload_locked_documents_rels" USING btree ("reflection_reminders_id");`)
  // The six PDR areas as the starting reflection pillars (Management can rename / add / switch off)
  await db.execute(sql`
  INSERT INTO "reflection_pillars" ("name", "active", "sort_order", "hint", "updated_at", "created_at") VALUES
    ('Physical', true, 1, 'speed, strength, effort, getting back', now(), now()),
    ('Passing', true, 2, 'short and long passing, weight of pass, switching play', now(), now()),
    ('Dribbling', true, 3, 'beating a player, running with the ball, 1v1s', now(), now()),
    ('Control', true, 4, 'first touch, receiving, shielding', now(), now()),
    ('Skills', true, 5, 'turns, feints, shooting, heading', now(), now()),
    ('Ball Mastery', true, 6, 'close control, both feet, comfort on the ball', now(), now())
  ON CONFLICT DO NOTHING;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reflection_pillars" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "match_reflections_moments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "match_reflections_feedback" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "match_reflections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "welfare_flags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reflection_reports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reflection_reminders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reflection_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reflection_settings_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "reflection_pillars" CASCADE;
  DROP TABLE IF EXISTS "match_reflections_moments" CASCADE;
  DROP TABLE IF EXISTS "match_reflections_feedback" CASCADE;
  DROP TABLE IF EXISTS "match_reflections" CASCADE;
  DROP TABLE IF EXISTS "welfare_flags" CASCADE;
  DROP TABLE IF EXISTS "reflection_reports" CASCADE;
  DROP TABLE IF EXISTS "reflection_reminders" CASCADE;
  DROP TABLE IF EXISTS "reflection_settings" CASCADE;
  DROP TABLE IF EXISTS "reflection_settings_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reflection_pillars_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_match_reflections_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_welfare_flags_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reflection_reports_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reflection_reminders_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_reflection_pillars_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_match_reflections_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_welfare_flags_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_reflection_reports_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_reflection_reminders_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reflection_pillars_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "match_reflections_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "welfare_flags_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reflection_reports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reflection_reminders_id";
  DROP TYPE "public"."enum_match_reflections_moments_type";
  DROP TYPE "public"."enum_match_reflections_status";
  DROP TYPE "public"."enum_match_reflections_source";
  DROP TYPE "public"."enum_welfare_flags_source";
  DROP TYPE "public"."enum_welfare_flags_severity";
  DROP TYPE "public"."enum_welfare_flags_status";
  DROP TYPE "public"."enum_reflection_reports_scope_type";
  DROP TYPE "public"."enum_reflection_reports_status";
  DROP TYPE "public"."enum_reflection_reminders_kind";
  DROP TYPE "public"."enum_reflection_settings_report_day";`)
}
