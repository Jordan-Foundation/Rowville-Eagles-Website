import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_trial_registrations_status" AS ENUM('interested', 'trial-booked', 'attended', 'offered', 'registered', 'closed');
  CREATE TYPE "public"."enum_trial_registrations_age_group" AS ENUM('U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Seniors');
  CREATE TYPE "public"."enum_trial_registrations_player_gender" AS ENUM('female', 'male', 'non-binary', 'prefer-not-to-say');
  CREATE TYPE "public"."enum_trial_sessions_age_groups" AS ENUM('U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Seniors');
  CREATE TYPE "public"."enum_trial_sessions_status" AS ENUM('draft', 'published', 'closed');
  CREATE TYPE "public"."enum_programs_weekly_sessions_age_groups" AS ENUM('U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Seniors');
  CREATE TYPE "public"."enum_programs_weekly_sessions_day" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TYPE "public"."enum_programs_visibility" AS ENUM('public', 'offer-only');
  CREATE TYPE "public"."enum_bookings_booking_type" AS ENUM('enrolment', 'trial');
  CREATE TYPE "public"."enum_bookings_age_group" AS ENUM('U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Seniors');
  CREATE TYPE "public"."enum_products_audience" AS ENUM('everyone', 'rowville', 'rfa');
  CREATE TYPE "public"."enum_participants_memberships" AS ENUM('rowville', 'rfa');
  CREATE TYPE "public"."enum_participants_registration_offer_status" AS ENUM('offered', 'paid');
  ALTER TYPE "public"."enum_posts_category" ADD VALUE 'Tournament' BEFORE 'Academy';
  ALTER TYPE "public"."enum_posts_category" ADD VALUE 'Seniors' BEFORE 'Academy';
  CREATE TABLE "posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"teams_id" integer
  );
  
  CREATE TABLE "trial_registrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"status" "enum_trial_registrations_status" DEFAULT 'interested' NOT NULL,
  	"age_group" "enum_trial_registrations_age_group",
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
  
  CREATE TABLE "trial_sessions_age_groups" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_trial_sessions_age_groups",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "trial_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"start" timestamp(3) with time zone NOT NULL,
  	"duration_minutes" numeric DEFAULT 60,
  	"capacity_per_age_group" numeric DEFAULT 20,
  	"location" varchar DEFAULT '208 Dandelion Drive, Rowville',
  	"what_to_bring" varchar DEFAULT 'Boots, shin pads, water bottle and a ball if you have one. Please arrive 10 minutes early.',
  	"status" "enum_trial_sessions_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "programs_weekly_sessions_age_groups" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_programs_weekly_sessions_age_groups",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programs_weekly_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" "enum_programs_weekly_sessions_day",
  	"start_time" varchar,
  	"duration_minutes" numeric DEFAULT 75,
  	"trial_spots" numeric DEFAULT 3
  );
  
  CREATE TABLE "participants_memberships" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_participants_memberships",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "programs" ADD COLUMN "visibility" "enum_programs_visibility";
  ALTER TABLE "programs" ADD COLUMN "trial_price" numeric DEFAULT 0;
  ALTER TABLE "bookings" ADD COLUMN "booking_type" "enum_bookings_booking_type" DEFAULT 'enrolment';
  ALTER TABLE "bookings" ADD COLUMN "age_group" "enum_bookings_age_group";
  ALTER TABLE "products" ADD COLUMN "audience" "enum_products_audience" DEFAULT 'everyone' NOT NULL;
  ALTER TABLE "participants" ADD COLUMN "registration_offer_program_id" integer;
  ALTER TABLE "participants" ADD COLUMN "registration_offer_status" "enum_participants_registration_offer_status";
  ALTER TABLE "users" ADD COLUMN "activated" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trial_registrations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trial_sessions_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "season" numeric DEFAULT 2027;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_teams_fk" FOREIGN KEY ("teams_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_trial_session_id_trial_sessions_id_fk" FOREIGN KEY ("trial_session_id") REFERENCES "public"."trial_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_offered_team_id_teams_id_fk" FOREIGN KEY ("offered_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_registration_program_id_programs_id_fk" FOREIGN KEY ("registration_program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations" ADD CONSTRAINT "trial_registrations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "trial_registrations_rels" ADD CONSTRAINT "trial_registrations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."trial_registrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trial_registrations_rels" ADD CONSTRAINT "trial_registrations_rels_trial_sessions_fk" FOREIGN KEY ("trial_sessions_id") REFERENCES "public"."trial_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trial_sessions_age_groups" ADD CONSTRAINT "trial_sessions_age_groups_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."trial_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_weekly_sessions_age_groups" ADD CONSTRAINT "programs_weekly_sessions_age_groups_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs_weekly_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_weekly_sessions" ADD CONSTRAINT "programs_weekly_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "participants_memberships" ADD CONSTRAINT "participants_memberships_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_rels_order_idx" ON "posts_rels" USING btree ("order");
  CREATE INDEX "posts_rels_parent_idx" ON "posts_rels" USING btree ("parent_id");
  CREATE INDEX "posts_rels_path_idx" ON "posts_rels" USING btree ("path");
  CREATE INDEX "posts_rels_teams_id_idx" ON "posts_rels" USING btree ("teams_id");
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
  CREATE INDEX "trial_sessions_age_groups_order_idx" ON "trial_sessions_age_groups" USING btree ("order");
  CREATE INDEX "trial_sessions_age_groups_parent_idx" ON "trial_sessions_age_groups" USING btree ("parent_id");
  CREATE INDEX "trial_sessions_updated_at_idx" ON "trial_sessions" USING btree ("updated_at");
  CREATE INDEX "trial_sessions_created_at_idx" ON "trial_sessions" USING btree ("created_at");
  CREATE INDEX "programs_weekly_sessions_age_groups_order_idx" ON "programs_weekly_sessions_age_groups" USING btree ("order");
  CREATE INDEX "programs_weekly_sessions_age_groups_parent_idx" ON "programs_weekly_sessions_age_groups" USING btree ("parent_id");
  CREATE INDEX "programs_weekly_sessions_order_idx" ON "programs_weekly_sessions" USING btree ("_order");
  CREATE INDEX "programs_weekly_sessions_parent_id_idx" ON "programs_weekly_sessions" USING btree ("_parent_id");
  CREATE INDEX "participants_memberships_order_idx" ON "participants_memberships" USING btree ("order");
  CREATE INDEX "participants_memberships_parent_idx" ON "participants_memberships" USING btree ("parent_id");
  ALTER TABLE "participants" ADD CONSTRAINT "participants_registration_offer_program_id_programs_id_fk" FOREIGN KEY ("registration_offer_program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trial_registrations_fk" FOREIGN KEY ("trial_registrations_id") REFERENCES "public"."trial_registrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trial_sessions_fk" FOREIGN KEY ("trial_sessions_id") REFERENCES "public"."trial_sessions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "participants_registration_offer_registration_offer_progr_idx" ON "participants" USING btree ("registration_offer_program_id");
  CREATE INDEX "payload_locked_documents_rels_trial_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("trial_registrations_id");
  CREATE INDEX "payload_locked_documents_rels_trial_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("trial_sessions_id");
  -- Data: sensible defaults for records that existed before this migration
  UPDATE "products" SET "audience" = 'rowville' WHERE "brand" = 'club' AND "category" IN ('kit', 'training');
  UPDATE "products" SET "audience" = 'rfa' WHERE "brand" = 'academy';
  UPDATE "programs" SET "visibility" = 'offer-only' WHERE "type" = 'registration' AND "visibility" IS NULL;
  UPDATE "programs" SET "visibility" = 'public' WHERE "visibility" IS NULL;
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trial_registrations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trial_registrations_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trial_sessions_age_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trial_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "programs_weekly_sessions_age_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "programs_weekly_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "participants_memberships" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts_rels" CASCADE;
  DROP TABLE "trial_registrations" CASCADE;
  DROP TABLE "trial_registrations_rels" CASCADE;
  DROP TABLE "trial_sessions_age_groups" CASCADE;
  DROP TABLE "trial_sessions" CASCADE;
  DROP TABLE "programs_weekly_sessions_age_groups" CASCADE;
  DROP TABLE "programs_weekly_sessions" CASCADE;
  DROP TABLE "participants_memberships" CASCADE;
  ALTER TABLE "participants" DROP CONSTRAINT "participants_registration_offer_program_id_programs_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_trial_registrations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_trial_sessions_fk";
  
  ALTER TABLE "posts" ALTER COLUMN "category" SET DATA TYPE text;
  ALTER TABLE "posts" ALTER COLUMN "category" SET DEFAULT 'Club news'::text;
  DROP TYPE "public"."enum_posts_category";
  CREATE TYPE "public"."enum_posts_category" AS ENUM('Club news', 'Match report', 'Academy', 'Community', 'Sponsors');
  ALTER TABLE "posts" ALTER COLUMN "category" SET DEFAULT 'Club news'::"public"."enum_posts_category";
  ALTER TABLE "posts" ALTER COLUMN "category" SET DATA TYPE "public"."enum_posts_category" USING "category"::"public"."enum_posts_category";
  DROP INDEX "participants_registration_offer_registration_offer_progr_idx";
  DROP INDEX "payload_locked_documents_rels_trial_registrations_id_idx";
  DROP INDEX "payload_locked_documents_rels_trial_sessions_id_idx";
  ALTER TABLE "programs" DROP COLUMN "visibility";
  ALTER TABLE "programs" DROP COLUMN "trial_price";
  ALTER TABLE "bookings" DROP COLUMN "booking_type";
  ALTER TABLE "bookings" DROP COLUMN "age_group";
  ALTER TABLE "products" DROP COLUMN "audience";
  ALTER TABLE "participants" DROP COLUMN "registration_offer_program_id";
  ALTER TABLE "participants" DROP COLUMN "registration_offer_status";
  ALTER TABLE "users" DROP COLUMN "activated";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "trial_registrations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "trial_sessions_id";
  ALTER TABLE "site_settings" DROP COLUMN "season";
  DROP TYPE "public"."enum_trial_registrations_status";
  DROP TYPE "public"."enum_trial_registrations_age_group";
  DROP TYPE "public"."enum_trial_registrations_player_gender";
  DROP TYPE "public"."enum_trial_sessions_age_groups";
  DROP TYPE "public"."enum_trial_sessions_status";
  DROP TYPE "public"."enum_programs_weekly_sessions_age_groups";
  DROP TYPE "public"."enum_programs_weekly_sessions_day";
  DROP TYPE "public"."enum_programs_visibility";
  DROP TYPE "public"."enum_bookings_booking_type";
  DROP TYPE "public"."enum_bookings_age_group";
  DROP TYPE "public"."enum_products_audience";
  DROP TYPE "public"."enum_participants_memberships";
  DROP TYPE "public"."enum_participants_registration_offer_status";`)
}
