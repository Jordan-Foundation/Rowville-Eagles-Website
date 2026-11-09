import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_training_attendance_kind" AS ENUM('group', 'team');
  CREATE TABLE "training_attendance" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"title" varchar,
  	"kind" "enum_training_attendance_kind" NOT NULL,
  	"date" varchar NOT NULL,
  	"slot_id" integer,
  	"group_id" varchar,
  	"team_id" integer,
  	"present" jsonb,
  	"present_count" numeric,
  	"roster_count" numeric,
  	"taken_by_id" integer,
  	"taken_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "training_attendance_id" integer;
  ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_slot_id_academy_term_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."academy_term_slots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_taken_by_id_users_id_fk" FOREIGN KEY ("taken_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "training_attendance_key_idx" ON "training_attendance" USING btree ("key");
  CREATE INDEX "training_attendance_date_idx" ON "training_attendance" USING btree ("date");
  CREATE INDEX "training_attendance_slot_idx" ON "training_attendance" USING btree ("slot_id");
  CREATE INDEX "training_attendance_team_idx" ON "training_attendance" USING btree ("team_id");
  CREATE INDEX "training_attendance_taken_by_idx" ON "training_attendance" USING btree ("taken_by_id");
  CREATE INDEX "training_attendance_updated_at_idx" ON "training_attendance" USING btree ("updated_at");
  CREATE INDEX "training_attendance_created_at_idx" ON "training_attendance" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_training_attendance_fk" FOREIGN KEY ("training_attendance_id") REFERENCES "public"."training_attendance"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_training_attendance_id_idx" ON "payload_locked_documents_rels" USING btree ("training_attendance_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "training_attendance" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "training_attendance" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_training_attendance_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_training_attendance_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "training_attendance_id";
  DROP TYPE "public"."enum_training_attendance_kind";`)
}
