import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_bookings_kind" AS ENUM('one-on-one', 'group');
  CREATE TYPE "public"."enum_academy_sessions_kind" AS ENUM('one-on-one', 'group-player', 'group-slot');
  CREATE TYPE "public"."enum_academy_groups_status" AS ENUM('forming', 'confirmed', 'shortfall', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_academy_groups_type" AS ENUM('casual', 'term');
  CREATE TYPE "public"."enum_academy_groups_weekday" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TYPE "public"."enum_academy_groups_term_offer_status" AS ENUM('none', 'proposed', 'accepted', 'declined', 'expired');
  CREATE TYPE "public"."enum_academy_group_invites_status" AS ENUM('invited', 'paid', 'weekly', 'overdue', 'declined', 'removed');
  CREATE TYPE "public"."enum_academy_group_invites_term_answer" AS ENUM('pending', 'accepted', 'declined');
  CREATE TYPE "public"."enum_academy_credits_scope" AS ENUM('any', 'group');
  CREATE TABLE "academy_groups_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"by_id" integer,
  	"action" varchar NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "academy_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"status" "enum_academy_groups_status" DEFAULT 'forming' NOT NULL,
  	"type" "enum_academy_groups_type" NOT NULL,
  	"coach_id" integer NOT NULL,
  	"term_id" integer NOT NULL,
  	"weekday" "enum_academy_groups_weekday",
  	"start_time" varchar,
  	"first_session_at" timestamp(3) with time zone NOT NULL,
  	"planned_size" numeric NOT NULL,
  	"pricing_size" numeric NOT NULL,
  	"rate_per_player" numeric NOT NULL,
  	"sessions_total" numeric NOT NULL,
  	"payment_deadline" timestamp(3) with time zone,
  	"reminder_sent_at" timestamp(3) with time zone,
  	"term_offer_status" "enum_academy_groups_term_offer_status" DEFAULT 'none',
  	"term_offer_proposed_by_id" integer,
  	"term_offer_deadline" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "academy_group_invites" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"group_id" integer NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"status" "enum_academy_group_invites_status" DEFAULT 'invited' NOT NULL,
  	"participant_id" integer,
  	"account_id" integer,
  	"invitee_player_first_name" varchar NOT NULL,
  	"invitee_player_last_name" varchar NOT NULL,
  	"invitee_parent_first_name" varchar NOT NULL,
  	"invitee_parent_last_name" varchar NOT NULL,
  	"invitee_email" varchar NOT NULL,
  	"invitee_mobile" varchar,
  	"rate_locked" numeric NOT NULL,
  	"booking_id" integer,
  	"sent_email" boolean,
  	"sent_sms" boolean,
  	"opened_at" timestamp(3) with time zone,
  	"reminded_at" timestamp(3) with time zone,
  	"term_answer" "enum_academy_group_invites_term_answer" DEFAULT 'pending',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "academy_sessions" ALTER COLUMN "booking_id" DROP NOT NULL;
  ALTER TABLE "academy_bookings" ADD COLUMN "kind" "enum_academy_bookings_kind" DEFAULT 'one-on-one' NOT NULL;
  ALTER TABLE "academy_bookings" ADD COLUMN "group_id" integer;
  ALTER TABLE "academy_bookings" ADD COLUMN "group_invite_id" integer;
  ALTER TABLE "academy_bookings" ADD COLUMN "group_size" numeric;
  ALTER TABLE "academy_bookings" ADD COLUMN "group_week1_credit" numeric;
  ALTER TABLE "academy_sessions" ADD COLUMN "kind" "enum_academy_sessions_kind" DEFAULT 'one-on-one' NOT NULL;
  ALTER TABLE "academy_sessions" ADD COLUMN "group_id" integer;
  ALTER TABLE "academy_credits" ADD COLUMN "scope" "enum_academy_credits_scope" DEFAULT 'any' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_groups_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_group_invites_id" integer;
  ALTER TABLE "academy_groups_history" ADD CONSTRAINT "academy_groups_history_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_groups_history" ADD CONSTRAINT "academy_groups_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_groups" ADD CONSTRAINT "academy_groups_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_groups" ADD CONSTRAINT "academy_groups_term_id_academy_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academy_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_groups" ADD CONSTRAINT "academy_groups_term_offer_proposed_by_id_academy_group_invites_id_fk" FOREIGN KEY ("term_offer_proposed_by_id") REFERENCES "public"."academy_group_invites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_groups" ADD CONSTRAINT "academy_groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_group_invites" ADD CONSTRAINT "academy_group_invites_group_id_academy_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."academy_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_group_invites" ADD CONSTRAINT "academy_group_invites_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_group_invites" ADD CONSTRAINT "academy_group_invites_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_group_invites" ADD CONSTRAINT "academy_group_invites_booking_id_academy_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."academy_bookings"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "academy_groups_history_order_idx" ON "academy_groups_history" USING btree ("_order");
  CREATE INDEX "academy_groups_history_parent_id_idx" ON "academy_groups_history" USING btree ("_parent_id");
  CREATE INDEX "academy_groups_history_by_idx" ON "academy_groups_history" USING btree ("by_id");
  CREATE UNIQUE INDEX "academy_groups_reference_idx" ON "academy_groups" USING btree ("reference");
  CREATE INDEX "academy_groups_status_idx" ON "academy_groups" USING btree ("status");
  CREATE INDEX "academy_groups_coach_idx" ON "academy_groups" USING btree ("coach_id");
  CREATE INDEX "academy_groups_term_idx" ON "academy_groups" USING btree ("term_id");
  CREATE INDEX "academy_groups_first_session_at_idx" ON "academy_groups" USING btree ("first_session_at");
  CREATE INDEX "academy_groups_term_offer_term_offer_proposed_by_idx" ON "academy_groups" USING btree ("term_offer_proposed_by_id");
  CREATE INDEX "academy_groups_created_by_idx" ON "academy_groups" USING btree ("created_by_id");
  CREATE INDEX "academy_groups_updated_at_idx" ON "academy_groups" USING btree ("updated_at");
  CREATE INDEX "academy_groups_created_at_idx" ON "academy_groups" USING btree ("created_at");
  CREATE INDEX "academy_group_invites_group_idx" ON "academy_group_invites" USING btree ("group_id");
  CREATE UNIQUE INDEX "academy_group_invites_token_hash_idx" ON "academy_group_invites" USING btree ("token_hash");
  CREATE INDEX "academy_group_invites_status_idx" ON "academy_group_invites" USING btree ("status");
  CREATE INDEX "academy_group_invites_participant_idx" ON "academy_group_invites" USING btree ("participant_id");
  CREATE INDEX "academy_group_invites_account_idx" ON "academy_group_invites" USING btree ("account_id");
  CREATE INDEX "academy_group_invites_booking_idx" ON "academy_group_invites" USING btree ("booking_id");
  CREATE INDEX "academy_group_invites_updated_at_idx" ON "academy_group_invites" USING btree ("updated_at");
  CREATE INDEX "academy_group_invites_created_at_idx" ON "academy_group_invites" USING btree ("created_at");
  ALTER TABLE "academy_bookings" ADD CONSTRAINT "academy_bookings_group_id_academy_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."academy_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_bookings" ADD CONSTRAINT "academy_bookings_group_invite_id_academy_group_invites_id_fk" FOREIGN KEY ("group_invite_id") REFERENCES "public"."academy_group_invites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_sessions" ADD CONSTRAINT "academy_sessions_group_id_academy_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."academy_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_groups_fk" FOREIGN KEY ("academy_groups_id") REFERENCES "public"."academy_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_group_invites_fk" FOREIGN KEY ("academy_group_invites_id") REFERENCES "public"."academy_group_invites"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "academy_bookings_kind_idx" ON "academy_bookings" USING btree ("kind");
  CREATE INDEX "academy_bookings_group_idx" ON "academy_bookings" USING btree ("group_id");
  CREATE INDEX "academy_bookings_group_invite_idx" ON "academy_bookings" USING btree ("group_invite_id");
  CREATE INDEX "academy_sessions_kind_idx" ON "academy_sessions" USING btree ("kind");
  CREATE INDEX "academy_sessions_group_idx" ON "academy_sessions" USING btree ("group_id");
  CREATE INDEX "academy_credits_scope_idx" ON "academy_credits" USING btree ("scope");
  CREATE INDEX "payload_locked_documents_rels_academy_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_groups_id");
  CREATE INDEX "payload_locked_documents_rels_academy_group_invites_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_group_invites_id");
  -- One live 1-on-1 or group per coach per time. A small group's player rows share the time its slot row holds.
  DROP INDEX IF EXISTS "academy_sessions_coach_start_live";
  CREATE UNIQUE INDEX "academy_sessions_coach_start_live" ON "academy_sessions" ("coach_id", "starts_at") WHERE "status" <> 'cancelled' AND "kind" <> 'group-player';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DELETE FROM "academy_sessions" WHERE "kind" <> 'one-on-one';
  DROP INDEX IF EXISTS "academy_sessions_coach_start_live";
  CREATE UNIQUE INDEX "academy_sessions_coach_start_live" ON "academy_sessions" ("coach_id", "starts_at") WHERE "status" <> 'cancelled';
   DROP TABLE IF EXISTS "academy_groups_history" CASCADE;
  DROP TABLE IF EXISTS "academy_groups" CASCADE;
  DROP TABLE IF EXISTS "academy_group_invites" CASCADE;
  ALTER TABLE "academy_bookings" DROP CONSTRAINT IF EXISTS "academy_bookings_group_id_academy_groups_id_fk";
  
  ALTER TABLE "academy_bookings" DROP CONSTRAINT IF EXISTS "academy_bookings_group_invite_id_academy_group_invites_id_fk";
  
  ALTER TABLE "academy_sessions" DROP CONSTRAINT IF EXISTS "academy_sessions_group_id_academy_groups_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_academy_groups_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_academy_group_invites_fk";
  
  DROP INDEX IF EXISTS "academy_bookings_kind_idx";
  DROP INDEX IF EXISTS "academy_bookings_group_idx";
  DROP INDEX IF EXISTS "academy_bookings_group_invite_idx";
  DROP INDEX IF EXISTS "academy_sessions_kind_idx";
  DROP INDEX IF EXISTS "academy_sessions_group_idx";
  DROP INDEX IF EXISTS "academy_credits_scope_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_academy_groups_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_academy_group_invites_id_idx";
  ALTER TABLE "academy_sessions" ALTER COLUMN "booking_id" SET NOT NULL;
  ALTER TABLE "academy_bookings" DROP COLUMN IF EXISTS "kind";
  ALTER TABLE "academy_bookings" DROP COLUMN IF EXISTS "group_id";
  ALTER TABLE "academy_bookings" DROP COLUMN IF EXISTS "group_invite_id";
  ALTER TABLE "academy_bookings" DROP COLUMN IF EXISTS "group_size";
  ALTER TABLE "academy_bookings" DROP COLUMN IF EXISTS "group_week1_credit";
  ALTER TABLE "academy_sessions" DROP COLUMN IF EXISTS "kind";
  ALTER TABLE "academy_sessions" DROP COLUMN IF EXISTS "group_id";
  ALTER TABLE "academy_credits" DROP COLUMN IF EXISTS "scope";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "academy_groups_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "academy_group_invites_id";
  DROP TYPE IF EXISTS "public"."enum_academy_bookings_kind";
  DROP TYPE IF EXISTS "public"."enum_academy_sessions_kind";
  DROP TYPE IF EXISTS "public"."enum_academy_groups_status";
  DROP TYPE IF EXISTS "public"."enum_academy_groups_type";
  DROP TYPE IF EXISTS "public"."enum_academy_groups_weekday";
  DROP TYPE IF EXISTS "public"."enum_academy_groups_term_offer_status";
  DROP TYPE IF EXISTS "public"."enum_academy_group_invites_status";
  DROP TYPE IF EXISTS "public"."enum_academy_group_invites_term_answer";
  DROP TYPE IF EXISTS "public"."enum_academy_credits_scope";`)
}
