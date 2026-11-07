import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_registrations_nights" AS ENUM('1', '2');
  ALTER TABLE "programs" ALTER COLUMN "price" DROP NOT NULL;
  ALTER TABLE "academy_registrations" ADD COLUMN "nights" "enum_academy_registrations_nights" DEFAULT '1';
  ALTER TABLE "academy_registrations" ADD COLUMN "paired_with_id" integer;
  ALTER TABLE "programs" ADD COLUMN "two_night_price_per_session" numeric;
  ALTER TABLE "academy_registrations" ADD CONSTRAINT "academy_registrations_paired_with_id_academy_registrations_id_fk" FOREIGN KEY ("paired_with_id") REFERENCES "public"."academy_registrations"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "academy_registrations_paired_with_idx" ON "academy_registrations" USING btree ("paired_with_id");
  -- 2 nights a week at $20 per session for existing Academy term programs
  UPDATE "programs" SET "two_night_price_per_session" = 20 WHERE "type" = 'academy-term';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_registrations" DROP CONSTRAINT IF EXISTS "academy_registrations_paired_with_id_academy_registrations_id_fk";
  
  DROP INDEX IF EXISTS "academy_registrations_paired_with_idx";
  UPDATE "programs" SET "price" = 0 WHERE "price" IS NULL;
  ALTER TABLE "programs" ALTER COLUMN "price" SET NOT NULL;
  ALTER TABLE "academy_registrations" DROP COLUMN "nights";
  ALTER TABLE "academy_registrations" DROP COLUMN "paired_with_id";
  ALTER TABLE "programs" DROP COLUMN "two_night_price_per_session";
  DROP TYPE "public"."enum_academy_registrations_nights";`)
}
