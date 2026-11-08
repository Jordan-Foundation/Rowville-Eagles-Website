import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_programs_type" ADD VALUE 'toddler' BEFORE 'academy-trial';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "programs" SET "type" = 'academy-term' WHERE "type" = 'toddler';
  ALTER TABLE "programs" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_programs_type";
  CREATE TYPE "public"."enum_programs_type" AS ENUM('registration', 'holiday-camp', 'tournament', 'academy-term', 'academy-trial', 'private-session');
  ALTER TABLE "programs" ALTER COLUMN "type" SET DATA TYPE "public"."enum_programs_type" USING "type"::"public"."enum_programs_type";`)
}
