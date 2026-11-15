import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_bookings_heard_from" AS ENUM('facebook-instagram-ad', 'google', 'friend-family', 'school', 'rowville-eagles', 'social-post', 'other');
  CREATE TYPE "public"."enum_bookings_heard_from" AS ENUM('facebook-instagram-ad', 'google', 'friend-family', 'school', 'rowville-eagles', 'social-post', 'other');
  ALTER TABLE "academy_bookings" ADD COLUMN "heard_from" "enum_academy_bookings_heard_from";
  ALTER TABLE "bookings" ADD COLUMN "heard_from" "enum_bookings_heard_from";
  ALTER TABLE "site_settings" ADD COLUMN "tracking_meta_pixel_id" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "tracking_google_tag_ids" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "tracking_ads_lead_label" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "tracking_ads_purchase_label" varchar;
  CREATE INDEX "academy_bookings_heard_from_idx" ON "academy_bookings" USING btree ("heard_from");
  CREATE INDEX "bookings_heard_from_idx" ON "bookings" USING btree ("heard_from");`)
  // The club's Meta Pixel (from marketing). Only runs on the live site; change or clear it in Admin → Site settings.
  await db.execute(sql`UPDATE "site_settings" SET "tracking_meta_pixel_id" = '472931888098255' WHERE "tracking_meta_pixel_id" IS NULL;`)
  // and its Google Analytics tag
  await db.execute(sql`UPDATE "site_settings" SET "tracking_google_tag_ids" = 'G-LNTSLNVKT7' WHERE "tracking_google_tag_ids" IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "academy_bookings_heard_from_idx";
  DROP INDEX IF EXISTS "bookings_heard_from_idx";
  ALTER TABLE "academy_bookings" DROP COLUMN IF EXISTS "heard_from";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "heard_from";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "tracking_meta_pixel_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "tracking_google_tag_ids";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "tracking_ads_lead_label";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "tracking_ads_purchase_label";
  DROP TYPE IF EXISTS "public"."enum_academy_bookings_heard_from";
  DROP TYPE IF EXISTS "public"."enum_bookings_heard_from";`)
}
