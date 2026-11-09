import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_group_invites" ADD COLUMN "alt_token_hash" varchar;
  CREATE INDEX "academy_group_invites_alt_token_hash_idx" ON "academy_group_invites" USING btree ("alt_token_hash");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "academy_group_invites_alt_token_hash_idx";
  ALTER TABLE "academy_group_invites" DROP COLUMN IF EXISTS "alt_token_hash";`)
}
