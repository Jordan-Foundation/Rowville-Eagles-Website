import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_selection_entries_position_group" AS ENUM('gk', 'def', 'mid', 'fwd');
  CREATE TYPE "public"."enum_selection_entries_prefs_training_nights" AS ENUM('mon_wed', 'tue_thu', 'none');
  CREATE TYPE "public"."enum_selection_entries_prefs_game_day" AS ENUM('sat', 'sun', 'none');
  CREATE TYPE "public"."enum_trial_invites_source" AS ENUM('booked', 'invited');
  CREATE TYPE "public"."enum_trial_sessions_program" AS ENUM('eagles', 'rfa');
  CREATE TYPE "public"."enum_teams_game_day" AS ENUM('Saturday', 'Sunday');
  CREATE TABLE "trial_invites" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"entry_id" integer NOT NULL,
  	"session_id" integer NOT NULL,
  	"source" "enum_trial_invites_source" DEFAULT 'invited',
  	"invited_at" timestamp(3) with time zone,
  	"invited_by_id" integer,
  	"attended" boolean DEFAULT false,
  	"attended_at" timestamp(3) with time zone,
  	"marked_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "selection_audit" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"round_id" integer,
  	"entry_id" integer,
  	"squad_id" integer,
  	"action" varchar NOT NULL,
  	"summary" varchar NOT NULL,
  	"by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_selected_body" SET DEFAULT 'Congratulations {parent} — {player} has been selected for {event} ({ageGroup}).
  
  Next step: complete registration and payment using the button below by {deadline} so we can confirm {player}’s place. Once teams are finalised we’ll email you {player}’s team, coach and all the details.';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_selected_sms" SET DEFAULT '{event}: {player} has been selected! Complete registration by {deadline}: {link}';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_successful_subject" SET DEFAULT 'Congratulations {player} — welcome to {program}!';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_successful_body" SET DEFAULT 'Congratulations {parent} — after trials we’d love {player} to join {program} in the {ageGroup}.
  
  Next steps:
  1. Complete registration and payment using the button below by {deadline} to accept the place.
  2. Pick {player}’s shirt number and tell us your preferred training nights and game day.
  3. Once teams are finalised, we’ll email you {player}’s team, coach, training times and game day.';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_successful_sms" SET DEFAULT 'Rowville Eagles: congratulations — {player} has a place for {program}! Complete registration by {deadline}: {link}';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_unsuccessful_body" SET DEFAULT 'Thank you for trialling with Rowville Eagles. We’ve had a great number of players this season, and on this occasion we’re unable to offer {player} a place in a {ageGroup} team. We know this is disappointing, and we really appreciated {player}’s effort.
  
  We’d love {player} to keep playing and developing with us:
  • Foundation Academy training terms — weekly sessions with our coaches: {siteUrl}/programs?type=academy-term
  • School holiday camps: {siteUrl}/programs?type=holiday-camp
  • 1-on-1 coaching: {siteUrl}/academy/1-on-1
  
  We’ll keep {player}’s details in case a spot opens up, and you’re welcome to contact us for feedback.';
  ALTER TABLE "squads" ADD COLUMN "sort_order" numeric;
  ALTER TABLE "squads" ADD COLUMN "welcome_message" varchar;
  ALTER TABLE "squads" ADD COLUMN "welcome_updated_by_id" integer;
  ALTER TABLE "squads" ADD COLUMN "welcome_updated_at" timestamp(3) with time zone;
  ALTER TABLE "squads" ADD COLUMN "finalised_at" timestamp(3) with time zone;
  ALTER TABLE "squads" ADD COLUMN "finalised_by_id" integer;
  ALTER TABLE "squads" ADD COLUMN "team_email_sent_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "needs_another_trial" boolean DEFAULT false;
  ALTER TABLE "selection_entries" ADD COLUMN "outcome_marked_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "outcome_marked_by_id" integer;
  ALTER TABLE "selection_entries" ADD COLUMN "position" varchar;
  ALTER TABLE "selection_entries" ADD COLUMN "position_group" "enum_selection_entries_position_group";
  ALTER TABLE "selection_entries" ADD COLUMN "sort_order" numeric;
  ALTER TABLE "selection_entries" ADD COLUMN "prefs_training_nights" "enum_selection_entries_prefs_training_nights";
  ALTER TABLE "selection_entries" ADD COLUMN "prefs_game_day" "enum_selection_entries_prefs_game_day";
  ALTER TABLE "selection_entries" ADD COLUMN "prefs_answered_at" timestamp(3) with time zone;
  ALTER TABLE "trial_sessions" ADD COLUMN "program" "enum_trial_sessions_program" DEFAULT 'eagles';
  ALTER TABLE "teams" ADD COLUMN "game_day" "enum_teams_game_day";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trial_invites_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "selection_audit_id" integer;
  ALTER TABLE "trial_invites" ADD CONSTRAINT "trial_invites_entry_id_selection_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."selection_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_invites" ADD CONSTRAINT "trial_invites_session_id_trial_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."trial_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_invites" ADD CONSTRAINT "trial_invites_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_invites" ADD CONSTRAINT "trial_invites_marked_by_id_users_id_fk" FOREIGN KEY ("marked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_audit" ADD CONSTRAINT "selection_audit_round_id_selection_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."selection_rounds"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_audit" ADD CONSTRAINT "selection_audit_entry_id_selection_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."selection_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_audit" ADD CONSTRAINT "selection_audit_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_audit" ADD CONSTRAINT "selection_audit_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "trial_invites_key_idx" ON "trial_invites" USING btree ("key");
  CREATE INDEX "trial_invites_entry_idx" ON "trial_invites" USING btree ("entry_id");
  CREATE INDEX "trial_invites_session_idx" ON "trial_invites" USING btree ("session_id");
  CREATE INDEX "trial_invites_invited_by_idx" ON "trial_invites" USING btree ("invited_by_id");
  CREATE INDEX "trial_invites_attended_idx" ON "trial_invites" USING btree ("attended");
  CREATE INDEX "trial_invites_marked_by_idx" ON "trial_invites" USING btree ("marked_by_id");
  CREATE INDEX "trial_invites_updated_at_idx" ON "trial_invites" USING btree ("updated_at");
  CREATE INDEX "trial_invites_created_at_idx" ON "trial_invites" USING btree ("created_at");
  CREATE INDEX "selection_audit_round_idx" ON "selection_audit" USING btree ("round_id");
  CREATE INDEX "selection_audit_entry_idx" ON "selection_audit" USING btree ("entry_id");
  CREATE INDEX "selection_audit_squad_idx" ON "selection_audit" USING btree ("squad_id");
  CREATE INDEX "selection_audit_action_idx" ON "selection_audit" USING btree ("action");
  CREATE INDEX "selection_audit_by_idx" ON "selection_audit" USING btree ("by_id");
  CREATE INDEX "selection_audit_updated_at_idx" ON "selection_audit" USING btree ("updated_at");
  CREATE INDEX "selection_audit_created_at_idx" ON "selection_audit" USING btree ("created_at");
  ALTER TABLE "squads" ADD CONSTRAINT "squads_welcome_updated_by_id_users_id_fk" FOREIGN KEY ("welcome_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "squads" ADD CONSTRAINT "squads_finalised_by_id_users_id_fk" FOREIGN KEY ("finalised_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_outcome_marked_by_id_users_id_fk" FOREIGN KEY ("outcome_marked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trial_invites_fk" FOREIGN KEY ("trial_invites_id") REFERENCES "public"."trial_invites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_selection_audit_fk" FOREIGN KEY ("selection_audit_id") REFERENCES "public"."selection_audit"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "squads_welcome_updated_by_idx" ON "squads" USING btree ("welcome_updated_by_id");
  CREATE INDEX "squads_finalised_by_idx" ON "squads" USING btree ("finalised_by_id");
  CREATE INDEX "selection_entries_needs_another_trial_idx" ON "selection_entries" USING btree ("needs_another_trial");
  CREATE INDEX "selection_entries_outcome_marked_by_idx" ON "selection_entries" USING btree ("outcome_marked_by_id");
  CREATE INDEX "payload_locked_documents_rels_trial_invites_id_idx" ON "payload_locked_documents_rels" USING btree ("trial_invites_id");
  CREATE INDEX "payload_locked_documents_rels_selection_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("selection_audit_id");
  -- Teams already built the old way (team chosen before payment) count as finalised, so paid players keep joining them
  UPDATE "squads" SET "finalised_at" = now() WHERE "finalised_at" IS NULL;
  -- Trials booked through the join form become each player's trial history
  INSERT INTO "trial_invites" ("key", "entry_id", "session_id", "source", "invited_at", "attended")
    SELECT e.id || '-' || e.trial_session_id, e.id, e.trial_session_id, 'booked', e.updated_at, e.status IN ('attended', 'offered', 'registered', 'selected', 'unsuccessful')
    FROM "selection_entries" e WHERE e.trial_session_id IS NOT NULL
    ON CONFLICT ("key") DO NOTHING;
  INSERT INTO "trial_invites" ("key", "entry_id", "session_id", "source", "invited_at", "attended")
    SELECT e.id || '-' || e.trial_session2_id, e.id, e.trial_session2_id, 'booked', e.updated_at, false
    FROM "selection_entries" e WHERE e.trial_session2_id IS NOT NULL
    ON CONFLICT ("key") DO NOTHING;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "trial_invites" CASCADE;
  DROP TABLE IF EXISTS "selection_audit" CASCADE;
  ALTER TABLE "squads" DROP CONSTRAINT IF EXISTS "squads_welcome_updated_by_id_users_id_fk";
  
  ALTER TABLE "squads" DROP CONSTRAINT IF EXISTS "squads_finalised_by_id_users_id_fk";
  
  ALTER TABLE "selection_entries" DROP CONSTRAINT IF EXISTS "selection_entries_outcome_marked_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_trial_invites_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_selection_audit_fk";
  
  DROP INDEX IF EXISTS "squads_welcome_updated_by_idx";
  DROP INDEX IF EXISTS "squads_finalised_by_idx";
  DROP INDEX IF EXISTS "selection_entries_needs_another_trial_idx";
  DROP INDEX IF EXISTS "selection_entries_outcome_marked_by_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_trial_invites_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_selection_audit_id_idx";
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_selected_body" SET DEFAULT 'Congratulations {parent} — {player} has been selected to play in {team} at {event}.
  
  Please complete registration and payment using the button below so we can confirm {player}’s place.';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_selected_sms" SET DEFAULT '{event}: {player} has been selected for {team}! Complete registration: {link}';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_successful_subject" SET DEFAULT 'Welcome to the Eagles, {player}!';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_successful_body" SET DEFAULT 'Congratulations {parent} — after trials we’d love {player} to join {team} for the season.
  
  Please complete registration and payment using the button below to accept the place.';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_successful_sms" SET DEFAULT 'Rowville Eagles: congratulations — {player} has a place in {team}! Complete registration: {link}';
  ALTER TABLE "selection_rounds" ALTER COLUMN "templates_unsuccessful_body" SET DEFAULT 'Thank you for trialling with Rowville Eagles. We’ve had a great number of players this season, and on this occasion we’re unable to offer {player} a place in a {ageGroup} team. We know this is disappointing.
  
  We’d love {player} to keep playing — we’ll keep their details in case a spot opens up, and you’re welcome to contact us for feedback.';
  ALTER TABLE "squads" DROP COLUMN IF EXISTS "sort_order";
  ALTER TABLE "squads" DROP COLUMN IF EXISTS "welcome_message";
  ALTER TABLE "squads" DROP COLUMN IF EXISTS "welcome_updated_by_id";
  ALTER TABLE "squads" DROP COLUMN IF EXISTS "welcome_updated_at";
  ALTER TABLE "squads" DROP COLUMN IF EXISTS "finalised_at";
  ALTER TABLE "squads" DROP COLUMN IF EXISTS "finalised_by_id";
  ALTER TABLE "squads" DROP COLUMN IF EXISTS "team_email_sent_at";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "needs_another_trial";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "outcome_marked_at";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "outcome_marked_by_id";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "position";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "position_group";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "sort_order";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "prefs_training_nights";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "prefs_game_day";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "prefs_answered_at";
  ALTER TABLE "trial_sessions" DROP COLUMN IF EXISTS "program";
  ALTER TABLE "teams" DROP COLUMN IF EXISTS "game_day";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "trial_invites_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "selection_audit_id";
  DROP TYPE IF EXISTS "public"."enum_selection_entries_position_group";
  DROP TYPE IF EXISTS "public"."enum_selection_entries_prefs_training_nights";
  DROP TYPE IF EXISTS "public"."enum_selection_entries_prefs_game_day";
  DROP TYPE IF EXISTS "public"."enum_trial_invites_source";
  DROP TYPE IF EXISTS "public"."enum_trial_sessions_program";
  DROP TYPE IF EXISTS "public"."enum_teams_game_day";`)
}
