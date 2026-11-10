import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_programs_pricing_mode" AS ENUM('per-session', 'per-term');
  ALTER TYPE "public"."enum_programs_type" ADD VALUE 'academy-year' BEFORE 'toddler';
  CREATE TABLE "programs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"programs_id" integer
  );
  
  ALTER TABLE "academy_registrations" ADD COLUMN "full_year" boolean DEFAULT false;
  ALTER TABLE "programs" ADD COLUMN "pricing_mode" "enum_programs_pricing_mode" DEFAULT 'per-session';
  ALTER TABLE "programs" ADD COLUMN "term_price" numeric;
  ALTER TABLE "programs" ADD COLUMN "discount_pct" numeric DEFAULT 10;
  ALTER TABLE "academy_settings" ADD COLUMN "club_registration_fee" numeric DEFAULT 950;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_rels" ADD CONSTRAINT "programs_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "programs_rels_order_idx" ON "programs_rels" USING btree ("order");
  CREATE INDEX "programs_rels_parent_idx" ON "programs_rels" USING btree ("parent_id");
  CREATE INDEX "programs_rels_path_idx" ON "programs_rels" USING btree ("path");
  CREATE INDEX "programs_rels_programs_id_idx" ON "programs_rels" USING btree ("programs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "programs_rels" CASCADE;
  DELETE FROM "programs" WHERE "type" = 'academy-year';
  ALTER TABLE "programs" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_programs_type";
  CREATE TYPE "public"."enum_programs_type" AS ENUM('registration', 'holiday-camp', 'tournament', 'academy-term', 'toddler', 'community', 'academy-trial', 'private-session');
  ALTER TABLE "programs" ALTER COLUMN "type" SET DATA TYPE "public"."enum_programs_type" USING "type"::"public"."enum_programs_type";
  ALTER TABLE "academy_registrations" DROP COLUMN IF EXISTS "full_year";
  ALTER TABLE "programs" DROP COLUMN IF EXISTS "pricing_mode";
  ALTER TABLE "programs" DROP COLUMN IF EXISTS "term_price";
  ALTER TABLE "programs" DROP COLUMN IF EXISTS "discount_pct";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "club_registration_fee";
  DROP TYPE IF EXISTS "public"."enum_programs_pricing_mode";`)
}
