import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bookings" ADD COLUMN "checkout_group" varchar;
  ALTER TABLE "products" ADD COLUMN "size_guide" varchar;
  ALTER TABLE "users" ADD COLUMN "login_link_hash" varchar;
  ALTER TABLE "users" ADD COLUMN "login_link_expires" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "saved_cart" jsonb;
  CREATE INDEX "bookings_checkout_group_idx" ON "bookings" USING btree ("checkout_group");
  CREATE INDEX "users_login_link_hash_idx" ON "users" USING btree ("login_link_hash");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "bookings_checkout_group_idx";
  DROP INDEX IF EXISTS "users_login_link_hash_idx";
  ALTER TABLE "bookings" DROP COLUMN "checkout_group";
  ALTER TABLE "products" DROP COLUMN "size_guide";
  ALTER TABLE "users" DROP COLUMN "login_link_hash";
  ALTER TABLE "users" DROP COLUMN "login_link_expires";
  ALTER TABLE "users" DROP COLUMN "saved_cart";`)
}
