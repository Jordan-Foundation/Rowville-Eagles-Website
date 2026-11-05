import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "trial_registrations" ALTER COLUMN "reference" DROP NOT NULL;
  ALTER TABLE "bookings" ALTER COLUMN "reference" DROP NOT NULL;
  ALTER TABLE "orders" ALTER COLUMN "reference" DROP NOT NULL;
  ALTER TABLE "trial_registrations" ADD COLUMN "display_name" varchar;

  -- Data: give existing records a readable title in the admin
  UPDATE "trial_registrations"
  SET "display_name" = trim(coalesce("player_first_name", '') || ' ' || coalesce("player_last_name", '')) || coalesce(' (' || "age_group"::text || ')', '')
  WHERE "display_name" IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "trial_registrations" ALTER COLUMN "reference" SET NOT NULL;
  ALTER TABLE "bookings" ALTER COLUMN "reference" SET NOT NULL;
  ALTER TABLE "orders" ALTER COLUMN "reference" SET NOT NULL;
  ALTER TABLE "trial_registrations" DROP COLUMN "display_name";`)
}
