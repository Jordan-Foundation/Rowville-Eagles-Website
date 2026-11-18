import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_staff_feed_push_status" AS ENUM('none', 'sent', 'held');
  ALTER TABLE "staff_feed" ADD COLUMN "push_status" "enum_staff_feed_push_status" DEFAULT 'none';
  CREATE INDEX "staff_feed_push_status_idx" ON "staff_feed" USING btree ("push_status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "staff_feed_push_status_idx";
  ALTER TABLE "staff_feed" DROP COLUMN IF EXISTS "push_status";
  DROP TYPE IF EXISTS "public"."enum_staff_feed_push_status";`)
}
