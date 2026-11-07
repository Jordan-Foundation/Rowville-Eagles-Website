import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_selection_rounds_kind" AS ENUM('tournament', 'rowville');
  CREATE TYPE "public"."enum_selection_rounds_status" AS ENUM('open', 'selecting', 'closed');
  CREATE TYPE "public"."enum_selection_entries_flags" AS ENUM('outside-miniroos');
  CREATE TYPE "public"."enum_selection_entries_moves_direction" AS ENUM('up', 'down');
  CREATE TYPE "public"."enum_selection_entries_kind" AS ENUM('tournament', 'rowville');
  CREATE TYPE "public"."enum_selection_entries_status" AS ENUM('interested', 'trial-booked', 'attended', 'selected', 'offered', 'unsuccessful', 'registered', 'released', 'withdrawn', 'closed');
  CREATE TYPE "public"."enum_selection_entries_player_gender" AS ENUM('female', 'male', 'non-binary', 'prefer-not-to-say');
  CREATE TABLE "selection_rounds" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_selection_rounds_kind" NOT NULL,
  	"season" numeric NOT NULL,
  	"status" "enum_selection_rounds_status" DEFAULT 'open' NOT NULL,
  	"program_id" integer,
  	"fee" numeric,
  	"payment_deadline_days" numeric DEFAULT 7,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "selection_rounds_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  CREATE TABLE "selection_entries_flags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_selection_entries_flags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "selection_entries_moves" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"from" numeric NOT NULL,
  	"to" numeric NOT NULL,
  	"direction" "enum_selection_entries_moves_direction",
  	"steps" numeric,
  	"reason" varchar NOT NULL,
  	"by_id" integer,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "selection_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar,
  	"reference" varchar,
  	"round_id" integer NOT NULL,
  	"kind" "enum_selection_entries_kind",
  	"status" "enum_selection_entries_status" DEFAULT 'interested' NOT NULL,
  	"birth_year" numeric,
  	"playing_birth_year" numeric,
  	"season" numeric,
  	"trial_session_id" integer,
  	"offered_team_id" integer,
  	"registration_program_id" integer,
  	"offer_sent_at" timestamp(3) with time zone,
  	"contact_first_name" varchar NOT NULL,
  	"contact_last_name" varchar NOT NULL,
  	"contact_email" varchar NOT NULL,
  	"contact_phone" varchar NOT NULL,
  	"player_first_name" varchar NOT NULL,
  	"player_last_name" varchar NOT NULL,
  	"player_date_of_birth" timestamp(3) with time zone NOT NULL,
  	"player_gender" "enum_selection_entries_player_gender",
  	"player_previous_club" varchar,
  	"player_notes" varchar,
  	"account_id" integer,
  	"participant_id" integer,
  	"token" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "selection_entries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"trial_sessions_id" integer
  );
  
  ALTER TABLE "trial_registrations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trial_registrations_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "trial_registrations" CASCADE;
  DROP TABLE "trial_registrations_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_trial_registrations_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_trial_registrations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "selection_rounds_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "selection_entries_id" integer;
  ALTER TABLE "selection_rounds" ADD CONSTRAINT "selection_rounds_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_rounds_numbers" ADD CONSTRAINT "selection_rounds_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."selection_rounds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "selection_entries_flags" ADD CONSTRAINT "selection_entries_flags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."selection_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "selection_entries_moves" ADD CONSTRAINT "selection_entries_moves_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_entries_moves" ADD CONSTRAINT "selection_entries_moves_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."selection_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_round_id_selection_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."selection_rounds"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_trial_session_id_trial_sessions_id_fk" FOREIGN KEY ("trial_session_id") REFERENCES "public"."trial_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_offered_team_id_teams_id_fk" FOREIGN KEY ("offered_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_registration_program_id_programs_id_fk" FOREIGN KEY ("registration_program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_entries_rels" ADD CONSTRAINT "selection_entries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."selection_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "selection_entries_rels" ADD CONSTRAINT "selection_entries_rels_trial_sessions_fk" FOREIGN KEY ("trial_sessions_id") REFERENCES "public"."trial_sessions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "selection_rounds_program_idx" ON "selection_rounds" USING btree ("program_id");
  CREATE INDEX "selection_rounds_updated_at_idx" ON "selection_rounds" USING btree ("updated_at");
  CREATE INDEX "selection_rounds_created_at_idx" ON "selection_rounds" USING btree ("created_at");
  CREATE INDEX "selection_rounds_numbers_order_parent_idx" ON "selection_rounds_numbers" USING btree ("order","parent_id");
  CREATE INDEX "selection_entries_flags_order_idx" ON "selection_entries_flags" USING btree ("order");
  CREATE INDEX "selection_entries_flags_parent_idx" ON "selection_entries_flags" USING btree ("parent_id");
  CREATE INDEX "selection_entries_moves_order_idx" ON "selection_entries_moves" USING btree ("_order");
  CREATE INDEX "selection_entries_moves_parent_id_idx" ON "selection_entries_moves" USING btree ("_parent_id");
  CREATE INDEX "selection_entries_moves_by_idx" ON "selection_entries_moves" USING btree ("by_id");
  CREATE UNIQUE INDEX "selection_entries_reference_idx" ON "selection_entries" USING btree ("reference");
  CREATE INDEX "selection_entries_round_idx" ON "selection_entries" USING btree ("round_id");
  CREATE INDEX "selection_entries_status_idx" ON "selection_entries" USING btree ("status");
  CREATE INDEX "selection_entries_trial_session_idx" ON "selection_entries" USING btree ("trial_session_id");
  CREATE INDEX "selection_entries_offered_team_idx" ON "selection_entries" USING btree ("offered_team_id");
  CREATE INDEX "selection_entries_registration_program_idx" ON "selection_entries" USING btree ("registration_program_id");
  CREATE INDEX "selection_entries_account_idx" ON "selection_entries" USING btree ("account_id");
  CREATE INDEX "selection_entries_participant_idx" ON "selection_entries" USING btree ("participant_id");
  CREATE INDEX "selection_entries_updated_at_idx" ON "selection_entries" USING btree ("updated_at");
  CREATE INDEX "selection_entries_created_at_idx" ON "selection_entries" USING btree ("created_at");
  CREATE INDEX "selection_entries_rels_order_idx" ON "selection_entries_rels" USING btree ("order");
  CREATE INDEX "selection_entries_rels_parent_idx" ON "selection_entries_rels" USING btree ("parent_id");
  CREATE INDEX "selection_entries_rels_path_idx" ON "selection_entries_rels" USING btree ("path");
  CREATE INDEX "selection_entries_rels_trial_sessions_id_idx" ON "selection_entries_rels" USING btree ("trial_sessions_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_selection_rounds_fk" FOREIGN KEY ("selection_rounds_id") REFERENCES "public"."selection_rounds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_selection_entries_fk" FOREIGN KEY ("selection_entries_id") REFERENCES "public"."selection_entries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_selection_rounds_id_idx" ON "payload_locked_documents_rels" USING btree ("selection_rounds_id");
  CREATE INDEX "payload_locked_documents_rels_selection_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("selection_entries_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "trial_registrations_id";
  DROP TYPE "public"."enum_trial_registrations_status";
  DROP TYPE "public"."enum_trial_registrations_player_gender";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_trial_registrations_status" AS ENUM('interested', 'trial-booked', 'attended', 'offered', 'registered', 'closed');
  CREATE TYPE "public"."enum_trial_registrations_player_gender" AS ENUM('female', 'male', 'non-binary', 'prefer-not-to-say');
  CREATE TABLE "trial_registrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar,
  	"reference" varchar,
  	"status" "enum_trial_registrations_status" DEFAULT 'interested' NOT NULL,
  	"birth_year" numeric,
  	"season" numeric,
  	"trial_session_id" integer,
  	"offered_team_id" integer,
  	"registration_program_id" integer,
  	"offer_sent_at" timestamp(3) with time zone,
  	"contact_first_name" varchar NOT NULL,
  	"contact_last_name" varchar NOT NULL,
  	"contact_email" varchar NOT NULL,
  	"contact_phone" varchar NOT NULL,
  	"player_first_name" varchar NOT NULL,
  	"player_last_name" varchar NOT NULL,
  	"player_date_of_birth" timestamp(3) with time zone NOT NULL,
  	"player_gender" "enum_trial_registrations_player_gender",
  	"player_previous_club" varchar,
  	"player_notes" varchar,
  	"account_id" integer,
  	"participant_id" integer,
  	"token" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "trial_registrations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"trial_sessions_id" integer
  );
  
  ALTER TABLE "selection_rounds" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "selection_rounds_numbers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "selection_entries_flags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "selection_entries_moves" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "selection_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "selection_entries_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "selection_rounds" CASCADE;
  DROP TABLE "selection_rounds_numbers" CASCADE;
  DROP TABLE "selection_entries_flags" CASCADE;
  DROP TABLE "selection_entries_moves" CASCADE;
  DROP TABLE "selection_entries" CASCADE;
  DROP TABLE "selection_entries_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_selection_rounds_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_selection_entries_fk";
  
  DROP INDEX "payload_locked_documents_rels_selection_rounds_id_idx";
  DROP INDEX "payload_locked_documents_rels_selection_entries_id_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trial_registrations_id" integer;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_trial_session_id_trial_sessions_id_fk" FOREIGN KEY ("trial_session_id") REFERENCES "public"."trial_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_offered_team_id_teams_id_fk" FOREIGN KEY ("offered_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_registration_program_id_programs_id_fk" FOREIGN KEY ("registration_program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations_rels" ADD CONSTRAINT "trial_registrations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."trial_registrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trial_registrations_rels" ADD CONSTRAINT "trial_registrations_rels_trial_sessions_fk" FOREIGN KEY ("trial_sessions_id") REFERENCES "public"."trial_sessions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "trial_registrations_reference_idx" ON "trial_registrations" USING btree ("reference");
  CREATE INDEX "trial_registrations_trial_session_idx" ON "trial_registrations" USING btree ("trial_session_id");
  CREATE INDEX "trial_registrations_offered_team_idx" ON "trial_registrations" USING btree ("offered_team_id");
  CREATE INDEX "trial_registrations_registration_program_idx" ON "trial_registrations" USING btree ("registration_program_id");
  CREATE INDEX "trial_registrations_account_idx" ON "trial_registrations" USING btree ("account_id");
  CREATE INDEX "trial_registrations_participant_idx" ON "trial_registrations" USING btree ("participant_id");
  CREATE INDEX "trial_registrations_updated_at_idx" ON "trial_registrations" USING btree ("updated_at");
  CREATE INDEX "trial_registrations_created_at_idx" ON "trial_registrations" USING btree ("created_at");
  CREATE INDEX "trial_registrations_rels_order_idx" ON "trial_registrations_rels" USING btree ("order");
  CREATE INDEX "trial_registrations_rels_parent_idx" ON "trial_registrations_rels" USING btree ("parent_id");
  CREATE INDEX "trial_registrations_rels_path_idx" ON "trial_registrations_rels" USING btree ("path");
  CREATE INDEX "trial_registrations_rels_trial_sessions_id_idx" ON "trial_registrations_rels" USING btree ("trial_sessions_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trial_registrations_fk" FOREIGN KEY ("trial_registrations_id") REFERENCES "public"."trial_registrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_trial_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("trial_registrations_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "selection_rounds_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "selection_entries_id";
  DROP TYPE "public"."enum_selection_rounds_kind";
  DROP TYPE "public"."enum_selection_rounds_status";
  DROP TYPE "public"."enum_selection_entries_flags";
  DROP TYPE "public"."enum_selection_entries_moves_direction";
  DROP TYPE "public"."enum_selection_entries_kind";
  DROP TYPE "public"."enum_selection_entries_status";
  DROP TYPE "public"."enum_selection_entries_player_gender";`)
}
