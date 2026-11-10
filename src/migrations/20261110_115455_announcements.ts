import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_announcements_kind" AS ENUM('open', 'reminder');
  CREATE TYPE "public"."enum_announcements_status" AS ENUM('needs-approval', 'scheduled', 'sending', 'sent', 'cancelled');
  CREATE TABLE "announcements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"program_id" integer NOT NULL,
  	"kind" "enum_announcements_kind" NOT NULL,
  	"year" numeric,
  	"status" "enum_announcements_status" DEFAULT 'needs-approval' NOT NULL,
  	"subject" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"sms_text" varchar,
  	"scheduled_for" timestamp(3) with time zone,
  	"approved_by_id" integer,
  	"sent_at" timestamp(3) with time zone,
  	"send_completed_at" timestamp(3) with time zone,
  	"send_state" jsonb,
  	"sent_counts" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "announcements_id" integer;
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "announcements_program_idx" ON "announcements" USING btree ("program_id");
  CREATE INDEX "announcements_year_idx" ON "announcements" USING btree ("year");
  CREATE INDEX "announcements_status_idx" ON "announcements" USING btree ("status");
  CREATE INDEX "announcements_approved_by_idx" ON "announcements" USING btree ("approved_by_id");
  CREATE INDEX "announcements_updated_at_idx" ON "announcements" USING btree ("updated_at");
  CREATE INDEX "announcements_created_at_idx" ON "announcements" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcements_fk" FOREIGN KEY ("announcements_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_announcements_id_idx" ON "payload_locked_documents_rels" USING btree ("announcements_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE IF EXISTS "announcements" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "announcements" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_announcements_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_announcements_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "announcements_id";
  DROP TYPE IF EXISTS "public"."enum_announcements_kind";
  DROP TYPE IF EXISTS "public"."enum_announcements_status";`)
}
