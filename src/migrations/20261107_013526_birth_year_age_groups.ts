import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "trial_sessions_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  CREATE TABLE "programs_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  -- Convert legacy "U9"-style age groups (season − birth year + 1) to years of birth
  INSERT INTO "trial_sessions_numbers" ("number", "order", "parent_id", "path")
    SELECT COALESCE((SELECT "season" FROM "site_settings" LIMIT 1), 2027) - CAST(SUBSTRING(CAST(g."value" AS text) FROM 2) AS integer) + 1, g."order", g."parent_id", 'birthYears'
    FROM "trial_sessions_age_groups" g WHERE CAST(g."value" AS text) ~ '^U[0-9]+$';
  INSERT INTO "programs_numbers" ("number", "order", "parent_id", "path")
    SELECT COALESCE((SELECT "season" FROM "site_settings" LIMIT 1), 2027) - CAST(SUBSTRING(CAST(g."value" AS text) FROM 2) AS integer) + 1, g."order", w."_parent_id", 'weeklySessions.' || (w."_order" - 1) || '.birthYears'
    FROM "programs_weekly_sessions_age_groups" g JOIN "programs_weekly_sessions" w ON w."id" = g."parent_id"
    WHERE CAST(g."value" AS text) ~ '^U[0-9]+$';
  DROP TABLE "trial_sessions_age_groups" CASCADE;
  DROP TABLE "programs_weekly_sessions_age_groups" CASCADE;
  ALTER TABLE "trial_registrations" ADD COLUMN "birth_year" numeric;
  ALTER TABLE "bookings" ADD COLUMN "birth_year" numeric;
  ALTER TABLE "site_settings" ADD COLUMN "age_groups_mini_min" numeric DEFAULT 6;
  ALTER TABLE "site_settings" ADD COLUMN "age_groups_mini_max" numeric DEFAULT 11;
  ALTER TABLE "site_settings" ADD COLUMN "age_groups_max_down" numeric DEFAULT 2;
  ALTER TABLE "site_settings" ADD COLUMN "age_groups_warn_down" numeric DEFAULT 2;
  ALTER TABLE "trial_sessions_numbers" ADD CONSTRAINT "trial_sessions_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."trial_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_numbers" ADD CONSTRAINT "programs_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "trial_sessions_numbers_order_parent_idx" ON "trial_sessions_numbers" USING btree ("order","parent_id");
  CREATE INDEX "programs_numbers_order_parent_idx" ON "programs_numbers" USING btree ("order","parent_id");
  UPDATE "trial_registrations" SET "birth_year" = EXTRACT(YEAR FROM ("player_date_of_birth" AT TIME ZONE 'Australia/Sydney'));
  UPDATE "bookings" SET "birth_year" = COALESCE(
    EXTRACT(YEAR FROM ("player_date_of_birth" AT TIME ZONE 'Australia/Sydney')),
    CASE WHEN CAST("age_group" AS text) ~ '^U[0-9]+$' THEN COALESCE((SELECT "season" FROM "site_settings" LIMIT 1), 2027) - CAST(SUBSTRING(CAST("age_group" AS text) FROM 2) AS integer) + 1 END
  ) WHERE "booking_type" = 'trial';
  ALTER TABLE "trial_registrations" DROP COLUMN "age_group";
  ALTER TABLE "bookings" DROP COLUMN "age_group";
  DROP TYPE "public"."enum_trial_registrations_age_group";
  DROP TYPE "public"."enum_trial_sessions_age_groups";
  DROP TYPE "public"."enum_programs_weekly_sessions_age_groups";
  DROP TYPE "public"."enum_bookings_age_group";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_trial_registrations_age_group" AS ENUM('U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Seniors');
  CREATE TYPE "public"."enum_trial_sessions_age_groups" AS ENUM('U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Seniors');
  CREATE TYPE "public"."enum_programs_weekly_sessions_age_groups" AS ENUM('U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Seniors');
  CREATE TYPE "public"."enum_bookings_age_group" AS ENUM('U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Seniors');
  CREATE TABLE "trial_sessions_age_groups" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_trial_sessions_age_groups",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programs_weekly_sessions_age_groups" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_programs_weekly_sessions_age_groups",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  DROP TABLE "trial_sessions_numbers" CASCADE;
  DROP TABLE "programs_numbers" CASCADE;
  ALTER TABLE "trial_registrations" ADD COLUMN "age_group" "enum_trial_registrations_age_group";
  ALTER TABLE "bookings" ADD COLUMN "age_group" "enum_bookings_age_group";
  ALTER TABLE "trial_sessions_age_groups" ADD CONSTRAINT "trial_sessions_age_groups_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."trial_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_weekly_sessions_age_groups" ADD CONSTRAINT "programs_weekly_sessions_age_groups_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs_weekly_sessions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "trial_sessions_age_groups_order_idx" ON "trial_sessions_age_groups" USING btree ("order");
  CREATE INDEX "trial_sessions_age_groups_parent_idx" ON "trial_sessions_age_groups" USING btree ("parent_id");
  CREATE INDEX "programs_weekly_sessions_age_groups_order_idx" ON "programs_weekly_sessions_age_groups" USING btree ("order");
  CREATE INDEX "programs_weekly_sessions_age_groups_parent_idx" ON "programs_weekly_sessions_age_groups" USING btree ("parent_id");
  ALTER TABLE "trial_registrations" DROP COLUMN "birth_year";
  ALTER TABLE "bookings" DROP COLUMN "birth_year";
  ALTER TABLE "site_settings" DROP COLUMN "age_groups_mini_min";
  ALTER TABLE "site_settings" DROP COLUMN "age_groups_mini_max";
  ALTER TABLE "site_settings" DROP COLUMN "age_groups_max_down";
  ALTER TABLE "site_settings" DROP COLUMN "age_groups_warn_down";`)
}
