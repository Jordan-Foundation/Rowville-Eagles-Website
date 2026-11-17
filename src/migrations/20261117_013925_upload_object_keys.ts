import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Vercel Blob uploads store each file's storage key here (receipts, WWCC cards) — same fix as media_object_key.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "wwcc_files" ADD COLUMN IF NOT EXISTS "_objectkey" varchar;
  ALTER TABLE "receipt_files" ADD COLUMN IF NOT EXISTS "_objectkey" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "wwcc_files" DROP COLUMN IF EXISTS "_objectkey";
  ALTER TABLE "receipt_files" DROP COLUMN IF EXISTS "_objectkey";`)
}
