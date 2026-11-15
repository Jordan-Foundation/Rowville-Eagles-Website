import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Vercel Blob uploads store each file's storage key here (see the _objectKey field on Media).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "_objectkey" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP COLUMN IF EXISTS "_objectkey";`)
}
