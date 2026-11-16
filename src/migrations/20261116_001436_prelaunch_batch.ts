import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_sessions_cover_status" AS ENUM('asked', 'confirmed', 'declined');
  ALTER TABLE "forum_threads" ALTER COLUMN "body" DROP NOT NULL;
  ALTER TABLE "difference_page" ALTER COLUMN "sessions_headline" SET DEFAULT 'Every session, six stages';
  ALTER TABLE "difference_page" ALTER COLUMN "sessions_body" SET DEFAULT 'Every session is built around one learning objective and follows the same six stages, so players get the most out of every minute.';
  ALTER TABLE "academy_share_links" ADD COLUMN "allow_existing" boolean DEFAULT false;
  ALTER TABLE "academy_sessions" ADD COLUMN "cover_status" "enum_academy_sessions_cover_status";
  ALTER TABLE "academy_sessions" ADD COLUMN "cover_asked_at" timestamp(3) with time zone;
  ALTER TABLE "academy_sessions" ADD COLUMN "cover_answered_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "trial_session2_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "sms_alert_numbers" varchar;
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_trial_session2_id_trial_sessions_id_fk" FOREIGN KEY ("trial_session2_id") REFERENCES "public"."trial_sessions"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "selection_entries_trial_session2_idx" ON "selection_entries" USING btree ("trial_session2_id");`)

  // Why us page: Ball Mastery after Ignite (to match the booklet), "five stages" → "six stages" — only where not already done
  await db.execute(sql`
  UPDATE "difference_page" SET "sessions_headline" = replace("sessions_headline", 'five stages', 'six stages'), "sessions_body" = replace("sessions_body", 'five stages', 'six stages');
  UPDATE "difference_page_sessions_stages" s SET "_order" = s."_order" + 1
    FROM "difference_page_sessions_stages" i
    WHERE i."_parent_id" = s."_parent_id" AND upper(i."name") = 'IGNITE' AND s."_order" > i."_order"
      AND NOT EXISTS (SELECT 1 FROM "difference_page_sessions_stages" b WHERE b."_parent_id" = s."_parent_id" AND upper(b."name") = 'BALL MASTERY');
  INSERT INTO "difference_page_sessions_stages" ("_order", "_parent_id", "id", "name", "line")
    SELECT i."_order" + 1, i."_parent_id", md5(random()::text || clock_timestamp()::text)::varchar(24), 'BALL MASTERY', 'Lots of touches to build close control, confidence and comfort on the ball with both feet.'
    FROM "difference_page_sessions_stages" i
    WHERE upper(i."name") = 'IGNITE'
      AND NOT EXISTS (SELECT 1 FROM "difference_page_sessions_stages" b WHERE b."_parent_id" = i."_parent_id" AND upper(b."name") = 'BALL MASTERY');`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "selection_entries" DROP CONSTRAINT IF EXISTS "selection_entries_trial_session2_id_trial_sessions_id_fk";
  
  DROP INDEX IF EXISTS "selection_entries_trial_session2_idx";
  UPDATE "forum_threads" SET "body" = '' WHERE "body" IS NULL;
  ALTER TABLE "forum_threads" ALTER COLUMN "body" SET NOT NULL;
  ALTER TABLE "difference_page" ALTER COLUMN "sessions_headline" SET DEFAULT 'Every session, five stages';
  ALTER TABLE "difference_page" ALTER COLUMN "sessions_body" SET DEFAULT 'Every session is built around one learning objective and follows the same five stages, so players get the most out of every minute.';
  ALTER TABLE "academy_share_links" DROP COLUMN IF EXISTS "allow_existing";
  ALTER TABLE "academy_sessions" DROP COLUMN IF EXISTS "cover_status";
  ALTER TABLE "academy_sessions" DROP COLUMN IF EXISTS "cover_asked_at";
  ALTER TABLE "academy_sessions" DROP COLUMN IF EXISTS "cover_answered_at";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "trial_session2_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "sms_alert_numbers";
  DROP TYPE IF EXISTS "public"."enum_academy_sessions_cover_status";`)
}
