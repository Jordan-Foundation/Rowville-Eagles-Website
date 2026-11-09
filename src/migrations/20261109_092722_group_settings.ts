import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_settings" ADD COLUMN "group_sessions_casual2" numeric DEFAULT 70 NOT NULL;
  ALTER TABLE "academy_settings" ADD COLUMN "group_sessions_casual3" numeric DEFAULT 60 NOT NULL;
  ALTER TABLE "academy_settings" ADD COLUMN "group_sessions_casual4" numeric DEFAULT 50 NOT NULL;
  ALTER TABLE "academy_settings" ADD COLUMN "group_sessions_casual5" numeric DEFAULT 40 NOT NULL;
  ALTER TABLE "academy_settings" ADD COLUMN "group_sessions_term_discount_pct" numeric DEFAULT 10 NOT NULL;
  ALTER TABLE "academy_settings" ADD COLUMN "group_sessions_invite_deadline_hours" numeric DEFAULT 48 NOT NULL;
  ALTER TABLE "academy_settings" ADD COLUMN "group_sessions_reminder_hours_before" numeric DEFAULT 12 NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "group_sessions_casual2";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "group_sessions_casual3";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "group_sessions_casual4";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "group_sessions_casual5";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "group_sessions_term_discount_pct";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "group_sessions_invite_deadline_hours";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "group_sessions_reminder_hours_before";`)
}
