import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_terms_period" AS ENUM('term-1', 'term-2', 'term-3', 'term-4', 'summer', 'april', 'mid-year', 'september');
  CREATE TYPE "public"."enum_academy_terms_category" AS ENUM('school-term', 'school-holidays');
  ALTER TABLE "academy_terms" ADD COLUMN "period" "enum_academy_terms_period";
  ALTER TABLE "academy_terms" ADD COLUMN "category" "enum_academy_terms_category" DEFAULT 'school-term' NOT NULL;
  ALTER TABLE "academy_terms" ADD COLUMN "year" numeric;
  CREATE INDEX "academy_terms_category_idx" ON "academy_terms" USING btree ("category");
  CREATE INDEX "academy_terms_year_idx" ON "academy_terms" USING btree ("year");`)
  // Existing timeframes are all school terms: work out which term from the name ("Term 2 2027" → term-2)
  // and the year from the start date (Sydney time)
  await db.execute(sql`
  UPDATE "academy_terms" SET "period" = ('term-' || substring(lower("name") from '(?:^|[^a-z])(?:term|t)\\s*([1-4])(?:[^0-9]|$)'))::"enum_academy_terms_period"
    WHERE "period" IS NULL AND lower("name") ~ '(^|[^a-z])(term|t)\\s*[1-4]([^0-9]|$)';
  UPDATE "academy_terms" SET "year" = extract(year from ("start_date" AT TIME ZONE 'Australia/Sydney'))
    WHERE "year" IS NULL AND "start_date" IS NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "academy_terms_category_idx";
  DROP INDEX IF EXISTS "academy_terms_year_idx";
  ALTER TABLE "academy_terms" DROP COLUMN IF EXISTS "period";
  ALTER TABLE "academy_terms" DROP COLUMN IF EXISTS "category";
  ALTER TABLE "academy_terms" DROP COLUMN IF EXISTS "year";
  DROP TYPE IF EXISTS "public"."enum_academy_terms_period";
  DROP TYPE IF EXISTS "public"."enum_academy_terms_category";`)
}
