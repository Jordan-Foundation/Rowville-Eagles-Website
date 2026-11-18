import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_participants_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_player_numbers_status" AS ENUM('held', 'active', 'released');
  CREATE TYPE "public"."enum_player_numbers_assigned_by" AS ENUM('player', 'admin');
  CREATE TYPE "public"."enum_number_audit_log_action" AS ENUM('picked', 'assigned', 'changed', 'released', 'released-inactive');
  CREATE TYPE "public"."enum_fitout_sessions_program" AS ENUM('both', 'rfa', 'rowville');
  CREATE TABLE "number_ranges" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"birth_year" numeric NOT NULL,
  	"start" numeric NOT NULL,
  	"end" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "player_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"participant_id" integer NOT NULL,
  	"birth_year" numeric NOT NULL,
  	"number" numeric NOT NULL,
  	"status" "enum_player_numbers_status" NOT NULL,
  	"slot" varchar,
  	"held_until" timestamp(3) with time zone,
  	"assigned_at" timestamp(3) with time zone,
  	"released_at" timestamp(3) with time zone,
  	"assigned_by" "enum_player_numbers_assigned_by",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "number_audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"participant_id" integer NOT NULL,
  	"action" "enum_number_audit_log_action" NOT NULL,
  	"old_number" numeric,
  	"new_number" numeric,
  	"birth_year" numeric,
  	"by_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "kit_items_sizes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "kit_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"sort_order" numeric DEFAULT 0,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "fitout_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"program" "enum_fitout_sessions_program" DEFAULT 'both',
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "fitout_entries_sizes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"size" varchar NOT NULL
  );
  
  CREATE TABLE "fitout_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"session_id" integer NOT NULL,
  	"participant_id" integer NOT NULL,
  	"notes" varchar,
  	"updated_by_id" integer,
  	"exported_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "participants" ADD COLUMN "status" "enum_participants_status" DEFAULT 'active';
  ALTER TABLE "participants" ADD COLUMN "numbers_required" boolean DEFAULT false;
  ALTER TABLE "participants" ADD COLUMN "numbers_required_at" timestamp(3) with time zone;
  ALTER TABLE "participants" ADD COLUMN "numbers_reminder_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "number_ranges_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "player_numbers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "number_audit_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "kit_items_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fitout_sessions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fitout_entries_id" integer;
  ALTER TABLE "player_numbers" ADD CONSTRAINT "player_numbers_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "number_audit_log" ADD CONSTRAINT "number_audit_log_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "number_audit_log" ADD CONSTRAINT "number_audit_log_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "kit_items_sizes" ADD CONSTRAINT "kit_items_sizes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."kit_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "fitout_sessions" ADD CONSTRAINT "fitout_sessions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fitout_entries_sizes" ADD CONSTRAINT "fitout_entries_sizes_item_id_kit_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."kit_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fitout_entries_sizes" ADD CONSTRAINT "fitout_entries_sizes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."fitout_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "fitout_entries" ADD CONSTRAINT "fitout_entries_session_id_fitout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fitout_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fitout_entries" ADD CONSTRAINT "fitout_entries_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fitout_entries" ADD CONSTRAINT "fitout_entries_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "number_ranges_birth_year_idx" ON "number_ranges" USING btree ("birth_year");
  CREATE INDEX "number_ranges_updated_at_idx" ON "number_ranges" USING btree ("updated_at");
  CREATE INDEX "number_ranges_created_at_idx" ON "number_ranges" USING btree ("created_at");
  CREATE INDEX "player_numbers_participant_idx" ON "player_numbers" USING btree ("participant_id");
  CREATE INDEX "player_numbers_birth_year_idx" ON "player_numbers" USING btree ("birth_year");
  CREATE INDEX "player_numbers_status_idx" ON "player_numbers" USING btree ("status");
  CREATE UNIQUE INDEX "player_numbers_slot_idx" ON "player_numbers" USING btree ("slot");
  CREATE INDEX "player_numbers_updated_at_idx" ON "player_numbers" USING btree ("updated_at");
  CREATE INDEX "player_numbers_created_at_idx" ON "player_numbers" USING btree ("created_at");
  CREATE INDEX "number_audit_log_participant_idx" ON "number_audit_log" USING btree ("participant_id");
  CREATE INDEX "number_audit_log_by_idx" ON "number_audit_log" USING btree ("by_id");
  CREATE INDEX "number_audit_log_updated_at_idx" ON "number_audit_log" USING btree ("updated_at");
  CREATE INDEX "number_audit_log_created_at_idx" ON "number_audit_log" USING btree ("created_at");
  CREATE INDEX "kit_items_sizes_order_idx" ON "kit_items_sizes" USING btree ("_order");
  CREATE INDEX "kit_items_sizes_parent_id_idx" ON "kit_items_sizes" USING btree ("_parent_id");
  CREATE INDEX "kit_items_updated_at_idx" ON "kit_items" USING btree ("updated_at");
  CREATE INDEX "kit_items_created_at_idx" ON "kit_items" USING btree ("created_at");
  CREATE INDEX "fitout_sessions_created_by_idx" ON "fitout_sessions" USING btree ("created_by_id");
  CREATE INDEX "fitout_sessions_updated_at_idx" ON "fitout_sessions" USING btree ("updated_at");
  CREATE INDEX "fitout_sessions_created_at_idx" ON "fitout_sessions" USING btree ("created_at");
  CREATE INDEX "fitout_entries_sizes_order_idx" ON "fitout_entries_sizes" USING btree ("_order");
  CREATE INDEX "fitout_entries_sizes_parent_id_idx" ON "fitout_entries_sizes" USING btree ("_parent_id");
  CREATE INDEX "fitout_entries_sizes_item_idx" ON "fitout_entries_sizes" USING btree ("item_id");
  CREATE UNIQUE INDEX "fitout_entries_key_idx" ON "fitout_entries" USING btree ("key");
  CREATE INDEX "fitout_entries_session_idx" ON "fitout_entries" USING btree ("session_id");
  CREATE INDEX "fitout_entries_participant_idx" ON "fitout_entries" USING btree ("participant_id");
  CREATE INDEX "fitout_entries_updated_by_idx" ON "fitout_entries" USING btree ("updated_by_id");
  CREATE INDEX "fitout_entries_updated_at_idx" ON "fitout_entries" USING btree ("updated_at");
  CREATE INDEX "fitout_entries_created_at_idx" ON "fitout_entries" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_number_ranges_fk" FOREIGN KEY ("number_ranges_id") REFERENCES "public"."number_ranges"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_player_numbers_fk" FOREIGN KEY ("player_numbers_id") REFERENCES "public"."player_numbers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_number_audit_log_fk" FOREIGN KEY ("number_audit_log_id") REFERENCES "public"."number_audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_kit_items_fk" FOREIGN KEY ("kit_items_id") REFERENCES "public"."kit_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fitout_sessions_fk" FOREIGN KEY ("fitout_sessions_id") REFERENCES "public"."fitout_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fitout_entries_fk" FOREIGN KEY ("fitout_entries_id") REFERENCES "public"."fitout_entries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "participants_status_idx" ON "participants" USING btree ("status");
  CREATE INDEX "payload_locked_documents_rels_number_ranges_id_idx" ON "payload_locked_documents_rels" USING btree ("number_ranges_id");
  CREATE INDEX "payload_locked_documents_rels_player_numbers_id_idx" ON "payload_locked_documents_rels" USING btree ("player_numbers_id");
  CREATE INDEX "payload_locked_documents_rels_number_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("number_audit_log_id");
  CREATE INDEX "payload_locked_documents_rels_kit_items_id_idx" ON "payload_locked_documents_rels" USING btree ("kit_items_id");
  CREATE INDEX "payload_locked_documents_rels_fitout_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("fitout_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_fitout_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("fitout_entries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "number_ranges" CASCADE;
  DROP TABLE IF EXISTS "player_numbers" CASCADE;
  DROP TABLE IF EXISTS "number_audit_log" CASCADE;
  DROP TABLE IF EXISTS "kit_items_sizes" CASCADE;
  DROP TABLE IF EXISTS "kit_items" CASCADE;
  DROP TABLE IF EXISTS "fitout_sessions" CASCADE;
  DROP TABLE IF EXISTS "fitout_entries_sizes" CASCADE;
  DROP TABLE IF EXISTS "fitout_entries" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_number_ranges_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_player_numbers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_number_audit_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_kit_items_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fitout_sessions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fitout_entries_fk";
  
  DROP INDEX IF EXISTS "participants_status_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_number_ranges_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_player_numbers_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_number_audit_log_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_kit_items_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_fitout_sessions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_fitout_entries_id_idx";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "status";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "numbers_required";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "numbers_required_at";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "numbers_reminder_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "number_ranges_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "player_numbers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "number_audit_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "kit_items_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "fitout_sessions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "fitout_entries_id";
  DROP TYPE IF EXISTS "public"."enum_participants_status";
  DROP TYPE IF EXISTS "public"."enum_player_numbers_status";
  DROP TYPE IF EXISTS "public"."enum_player_numbers_assigned_by";
  DROP TYPE IF EXISTS "public"."enum_number_audit_log_action";
  DROP TYPE IF EXISTS "public"."enum_fitout_sessions_program";`)
}
