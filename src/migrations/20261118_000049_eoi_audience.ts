import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_selection_entries_source" AS ENUM('web', 'import', 'admin');
  CREATE TYPE "public"."enum_selection_entries_heard_from" AS ENUM('facebook-instagram-ad', 'google', 'friend-family', 'school', 'rowville-eagles', 'social-post', 'other');
  ALTER TABLE "selection_entries" ADD COLUMN "source" "enum_selection_entries_source" DEFAULT 'web';
  ALTER TABLE "selection_entries" ADD COLUMN "heard_from" "enum_selection_entries_heard_from";
  ALTER TABLE "selection_entries" ADD COLUMN "trial_invited_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "trial_reminder_at" timestamp(3) with time zone;
  CREATE INDEX "selection_entries_source_idx" ON "selection_entries" USING btree ("source");
  CREATE INDEX "selection_entries_heard_from_idx" ON "selection_entries" USING btree ("heard_from");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "selection_entries_source_idx";
  DROP INDEX IF EXISTS "selection_entries_heard_from_idx";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "source";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "heard_from";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "trial_invited_at";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "trial_reminder_at";
  DROP TYPE IF EXISTS "public"."enum_selection_entries_source";
  DROP TYPE IF EXISTS "public"."enum_selection_entries_heard_from";`)
}
