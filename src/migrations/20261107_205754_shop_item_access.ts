import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_audiences" AS ENUM('everyone', 'rowville', 'rfa', 'foundation-plus');
  CREATE TYPE "public"."enum_products_others_see" AS ENUM('locked', 'hidden');
  CREATE TABLE "products_audiences" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_audiences",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "products" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "products" ADD COLUMN "others_see" "enum_products_others_see" DEFAULT 'locked';
  ALTER TABLE "products_rels" ADD COLUMN "teams_id" integer;
  ALTER TABLE "products_rels" ADD COLUMN "users_id" integer;
  ALTER TABLE "products_audiences" ADD CONSTRAINT "products_audiences_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_audiences_order_idx" ON "products_audiences" USING btree ("order");
  CREATE INDEX "products_audiences_parent_idx" ON "products_audiences" USING btree ("parent_id");
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_teams_fk" FOREIGN KEY ("teams_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_rels_teams_id_idx" ON "products_rels" USING btree ("teams_id");
  CREATE INDEX "products_rels_users_id_idx" ON "products_rels" USING btree ("users_id");
  INSERT INTO "products_audiences" ("order", "parent_id", "value")
    SELECT 1, "id", "audience"::text::"enum_products_audiences" FROM "products";
  ALTER TABLE "products" DROP COLUMN "audience";
  DROP TYPE "public"."enum_products_audience";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_audience" AS ENUM('everyone', 'rowville', 'rfa');

  ALTER TABLE "products_rels" DROP CONSTRAINT IF EXISTS "products_rels_teams_fk";
  
  ALTER TABLE "products_rels" DROP CONSTRAINT IF EXISTS "products_rels_users_fk";
  
  DROP INDEX IF EXISTS "products_rels_teams_id_idx";
  DROP INDEX IF EXISTS "products_rels_users_id_idx";
  UPDATE "products" SET "slug" = 'item-' || "id" WHERE "slug" IS NULL;
  ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "products" ADD COLUMN "audience" "enum_products_audience" DEFAULT 'everyone' NOT NULL;
  UPDATE "products" p SET "audience" = a."value"::text::"enum_products_audience"
    FROM (SELECT DISTINCT ON ("parent_id") "parent_id", "value" FROM "products_audiences" WHERE "value" <> 'foundation-plus' ORDER BY "parent_id", "order") a WHERE a."parent_id" = p."id";
  ALTER TABLE "products_audiences" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_audiences" CASCADE;
  ALTER TABLE "products" DROP COLUMN "others_see";
  ALTER TABLE "products_rels" DROP COLUMN "teams_id";
  ALTER TABLE "products_rels" DROP COLUMN "users_id";
  DROP TYPE "public"."enum_products_audiences";
  DROP TYPE "public"."enum_products_others_see";`)
}
