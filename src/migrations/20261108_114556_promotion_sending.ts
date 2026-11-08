import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_promotions_brand" AS ENUM('academy', 'club');
  ALTER TYPE "public"."enum_promotions_status" ADD VALUE 'scheduled' BEFORE 'live';
  ALTER TABLE "promotions" ADD COLUMN "brand" "enum_promotions_brand" DEFAULT 'academy';
  ALTER TABLE "promotions" ADD COLUMN "cta_path" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "promotions" ALTER COLUMN "status" SET DATA TYPE text;
  UPDATE "promotions" SET "status" = 'draft' WHERE "status" = 'scheduled';
  ALTER TABLE "promotions" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum_promotions_status";
  CREATE TYPE "public"."enum_promotions_status" AS ENUM('draft', 'live', 'ended');
  ALTER TABLE "promotions" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."enum_promotions_status";
  ALTER TABLE "promotions" ALTER COLUMN "status" SET DATA TYPE "public"."enum_promotions_status" USING "status"::"public"."enum_promotions_status";
  ALTER TABLE "promotions" DROP COLUMN "brand";
  ALTER TABLE "promotions" DROP COLUMN "cta_path";
  DROP TYPE "public"."enum_promotions_brand";`)
}
