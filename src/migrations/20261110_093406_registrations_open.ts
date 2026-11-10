import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ADD COLUMN "opens_at" timestamp(3) with time zone;
  ALTER TABLE "programs" ADD COLUMN "auto_open" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" DROP COLUMN IF EXISTS "opens_at";
  ALTER TABLE "programs" DROP COLUMN IF EXISTS "auto_open";`)
}
