import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "camp_placements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"program_id" integer NOT NULL,
  	"booking_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"group" numeric NOT NULL,
  	"locked" boolean DEFAULT false,
  	"moved_by_id" integer,
  	"moved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "camp_placements_id" integer;
  ALTER TABLE "academy_settings" ADD COLUMN "camps_group_min" numeric DEFAULT 8;
  ALTER TABLE "academy_settings" ADD COLUMN "camps_group_max" numeric DEFAULT 12;
  ALTER TABLE "camp_placements" ADD CONSTRAINT "camp_placements_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "camp_placements" ADD CONSTRAINT "camp_placements_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "camp_placements" ADD CONSTRAINT "camp_placements_moved_by_id_users_id_fk" FOREIGN KEY ("moved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "camp_placements_program_idx" ON "camp_placements" USING btree ("program_id");
  CREATE UNIQUE INDEX "camp_placements_booking_idx" ON "camp_placements" USING btree ("booking_id");
  CREATE INDEX "camp_placements_moved_by_idx" ON "camp_placements" USING btree ("moved_by_id");
  CREATE INDEX "camp_placements_updated_at_idx" ON "camp_placements" USING btree ("updated_at");
  CREATE INDEX "camp_placements_created_at_idx" ON "camp_placements" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_camp_placements_fk" FOREIGN KEY ("camp_placements_id") REFERENCES "public"."camp_placements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_camp_placements_id_idx" ON "payload_locked_documents_rels" USING btree ("camp_placements_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE IF EXISTS "camp_placements" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "camp_placements" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_camp_placements_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_camp_placements_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "camp_placements_id";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "camps_group_min";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "camps_group_max";`)
}
