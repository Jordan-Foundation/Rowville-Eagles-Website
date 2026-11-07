import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ALTER COLUMN "price" SET DEFAULT 0;
  ALTER TABLE "programs" ADD COLUMN "price_per_session" numeric;
  -- Academy group terms are now priced per session ($25 × sessions left, like 1-on-1 terms)
  UPDATE "programs" SET "price_per_session" = 25 WHERE "type" = 'academy-term';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ALTER COLUMN "price" DROP DEFAULT;
  ALTER TABLE "programs" DROP COLUMN "price_per_session";`)
}
