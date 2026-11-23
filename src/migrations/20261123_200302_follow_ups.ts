import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs_camp_days" ALTER COLUMN "end_time" SET DEFAULT '15:30';
  ALTER TABLE "difference_page" ALTER COLUMN "sessions_more" SET DEFAULT 'Sessions run for 60 minutes for U5–U7, 75 minutes for U8–U11 and 90 minutes for U12 and up.';
  ALTER TABLE "difference_page" ALTER COLUMN "sessions_lengths" SET DEFAULT '60 minutes for U5–U7 · 75 minutes for U8–U11 · 90 minutes for U12+';
  ALTER TABLE "academy_bookings" ADD COLUMN "follow_ups_recovery_at" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "follow_ups_trial_reminder_at" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "follow_ups_trial_enrol_at" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "follow_ups_trial_nudge_at" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "follow_ups_details_at" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "follow_ups_recovery_at" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "follow_ups_stopped" boolean;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs_camp_days" ALTER COLUMN "end_time" SET DEFAULT '15:00';
  ALTER TABLE "difference_page" ALTER COLUMN "sessions_more" SET DEFAULT 'Sessions run for 75 minutes for U5–U11 and 90 minutes for U12 and up.';
  ALTER TABLE "difference_page" ALTER COLUMN "sessions_lengths" SET DEFAULT '75 minutes for U5–U11 · 90 minutes for U12+';
  ALTER TABLE "academy_bookings" DROP COLUMN IF EXISTS "follow_ups_recovery_at";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "follow_ups_trial_reminder_at";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "follow_ups_trial_enrol_at";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "follow_ups_trial_nudge_at";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "follow_ups_details_at";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "follow_ups_recovery_at";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "follow_ups_stopped";`)
}
