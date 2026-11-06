import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_terms_status" AS ENUM('draft', 'availability', 'open', 'closed');
  CREATE TYPE "public"."enum_academy_availability_slots_weekday" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TABLE "academy_terms_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"reason" varchar
  );
  
  CREATE TABLE "academy_terms_slot_start_times" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"time" varchar NOT NULL
  );
  
  CREATE TABLE "academy_terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"status" "enum_academy_terms_status" DEFAULT 'draft' NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"sessions" numeric DEFAULT 10 NOT NULL,
  	"end_date" timestamp(3) with time zone,
  	"availability_deadline" timestamp(3) with time zone NOT NULL,
  	"price_per_session" numeric DEFAULT 80 NOT NULL,
  	"casual_price" numeric DEFAULT 85 NOT NULL,
  	"session_minutes" numeric DEFAULT 60 NOT NULL,
  	"booking_cutoff_hours" numeric DEFAULT 24,
  	"min_term_sessions" numeric DEFAULT 2,
  	"hold_minutes" numeric DEFAULT 15,
  	"share_link_hold_hours" numeric DEFAULT 24,
  	"account_reminder_days" numeric DEFAULT 3,
  	"organisation" varchar DEFAULT 'rowville',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "academy_coaches_specialties" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "academy_coaches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"display_name" varchar NOT NULL,
  	"photo_id" integer,
  	"bio" varchar,
  	"active" boolean DEFAULT true,
  	"order" numeric DEFAULT 0,
  	"organisation" varchar DEFAULT 'rowville',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "academy_availability_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"weekday" "enum_academy_availability_slots_weekday" NOT NULL,
  	"start_time" varchar NOT NULL
  );
  
  CREATE TABLE "academy_availability_changes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"added" varchar,
  	"removed" varchar
  );
  
  CREATE TABLE "academy_availability" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coach_id" integer NOT NULL,
  	"term_id" integer NOT NULL,
  	"submitted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "programs" ADD COLUMN "academy_term_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_terms_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_coaches_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_availability_id" integer;
  ALTER TABLE "academy_terms_skip_dates" ADD CONSTRAINT "academy_terms_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_terms_slot_start_times" ADD CONSTRAINT "academy_terms_slot_start_times_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_coaches_specialties" ADD CONSTRAINT "academy_coaches_specialties_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_coaches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_coaches" ADD CONSTRAINT "academy_coaches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_coaches" ADD CONSTRAINT "academy_coaches_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_availability_slots" ADD CONSTRAINT "academy_availability_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_availability"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_availability_changes" ADD CONSTRAINT "academy_availability_changes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_availability"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_availability" ADD CONSTRAINT "academy_availability_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_availability" ADD CONSTRAINT "academy_availability_term_id_academy_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academy_terms"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "academy_terms_skip_dates_order_idx" ON "academy_terms_skip_dates" USING btree ("_order");
  CREATE INDEX "academy_terms_skip_dates_parent_id_idx" ON "academy_terms_skip_dates" USING btree ("_parent_id");
  CREATE INDEX "academy_terms_slot_start_times_order_idx" ON "academy_terms_slot_start_times" USING btree ("_order");
  CREATE INDEX "academy_terms_slot_start_times_parent_id_idx" ON "academy_terms_slot_start_times" USING btree ("_parent_id");
  CREATE INDEX "academy_terms_updated_at_idx" ON "academy_terms" USING btree ("updated_at");
  CREATE INDEX "academy_terms_created_at_idx" ON "academy_terms" USING btree ("created_at");
  CREATE INDEX "academy_coaches_specialties_order_idx" ON "academy_coaches_specialties" USING btree ("_order");
  CREATE INDEX "academy_coaches_specialties_parent_id_idx" ON "academy_coaches_specialties" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "academy_coaches_user_idx" ON "academy_coaches" USING btree ("user_id");
  CREATE INDEX "academy_coaches_photo_idx" ON "academy_coaches" USING btree ("photo_id");
  CREATE INDEX "academy_coaches_updated_at_idx" ON "academy_coaches" USING btree ("updated_at");
  CREATE INDEX "academy_coaches_created_at_idx" ON "academy_coaches" USING btree ("created_at");
  CREATE INDEX "academy_availability_slots_order_idx" ON "academy_availability_slots" USING btree ("_order");
  CREATE INDEX "academy_availability_slots_parent_id_idx" ON "academy_availability_slots" USING btree ("_parent_id");
  CREATE INDEX "academy_availability_changes_order_idx" ON "academy_availability_changes" USING btree ("_order");
  CREATE INDEX "academy_availability_changes_parent_id_idx" ON "academy_availability_changes" USING btree ("_parent_id");
  CREATE INDEX "academy_availability_coach_idx" ON "academy_availability" USING btree ("coach_id");
  CREATE INDEX "academy_availability_term_idx" ON "academy_availability" USING btree ("term_id");
  CREATE INDEX "academy_availability_updated_at_idx" ON "academy_availability" USING btree ("updated_at");
  CREATE INDEX "academy_availability_created_at_idx" ON "academy_availability" USING btree ("created_at");
  CREATE UNIQUE INDEX "coach_term_idx" ON "academy_availability" USING btree ("coach_id","term_id");
  ALTER TABLE "programs" ADD CONSTRAINT "programs_academy_term_id_academy_terms_id_fk" FOREIGN KEY ("academy_term_id") REFERENCES "public"."academy_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_terms_fk" FOREIGN KEY ("academy_terms_id") REFERENCES "public"."academy_terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_coaches_fk" FOREIGN KEY ("academy_coaches_id") REFERENCES "public"."academy_coaches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_availability_fk" FOREIGN KEY ("academy_availability_id") REFERENCES "public"."academy_availability"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "programs_academy_term_idx" ON "programs" USING btree ("academy_term_id");
  CREATE INDEX "payload_locked_documents_rels_academy_terms_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_terms_id");
  CREATE INDEX "payload_locked_documents_rels_academy_coaches_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_coaches_id");
  CREATE INDEX "payload_locked_documents_rels_academy_availability_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_availability_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_terms_skip_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_terms_slot_start_times" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_coaches_specialties" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_coaches" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_availability_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_availability_changes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_availability" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "academy_terms_skip_dates" CASCADE;
  DROP TABLE "academy_terms_slot_start_times" CASCADE;
  DROP TABLE "academy_terms" CASCADE;
  DROP TABLE "academy_coaches_specialties" CASCADE;
  DROP TABLE "academy_coaches" CASCADE;
  DROP TABLE "academy_availability_slots" CASCADE;
  DROP TABLE "academy_availability_changes" CASCADE;
  DROP TABLE "academy_availability" CASCADE;
  ALTER TABLE "programs" DROP CONSTRAINT "programs_academy_term_id_academy_terms_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_academy_terms_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_academy_coaches_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_academy_availability_fk";
  
  DROP INDEX "programs_academy_term_idx";
  DROP INDEX "payload_locked_documents_rels_academy_terms_id_idx";
  DROP INDEX "payload_locked_documents_rels_academy_coaches_id_idx";
  DROP INDEX "payload_locked_documents_rels_academy_availability_id_idx";
  ALTER TABLE "programs" DROP COLUMN "academy_term_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_terms_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_coaches_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_availability_id";
  DROP TYPE "public"."enum_academy_terms_status";
  DROP TYPE "public"."enum_academy_availability_slots_weekday";`)
}
