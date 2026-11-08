import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "player_reports" ADD COLUMN "approved_at" timestamp(3) with time zone;
  ALTER TABLE "player_reports" ADD COLUMN "released_at" timestamp(3) with time zone;
  CREATE INDEX "player_reports_released_at_idx" ON "player_reports" USING btree ("released_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "player_reports_released_at_idx";
  ALTER TABLE "player_reports" DROP COLUMN "approved_at";
  ALTER TABLE "player_reports" DROP COLUMN "released_at";`)
}
