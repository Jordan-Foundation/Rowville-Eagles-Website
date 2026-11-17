import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// The Meta "pixel" set earlier (472931888098255) is the club's ad account number, not a pixel. Marketing created the
// real pixel "Rowville Foundation Academy – Website". Only replaced if it's still the wrong number (or empty).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`UPDATE "site_settings" SET "tracking_meta_pixel_id" = '1644331010522223' WHERE "tracking_meta_pixel_id" = '472931888098255' OR "tracking_meta_pixel_id" IS NULL OR "tracking_meta_pixel_id" = '';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`UPDATE "site_settings" SET "tracking_meta_pixel_id" = '472931888098255' WHERE "tracking_meta_pixel_id" = '1644331010522223';`)
}
