import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "academy_terms_weekend_start_times" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"time" varchar NOT NULL
  );
  
  CREATE TABLE "academy_availability_away_periods" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"from" timestamp(3) with time zone NOT NULL,
  	"to" timestamp(3) with time zone NOT NULL,
  	"note" varchar
  );
  
  ALTER TABLE "academy_terms_weekend_start_times" ADD CONSTRAINT "academy_terms_weekend_start_times_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_availability_away_periods" ADD CONSTRAINT "academy_availability_away_periods_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_availability"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "academy_terms_weekend_start_times_order_idx" ON "academy_terms_weekend_start_times" USING btree ("_order");
  CREATE INDEX "academy_terms_weekend_start_times_parent_id_idx" ON "academy_terms_weekend_start_times" USING btree ("_parent_id");
  CREATE INDEX "academy_availability_away_periods_order_idx" ON "academy_availability_away_periods" USING btree ("_order");
  CREATE INDEX "academy_availability_away_periods_parent_id_idx" ON "academy_availability_away_periods" USING btree ("_parent_id");

  -- Data: give any existing terms the default weekend hours (8am–5pm, last session starts 4pm)
  INSERT INTO "academy_terms_weekend_start_times" ("_order", "_parent_id", "id", "time")
  SELECT t.ord, terms.id, substr(md5(random()::text || terms.id || t.ord), 1, 24), t.time
  FROM "academy_terms" terms
  CROSS JOIN (VALUES (1, '08:00'), (2, '09:00'), (3, '10:00'), (4, '11:00'), (5, '12:00'), (6, '13:00'), (7, '14:00'), (8, '15:00'), (9, '16:00')) AS t(ord, time)
  WHERE NOT EXISTS (SELECT 1 FROM "academy_terms_weekend_start_times" w WHERE w."_parent_id" = terms.id);
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "academy_terms_weekend_start_times" CASCADE;
  DROP TABLE "academy_availability_away_periods" CASCADE;`)
}
