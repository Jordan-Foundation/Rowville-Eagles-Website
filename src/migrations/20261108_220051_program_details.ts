import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ADD COLUMN "min_age" numeric;
  ALTER TABLE "programs" ADD COLUMN "max_age" numeric;
  ALTER TABLE "programs" ADD COLUMN "drop_off_pick_up" varchar;
  ALTER TABLE "programs" ADD COLUMN "what_to_bring" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" DROP COLUMN "min_age";
  ALTER TABLE "programs" DROP COLUMN "max_age";
  ALTER TABLE "programs" DROP COLUMN "drop_off_pick_up";
  ALTER TABLE "programs" DROP COLUMN "what_to_bring";`)
}
