import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_year_setups_holidays_period" AS ENUM('summer', 'april', 'mid-year', 'september');
  CREATE TYPE "public"."enum_year_setups_status" AS ENUM('draft', 'published');
  CREATE TABLE "year_setups_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start" varchar,
  	"end" varchar,
  	"deadline" varchar
  );
  
  CREATE TABLE "year_setups_holidays" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"period" "enum_year_setups_holidays_period",
  	"start" varchar,
  	"end" varchar,
  	"deadline" varchar
  );
  
  CREATE TABLE "year_setups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric NOT NULL,
  	"status" "enum_year_setups_status" DEFAULT 'draft' NOT NULL,
  	"term1_opens_at" timestamp(3) with time zone,
  	"published_at" timestamp(3) with time zone,
  	"published_by_id" integer,
  	"reminder_sent_at" timestamp(3) with time zone,
  	"results" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "year_setups_id" integer;
  ALTER TABLE "year_setups_terms" ADD CONSTRAINT "year_setups_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."year_setups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "year_setups_holidays" ADD CONSTRAINT "year_setups_holidays_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."year_setups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "year_setups" ADD CONSTRAINT "year_setups_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "year_setups_terms_order_idx" ON "year_setups_terms" USING btree ("_order");
  CREATE INDEX "year_setups_terms_parent_id_idx" ON "year_setups_terms" USING btree ("_parent_id");
  CREATE INDEX "year_setups_holidays_order_idx" ON "year_setups_holidays" USING btree ("_order");
  CREATE INDEX "year_setups_holidays_parent_id_idx" ON "year_setups_holidays" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "year_setups_year_idx" ON "year_setups" USING btree ("year");
  CREATE INDEX "year_setups_published_by_idx" ON "year_setups" USING btree ("published_by_id");
  CREATE INDEX "year_setups_updated_at_idx" ON "year_setups" USING btree ("updated_at");
  CREATE INDEX "year_setups_created_at_idx" ON "year_setups" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_year_setups_fk" FOREIGN KEY ("year_setups_id") REFERENCES "public"."year_setups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_year_setups_id_idx" ON "payload_locked_documents_rels" USING btree ("year_setups_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE IF EXISTS "year_setups_terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "year_setups_holidays" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "year_setups" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "year_setups_terms" CASCADE;
  DROP TABLE IF EXISTS "year_setups_holidays" CASCADE;
  DROP TABLE IF EXISTS "year_setups" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_year_setups_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_year_setups_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "year_setups_id";
  DROP TYPE IF EXISTS "public"."enum_year_setups_holidays_period";
  DROP TYPE IF EXISTS "public"."enum_year_setups_status";`)
}
