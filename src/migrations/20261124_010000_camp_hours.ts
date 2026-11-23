import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Holiday camps run 9am–3:30pm: camp days, the schedule note and the pick-up time all say so. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`UPDATE "programs_camp_days" SET "end_time" = '15:30' WHERE "end_time" = '15:00' AND "_parent_id" IN (SELECT "id" FROM "programs" WHERE "type" = 'holiday-camp')`)
  await db.execute(sql.raw(`ALTER TABLE "programs_camp_days" ALTER COLUMN "end_time" SET DEFAULT '15:30'`))
  await db.execute(sql`UPDATE "programs" SET "schedule_note" = replace("schedule_note", '9am–3pm', '9am–3:30pm') WHERE "type" = 'holiday-camp' AND "schedule_note" LIKE '%9am–3pm%'`)
  await db.execute(sql`UPDATE "programs" SET "drop_off_pick_up" = replace(replace("drop_off_pick_up", 'Pick-up by 3:15pm', 'Pick-up at 3:30pm'), 'pick-up by 3:15pm', 'pick-up at 3:30pm') WHERE "type" = 'holiday-camp' AND "drop_off_pick_up" ILIKE '%pick-up by 3:15pm%'`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "programs_camp_days" ALTER COLUMN "end_time" SET DEFAULT '15:00'`))
  await db.execute(sql`UPDATE "programs" SET "drop_off_pick_up" = replace(replace("drop_off_pick_up", 'Pick-up at 3:30pm', 'Pick-up by 3:15pm'), 'pick-up at 3:30pm', 'pick-up by 3:15pm') WHERE "type" = 'holiday-camp'`)
  await db.execute(sql`UPDATE "programs" SET "schedule_note" = replace("schedule_note", '9am–3:30pm', '9am–3pm') WHERE "type" = 'holiday-camp'`)
}
