import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "selection_entries" ADD COLUMN "marketing_opt_in" boolean;
  ALTER TABLE "selection_entries" ADD COLUMN "marketing_opt_in_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "marketing_wording" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "marketing_opt_in";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "marketing_opt_in_at";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "marketing_wording";`)
}
