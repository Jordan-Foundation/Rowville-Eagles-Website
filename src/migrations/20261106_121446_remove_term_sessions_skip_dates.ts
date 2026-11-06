import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_terms_skip_dates" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "academy_terms_skip_dates" CASCADE;
  ALTER TABLE "academy_terms" ALTER COLUMN "end_date" SET NOT NULL;
  ALTER TABLE "academy_terms" DROP COLUMN "sessions";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "academy_terms_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"reason" varchar
  );
  
  ALTER TABLE "academy_terms" ALTER COLUMN "end_date" DROP NOT NULL;
  ALTER TABLE "academy_terms" ADD COLUMN "sessions" numeric DEFAULT 10 NOT NULL;
  ALTER TABLE "academy_terms_skip_dates" ADD CONSTRAINT "academy_terms_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_terms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "academy_terms_skip_dates_order_idx" ON "academy_terms_skip_dates" USING btree ("_order");
  CREATE INDEX "academy_terms_skip_dates_parent_id_idx" ON "academy_terms_skip_dates" USING btree ("_parent_id");`)
}
