import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "selection_entries_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  ALTER TABLE "selection_entries" ADD COLUMN "payment_due_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "paid_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "released_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "booking_id" integer;
  ALTER TABLE "bookings" ADD COLUMN "selection_entry_id" integer;
  ALTER TABLE "selection_entries_numbers" ADD CONSTRAINT "selection_entries_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."selection_entries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "selection_entries_numbers_order_parent_idx" ON "selection_entries_numbers" USING btree ("order","parent_id");
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_selection_entry_id_selection_entries_id_fk" FOREIGN KEY ("selection_entry_id") REFERENCES "public"."selection_entries"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "selection_entries_booking_idx" ON "selection_entries" USING btree ("booking_id");
  CREATE INDEX "bookings_selection_entry_idx" ON "bookings" USING btree ("selection_entry_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "selection_entries_numbers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "selection_entries_numbers" CASCADE;
  ALTER TABLE "selection_entries" DROP CONSTRAINT "selection_entries_booking_id_bookings_id_fk";
  
  ALTER TABLE "bookings" DROP CONSTRAINT "bookings_selection_entry_id_selection_entries_id_fk";
  
  DROP INDEX "selection_entries_booking_idx";
  DROP INDEX "bookings_selection_entry_idx";
  ALTER TABLE "selection_entries" DROP COLUMN "payment_due_at";
  ALTER TABLE "selection_entries" DROP COLUMN "paid_at";
  ALTER TABLE "selection_entries" DROP COLUMN "released_at";
  ALTER TABLE "selection_entries" DROP COLUMN "booking_id";
  ALTER TABLE "bookings" DROP COLUMN "selection_entry_id";`)
}
