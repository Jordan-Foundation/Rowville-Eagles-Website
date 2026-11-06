import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_bookings_status" AS ENUM('held', 'confirmed', 'payment_failed', 'cancelled', 'refunded', 'expired', 'completed');
  CREATE TYPE "public"."enum_academy_bookings_type" AS ENUM('casual', 'term');
  CREATE TYPE "public"."enum_academy_bookings_payment_mode" AS ENUM('casual', 'upfront', 'weekly');
  CREATE TYPE "public"."enum_academy_bookings_weekday" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TYPE "public"."enum_academy_bookings_source" AS ENUM('web', 'coach-link', 'admin');
  CREATE TYPE "public"."enum_academy_sessions_status" AS ENUM('held', 'scheduled', 'completed', 'no_show', 'cancelled');
  CREATE TABLE "academy_bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"status" "enum_academy_bookings_status" DEFAULT 'held' NOT NULL,
  	"type" "enum_academy_bookings_type" NOT NULL,
  	"payment_mode" "enum_academy_bookings_payment_mode" NOT NULL,
  	"amount" numeric NOT NULL,
  	"sessions_total" numeric DEFAULT 1,
  	"sessions_paid" numeric DEFAULT 0,
  	"coach_id" integer NOT NULL,
  	"term_id" integer NOT NULL,
  	"weekday" "enum_academy_bookings_weekday",
  	"start_time" varchar,
  	"first_session_at" timestamp(3) with time zone,
  	"hold_expires_at" timestamp(3) with time zone,
  	"contact_first_name" varchar NOT NULL,
  	"contact_last_name" varchar NOT NULL,
  	"contact_email" varchar NOT NULL,
  	"contact_mobile" varchar NOT NULL,
  	"player_first_name" varchar NOT NULL,
  	"player_last_name" varchar NOT NULL,
  	"player_date_of_birth" timestamp(3) with time zone NOT NULL,
  	"player_current_club" varchar,
  	"player_position" varchar,
  	"player_goals" varchar,
  	"player_medical" varchar,
  	"player_emergency_name" varchar NOT NULL,
  	"player_emergency_phone" varchar NOT NULL,
  	"player_photo_consent" boolean,
  	"account_id" integer,
  	"participant_id" integer,
  	"marketing_opt_in" boolean,
  	"source" "enum_academy_bookings_source" DEFAULT 'web',
  	"stripe_checkout_id" varchar,
  	"stripe_subscription_id" varchar,
  	"organisation" varchar DEFAULT 'rowville',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "academy_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"booking_id" integer NOT NULL,
  	"coach_id" integer NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"status" "enum_academy_sessions_status" DEFAULT 'held' NOT NULL,
  	"account_id" integer,
  	"needs_cover" boolean DEFAULT false,
  	"cover_coach_id" integer,
  	"cover_note" varchar,
  	"paid" boolean DEFAULT false,
  	"reminder_sent_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "academy_terms" ALTER COLUMN "hold_minutes" SET DEFAULT 30;
  ALTER TABLE "academy_terms" ADD COLUMN "location" varchar DEFAULT '208 Dandelion Drive, Rowville VIC 3178';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_bookings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_sessions_id" integer;
  ALTER TABLE "academy_bookings" ADD CONSTRAINT "academy_bookings_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_bookings" ADD CONSTRAINT "academy_bookings_term_id_academy_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academy_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_bookings" ADD CONSTRAINT "academy_bookings_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_bookings" ADD CONSTRAINT "academy_bookings_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_sessions" ADD CONSTRAINT "academy_sessions_booking_id_academy_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."academy_bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_sessions" ADD CONSTRAINT "academy_sessions_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_sessions" ADD CONSTRAINT "academy_sessions_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_sessions" ADD CONSTRAINT "academy_sessions_cover_coach_id_academy_coaches_id_fk" FOREIGN KEY ("cover_coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "academy_bookings_reference_idx" ON "academy_bookings" USING btree ("reference");
  CREATE INDEX "academy_bookings_coach_idx" ON "academy_bookings" USING btree ("coach_id");
  CREATE INDEX "academy_bookings_term_idx" ON "academy_bookings" USING btree ("term_id");
  CREATE INDEX "academy_bookings_account_idx" ON "academy_bookings" USING btree ("account_id");
  CREATE INDEX "academy_bookings_participant_idx" ON "academy_bookings" USING btree ("participant_id");
  CREATE INDEX "academy_bookings_updated_at_idx" ON "academy_bookings" USING btree ("updated_at");
  CREATE INDEX "academy_bookings_created_at_idx" ON "academy_bookings" USING btree ("created_at");
  CREATE INDEX "academy_sessions_booking_idx" ON "academy_sessions" USING btree ("booking_id");
  CREATE INDEX "academy_sessions_coach_idx" ON "academy_sessions" USING btree ("coach_id");
  CREATE INDEX "academy_sessions_starts_at_idx" ON "academy_sessions" USING btree ("starts_at");
  CREATE INDEX "academy_sessions_account_idx" ON "academy_sessions" USING btree ("account_id");
  CREATE INDEX "academy_sessions_needs_cover_idx" ON "academy_sessions" USING btree ("needs_cover");
  CREATE INDEX "academy_sessions_cover_coach_idx" ON "academy_sessions" USING btree ("cover_coach_id");
  CREATE INDEX "academy_sessions_updated_at_idx" ON "academy_sessions" USING btree ("updated_at");
  CREATE INDEX "academy_sessions_created_at_idx" ON "academy_sessions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_bookings_fk" FOREIGN KEY ("academy_bookings_id") REFERENCES "public"."academy_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_sessions_fk" FOREIGN KEY ("academy_sessions_id") REFERENCES "public"."academy_sessions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_academy_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_bookings_id");
  CREATE INDEX "payload_locked_documents_rels_academy_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_sessions_id");

  -- A coach can never be double-booked: one live (non-cancelled) session per coach per start time.
  -- Enforced by the database itself, so two families paying at the same instant can't both get the slot.
  CREATE UNIQUE INDEX "academy_sessions_coach_start_live" ON "academy_sessions" ("coach_id", "starts_at") WHERE "status" <> 'cancelled';
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "academy_sessions_coach_start_live";
   ALTER TABLE "academy_bookings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_sessions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "academy_bookings" CASCADE;
  DROP TABLE "academy_sessions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_academy_bookings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_academy_sessions_fk";
  
  DROP INDEX "payload_locked_documents_rels_academy_bookings_id_idx";
  DROP INDEX "payload_locked_documents_rels_academy_sessions_id_idx";
  ALTER TABLE "academy_terms" ALTER COLUMN "hold_minutes" SET DEFAULT 15;
  ALTER TABLE "academy_terms" DROP COLUMN "location";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_bookings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_sessions_id";
  DROP TYPE "public"."enum_academy_bookings_status";
  DROP TYPE "public"."enum_academy_bookings_type";
  DROP TYPE "public"."enum_academy_bookings_payment_mode";
  DROP TYPE "public"."enum_academy_bookings_weekday";
  DROP TYPE "public"."enum_academy_bookings_source";
  DROP TYPE "public"."enum_academy_sessions_status";`)
}
