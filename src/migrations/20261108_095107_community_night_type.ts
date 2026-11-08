import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_programs_type" ADD VALUE 'community' BEFORE 'academy-trial';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DELETE FROM "programs" WHERE "type" = 'community';
  ALTER TABLE "programs" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_programs_type";
  CREATE TYPE "public"."enum_programs_type" AS ENUM('registration', 'holiday-camp', 'tournament', 'academy-term', 'toddler', 'academy-trial', 'private-session');
  ALTER TABLE "programs" ALTER COLUMN "type" SET DATA TYPE "public"."enum_programs_type" USING "type"::"public"."enum_programs_type";`)
}
