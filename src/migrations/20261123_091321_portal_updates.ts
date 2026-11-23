import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tournament_invites_status" AS ENUM('invited', 'accepted', 'declined', 'expired', 'paid', 'withdrawn');
  CREATE TABLE "rfa_tournaments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone,
  	"venue" varchar,
  	"age_groups" varchar,
  	"squad_size" numeric DEFAULT 10 NOT NULL,
  	"fee" numeric,
  	"rsvp_deadline" timestamp(3) with time zone NOT NULL,
  	"arrival_time" varchar,
  	"what_to_bring" varchar,
  	"details" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tournament_squads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tournament_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"limit" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tournament_squads_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  CREATE TABLE "tournament_invites" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tournament_id" integer NOT NULL,
  	"squad_id" integer NOT NULL,
  	"participant_id" integer NOT NULL,
  	"account_id" integer,
  	"player_name" varchar,
  	"birth_year" numeric,
  	"status" "enum_tournament_invites_status" DEFAULT 'invited' NOT NULL,
  	"token" varchar NOT NULL,
  	"invited_at" timestamp(3) with time zone,
  	"responded_at" timestamp(3) with time zone,
  	"reminder_at" timestamp(3) with time zone,
  	"paid_at" timestamp(3) with time zone,
  	"invoice_id" integer,
  	"invited_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "academy_settings_session_lengths" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"age_group" varchar NOT NULL,
  	"minutes" numeric NOT NULL
  );
  
  CREATE TABLE "academy_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_enquiries_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_enquiries_id_idx";
  ALTER TABLE "academy_term_slots" ADD COLUMN "previous_end_time" varchar;
  ALTER TABLE "academy_term_slots" ADD COLUMN "previous_end_until" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rfa_tournaments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tournament_squads_id" integer;
  ALTER TABLE "academy_settings" ADD COLUMN "session_lengths_last_run" jsonb;
  ALTER TABLE "tournament_squads" ADD CONSTRAINT "tournament_squads_tournament_id_rfa_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."rfa_tournaments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tournament_squads_numbers" ADD CONSTRAINT "tournament_squads_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tournament_squads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tournament_invites" ADD CONSTRAINT "tournament_invites_tournament_id_rfa_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."rfa_tournaments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tournament_invites" ADD CONSTRAINT "tournament_invites_squad_id_tournament_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."tournament_squads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tournament_invites" ADD CONSTRAINT "tournament_invites_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tournament_invites" ADD CONSTRAINT "tournament_invites_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tournament_invites" ADD CONSTRAINT "tournament_invites_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tournament_invites" ADD CONSTRAINT "tournament_invites_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_settings_session_lengths" ADD CONSTRAINT "academy_settings_session_lengths_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_settings_rels" ADD CONSTRAINT "academy_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."academy_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_settings_rels" ADD CONSTRAINT "academy_settings_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "rfa_tournaments_updated_at_idx" ON "rfa_tournaments" USING btree ("updated_at");
  CREATE INDEX "rfa_tournaments_created_at_idx" ON "rfa_tournaments" USING btree ("created_at");
  CREATE INDEX "tournament_squads_tournament_idx" ON "tournament_squads" USING btree ("tournament_id");
  CREATE INDEX "tournament_squads_updated_at_idx" ON "tournament_squads" USING btree ("updated_at");
  CREATE INDEX "tournament_squads_created_at_idx" ON "tournament_squads" USING btree ("created_at");
  CREATE INDEX "tournament_squads_numbers_order_parent_idx" ON "tournament_squads_numbers" USING btree ("order","parent_id");
  CREATE INDEX "tournament_invites_tournament_idx" ON "tournament_invites" USING btree ("tournament_id");
  CREATE INDEX "tournament_invites_squad_idx" ON "tournament_invites" USING btree ("squad_id");
  CREATE INDEX "tournament_invites_participant_idx" ON "tournament_invites" USING btree ("participant_id");
  CREATE INDEX "tournament_invites_account_idx" ON "tournament_invites" USING btree ("account_id");
  CREATE INDEX "tournament_invites_status_idx" ON "tournament_invites" USING btree ("status");
  CREATE UNIQUE INDEX "tournament_invites_token_idx" ON "tournament_invites" USING btree ("token");
  CREATE INDEX "tournament_invites_invoice_idx" ON "tournament_invites" USING btree ("invoice_id");
  CREATE INDEX "tournament_invites_invited_by_idx" ON "tournament_invites" USING btree ("invited_by_id");
  CREATE INDEX "tournament_invites_updated_at_idx" ON "tournament_invites" USING btree ("updated_at");
  CREATE INDEX "tournament_invites_created_at_idx" ON "tournament_invites" USING btree ("created_at");
  CREATE UNIQUE INDEX "squad_participant_idx" ON "tournament_invites" USING btree ("squad_id","participant_id");
  CREATE INDEX "academy_settings_session_lengths_order_idx" ON "academy_settings_session_lengths" USING btree ("_order");
  CREATE INDEX "academy_settings_session_lengths_parent_id_idx" ON "academy_settings_session_lengths" USING btree ("_parent_id");
  CREATE INDEX "academy_settings_rels_order_idx" ON "academy_settings_rels" USING btree ("order");
  CREATE INDEX "academy_settings_rels_parent_idx" ON "academy_settings_rels" USING btree ("parent_id");
  CREATE INDEX "academy_settings_rels_path_idx" ON "academy_settings_rels" USING btree ("path");
  CREATE INDEX "academy_settings_rels_users_id_idx" ON "academy_settings_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rfa_tournaments_fk" FOREIGN KEY ("rfa_tournaments_id") REFERENCES "public"."rfa_tournaments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tournament_squads_fk" FOREIGN KEY ("tournament_squads_id") REFERENCES "public"."tournament_squads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_rfa_tournaments_id_idx" ON "payload_locked_documents_rels" USING btree ("rfa_tournaments_id");
  CREATE INDEX "payload_locked_documents_rels_tournament_squads_id_idx" ON "payload_locked_documents_rels" USING btree ("tournament_squads_id");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "enquiries_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "rfa_tournaments" CASCADE;
  DROP TABLE IF EXISTS "tournament_squads" CASCADE;
  DROP TABLE IF EXISTS "tournament_squads_numbers" CASCADE;
  DROP TABLE IF EXISTS "tournament_invites" CASCADE;
  DROP TABLE IF EXISTS "academy_settings_session_lengths" CASCADE;
  DROP TABLE IF EXISTS "academy_settings_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_rfa_tournaments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_tournament_squads_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_rfa_tournaments_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_tournament_squads_id_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "enquiries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enquiries_fk" FOREIGN KEY ("enquiries_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_enquiries_id_idx" ON "payload_locked_documents_rels" USING btree ("enquiries_id");
  ALTER TABLE "academy_term_slots" DROP COLUMN IF EXISTS "previous_end_time";
  ALTER TABLE "academy_term_slots" DROP COLUMN IF EXISTS "previous_end_until";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "rfa_tournaments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "tournament_squads_id";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "session_lengths_last_run";
  DROP TYPE IF EXISTS "public"."enum_tournament_invites_status";`)
}
