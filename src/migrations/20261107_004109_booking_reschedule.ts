import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_academy_bookings_adjustments_action" ADD VALUE 'reschedule';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_bookings_adjustments" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_academy_bookings_adjustments_action";
  CREATE TYPE "public"."enum_academy_bookings_adjustments_action" AS ENUM('cancel_booking', 'cancel_sessions', 'makeup', 'goodwill');
  ALTER TABLE "academy_bookings_adjustments" ALTER COLUMN "action" SET DATA TYPE "public"."enum_academy_bookings_adjustments_action" USING "action"::"public"."enum_academy_bookings_adjustments_action";`)
}
