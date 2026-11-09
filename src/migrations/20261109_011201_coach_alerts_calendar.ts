import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_coaches" ADD COLUMN "alerts_booking_email" boolean DEFAULT true;
  ALTER TABLE "academy_coaches" ADD COLUMN "alerts_booking_text" boolean DEFAULT true;
  ALTER TABLE "academy_coaches" ADD COLUMN "alerts_cancel_email" boolean DEFAULT true;
  ALTER TABLE "academy_coaches" ADD COLUMN "alerts_cancel_text" boolean DEFAULT false;
  ALTER TABLE "academy_coaches" ADD COLUMN "alerts_reply_email" boolean DEFAULT true;
  ALTER TABLE "academy_coaches" ADD COLUMN "alerts_reply_text" boolean DEFAULT false;
  ALTER TABLE "academy_coaches" ADD COLUMN "calendar_token" varchar;
  CREATE INDEX "academy_coaches_calendar_token_idx" ON "academy_coaches" USING btree ("calendar_token");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "academy_coaches_calendar_token_idx";
  ALTER TABLE "academy_coaches" DROP COLUMN "alerts_booking_email";
  ALTER TABLE "academy_coaches" DROP COLUMN "alerts_booking_text";
  ALTER TABLE "academy_coaches" DROP COLUMN "alerts_cancel_email";
  ALTER TABLE "academy_coaches" DROP COLUMN "alerts_cancel_text";
  ALTER TABLE "academy_coaches" DROP COLUMN "alerts_reply_email";
  ALTER TABLE "academy_coaches" DROP COLUMN "alerts_reply_text";
  ALTER TABLE "academy_coaches" DROP COLUMN "calendar_token";`)
}
