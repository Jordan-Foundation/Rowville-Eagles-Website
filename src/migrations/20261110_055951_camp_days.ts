import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "programs_camp_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"start_time" varchar DEFAULT '09:00',
  	"end_time" varchar DEFAULT '15:00'
  );
  
  CREATE TABLE "bookings_camp_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" varchar NOT NULL
  );
  
  ALTER TABLE "programs" ADD COLUMN "full_camp_price" numeric;
  ALTER TABLE "programs" ADD COLUMN "day_price" numeric;
  ALTER TABLE "programs" ADD COLUMN "timeframe_id" integer;
  ALTER TABLE "bookings" ADD COLUMN "full_camp" boolean;
  ALTER TABLE "bookings" ADD COLUMN "keep_with" varchar;
  ALTER TABLE "bookings" ADD COLUMN "player_emergency_relationship" varchar;
  ALTER TABLE "participants" ADD COLUMN "medical_emergency_relationship" varchar;
  ALTER TABLE "programs_camp_days" ADD CONSTRAINT "programs_camp_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings_camp_days" ADD CONSTRAINT "bookings_camp_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "programs_camp_days_order_idx" ON "programs_camp_days" USING btree ("_order");
  CREATE INDEX "programs_camp_days_parent_id_idx" ON "programs_camp_days" USING btree ("_parent_id");
  CREATE INDEX "bookings_camp_days_order_idx" ON "bookings_camp_days" USING btree ("_order");
  CREATE INDEX "bookings_camp_days_parent_id_idx" ON "bookings_camp_days" USING btree ("_parent_id");
  ALTER TABLE "programs" ADD CONSTRAINT "programs_timeframe_id_academy_terms_id_fk" FOREIGN KEY ("timeframe_id") REFERENCES "public"."academy_terms"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "programs_timeframe_idx" ON "programs" USING btree ("timeframe_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE IF EXISTS "programs_camp_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "bookings_camp_days" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "programs_camp_days" CASCADE;
  DROP TABLE IF EXISTS "bookings_camp_days" CASCADE;
  ALTER TABLE "programs" DROP CONSTRAINT IF EXISTS "programs_timeframe_id_academy_terms_id_fk";
  
  DROP INDEX IF EXISTS "programs_timeframe_idx";
  ALTER TABLE "programs" DROP COLUMN IF EXISTS "full_camp_price";
  ALTER TABLE "programs" DROP COLUMN IF EXISTS "day_price";
  ALTER TABLE "programs" DROP COLUMN IF EXISTS "timeframe_id";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "full_camp";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "keep_with";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "player_emergency_relationship";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "medical_emergency_relationship";`)
}
