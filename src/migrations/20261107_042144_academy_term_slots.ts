import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_term_slots_weekday" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TYPE "public"."enum_academy_registrations_status" AS ENUM('interest', 'offered', 'pending_payment', 'paid', 'cancelled');
  CREATE TABLE "academy_term_slots_groups" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "academy_term_slots_exceptions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"cancelled" boolean,
  	"start_time" varchar,
  	"end_time" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "academy_term_slots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"program_id" integer NOT NULL,
  	"weekday" "enum_academy_term_slots_weekday" NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL,
  	"venue" varchar,
  	"capacity" numeric,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "academy_term_slots_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  CREATE TABLE "academy_term_slots_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"academy_coaches_id" integer
  );
  
  CREATE TABLE "academy_registrations_moves" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"from" varchar,
  	"to" varchar,
  	"reason" varchar,
  	"by_id" integer,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "academy_registrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar,
  	"reference" varchar,
  	"status" "enum_academy_registrations_status" DEFAULT 'interest' NOT NULL,
  	"program_id" integer NOT NULL,
  	"slot_id" integer,
  	"group_id" varchar,
  	"birth_year" numeric,
  	"playing_birth_year" numeric,
  	"amount" numeric,
  	"contact_first_name" varchar NOT NULL,
  	"contact_last_name" varchar NOT NULL,
  	"contact_email" varchar NOT NULL,
  	"contact_phone" varchar NOT NULL,
  	"player_first_name" varchar NOT NULL,
  	"player_last_name" varchar NOT NULL,
  	"player_date_of_birth" timestamp(3) with time zone NOT NULL,
  	"player_medical" varchar,
  	"player_emergency_name" varchar,
  	"player_emergency_phone" varchar,
  	"player_photo_consent" boolean,
  	"account_id" integer,
  	"participant_id" integer,
  	"booking_id" integer,
  	"offered_at" timestamp(3) with time zone,
  	"offer_expires_at" timestamp(3) with time zone,
  	"paid_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"token" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "bookings" ADD COLUMN "academy_registration_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_term_slots_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_registrations_id" integer;
  ALTER TABLE "academy_term_slots_groups" ADD CONSTRAINT "academy_term_slots_groups_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_term_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_term_slots_exceptions" ADD CONSTRAINT "academy_term_slots_exceptions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_term_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_term_slots" ADD CONSTRAINT "academy_term_slots_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_term_slots_numbers" ADD CONSTRAINT "academy_term_slots_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."academy_term_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_term_slots_rels" ADD CONSTRAINT "academy_term_slots_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."academy_term_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_term_slots_rels" ADD CONSTRAINT "academy_term_slots_rels_academy_coaches_fk" FOREIGN KEY ("academy_coaches_id") REFERENCES "public"."academy_coaches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_registrations_moves" ADD CONSTRAINT "academy_registrations_moves_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_registrations_moves" ADD CONSTRAINT "academy_registrations_moves_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_registrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_registrations" ADD CONSTRAINT "academy_registrations_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_registrations" ADD CONSTRAINT "academy_registrations_slot_id_academy_term_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."academy_term_slots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_registrations" ADD CONSTRAINT "academy_registrations_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_registrations" ADD CONSTRAINT "academy_registrations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_registrations" ADD CONSTRAINT "academy_registrations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "academy_term_slots_groups_order_idx" ON "academy_term_slots_groups" USING btree ("_order");
  CREATE INDEX "academy_term_slots_groups_parent_id_idx" ON "academy_term_slots_groups" USING btree ("_parent_id");
  CREATE INDEX "academy_term_slots_exceptions_order_idx" ON "academy_term_slots_exceptions" USING btree ("_order");
  CREATE INDEX "academy_term_slots_exceptions_parent_id_idx" ON "academy_term_slots_exceptions" USING btree ("_parent_id");
  CREATE INDEX "academy_term_slots_program_idx" ON "academy_term_slots" USING btree ("program_id");
  CREATE INDEX "academy_term_slots_updated_at_idx" ON "academy_term_slots" USING btree ("updated_at");
  CREATE INDEX "academy_term_slots_created_at_idx" ON "academy_term_slots" USING btree ("created_at");
  CREATE INDEX "academy_term_slots_numbers_order_parent_idx" ON "academy_term_slots_numbers" USING btree ("order","parent_id");
  CREATE INDEX "academy_term_slots_rels_order_idx" ON "academy_term_slots_rels" USING btree ("order");
  CREATE INDEX "academy_term_slots_rels_parent_idx" ON "academy_term_slots_rels" USING btree ("parent_id");
  CREATE INDEX "academy_term_slots_rels_path_idx" ON "academy_term_slots_rels" USING btree ("path");
  CREATE INDEX "academy_term_slots_rels_academy_coaches_id_idx" ON "academy_term_slots_rels" USING btree ("academy_coaches_id");
  CREATE INDEX "academy_registrations_moves_order_idx" ON "academy_registrations_moves" USING btree ("_order");
  CREATE INDEX "academy_registrations_moves_parent_id_idx" ON "academy_registrations_moves" USING btree ("_parent_id");
  CREATE INDEX "academy_registrations_moves_by_idx" ON "academy_registrations_moves" USING btree ("by_id");
  CREATE UNIQUE INDEX "academy_registrations_reference_idx" ON "academy_registrations" USING btree ("reference");
  CREATE INDEX "academy_registrations_status_idx" ON "academy_registrations" USING btree ("status");
  CREATE INDEX "academy_registrations_program_idx" ON "academy_registrations" USING btree ("program_id");
  CREATE INDEX "academy_registrations_slot_idx" ON "academy_registrations" USING btree ("slot_id");
  CREATE INDEX "academy_registrations_birth_year_idx" ON "academy_registrations" USING btree ("birth_year");
  CREATE INDEX "academy_registrations_contact_contact_email_idx" ON "academy_registrations" USING btree ("contact_email");
  CREATE INDEX "academy_registrations_account_idx" ON "academy_registrations" USING btree ("account_id");
  CREATE INDEX "academy_registrations_participant_idx" ON "academy_registrations" USING btree ("participant_id");
  CREATE INDEX "academy_registrations_booking_idx" ON "academy_registrations" USING btree ("booking_id");
  CREATE INDEX "academy_registrations_updated_at_idx" ON "academy_registrations" USING btree ("updated_at");
  CREATE INDEX "academy_registrations_created_at_idx" ON "academy_registrations" USING btree ("created_at");
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_academy_registration_id_academy_registrations_id_fk" FOREIGN KEY ("academy_registration_id") REFERENCES "public"."academy_registrations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_term_slots_fk" FOREIGN KEY ("academy_term_slots_id") REFERENCES "public"."academy_term_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_registrations_fk" FOREIGN KEY ("academy_registrations_id") REFERENCES "public"."academy_registrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "bookings_academy_registration_idx" ON "bookings" USING btree ("academy_registration_id");
  CREATE INDEX "payload_locked_documents_rels_academy_term_slots_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_term_slots_id");
  CREATE INDEX "payload_locked_documents_rels_academy_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_registrations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_term_slots_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_term_slots_exceptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_term_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_term_slots_numbers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_term_slots_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_registrations_moves" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_registrations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "academy_term_slots_groups" CASCADE;
  DROP TABLE "academy_term_slots_exceptions" CASCADE;
  DROP TABLE "academy_term_slots" CASCADE;
  DROP TABLE "academy_term_slots_numbers" CASCADE;
  DROP TABLE "academy_term_slots_rels" CASCADE;
  DROP TABLE "academy_registrations_moves" CASCADE;
  DROP TABLE "academy_registrations" CASCADE;
  ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_academy_registration_id_academy_registrations_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_academy_term_slots_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_academy_registrations_fk";
  
  DROP INDEX IF EXISTS "bookings_academy_registration_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_academy_term_slots_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_academy_registrations_id_idx";
  ALTER TABLE "bookings" DROP COLUMN "academy_registration_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_term_slots_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_registrations_id";
  DROP TYPE "public"."enum_academy_term_slots_weekday";
  DROP TYPE "public"."enum_academy_registrations_status";`)
}
