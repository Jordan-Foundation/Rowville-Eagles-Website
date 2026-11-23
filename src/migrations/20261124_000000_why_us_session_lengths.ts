import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Why Us page: session lengths now U5–U7 60 min, U8–U11 75 min, U12+ 90 min (only where the old wording is still there). */
const OLD_LENGTHS = '75 minutes for U5–U11 · 90 minutes for U12+'
const NEW_LENGTHS = '60 minutes for U5–U7 · 75 minutes for U8–U11 · 90 minutes for U12+'
const OLD_MORE = 'Sessions run for 75 minutes for U5–U11 and 90 minutes for U12 and up.'
const NEW_MORE = 'Sessions run for 60 minutes for U5–U7, 75 minutes for U8–U11 and 90 minutes for U12 and up.'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`UPDATE "difference_page" SET "sessions_lengths" = ${NEW_LENGTHS} WHERE "sessions_lengths" = ${OLD_LENGTHS} OR "sessions_lengths" IS NULL`)
  await db.execute(sql`UPDATE "difference_page" SET "sessions_more" = ${NEW_MORE} WHERE "sessions_more" = ${OLD_MORE} OR "sessions_more" IS NULL`)
  await db.execute(sql.raw(`ALTER TABLE "difference_page" ALTER COLUMN "sessions_lengths" SET DEFAULT '${NEW_LENGTHS}'`))
  await db.execute(sql.raw(`ALTER TABLE "difference_page" ALTER COLUMN "sessions_more" SET DEFAULT '${NEW_MORE}'`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`UPDATE "difference_page" SET "sessions_lengths" = ${OLD_LENGTHS} WHERE "sessions_lengths" = ${NEW_LENGTHS}`)
  await db.execute(sql`UPDATE "difference_page" SET "sessions_more" = ${OLD_MORE} WHERE "sessions_more" = ${NEW_MORE}`)
  await db.execute(sql.raw(`ALTER TABLE "difference_page" ALTER COLUMN "sessions_lengths" SET DEFAULT '${OLD_LENGTHS}'`))
  await db.execute(sql.raw(`ALTER TABLE "difference_page" ALTER COLUMN "sessions_more" SET DEFAULT '${OLD_MORE}'`))
}
