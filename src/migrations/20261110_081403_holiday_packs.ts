import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_bookings" ADD COLUMN "pack_size" numeric;
  ALTER TABLE "academy_terms" ADD COLUMN "pack_sizes" varchar DEFAULT '3, 5';
  ALTER TABLE "academy_terms" ADD COLUMN "pack_price_per_session" numeric DEFAULT 80;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_bookings" DROP COLUMN IF EXISTS "pack_size";
  ALTER TABLE "academy_terms" DROP COLUMN IF EXISTS "pack_sizes";
  ALTER TABLE "academy_terms" DROP COLUMN IF EXISTS "pack_price_per_session";`)
}
