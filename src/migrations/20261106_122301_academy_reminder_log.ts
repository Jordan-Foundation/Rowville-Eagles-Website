import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_reminder_log_kind" AS ENUM('14d', '7d', '3d', '1d');
  CREATE TABLE "academy_reminder_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coach_id" integer NOT NULL,
  	"term_id" integer NOT NULL,
  	"kind" "enum_academy_reminder_log_kind" NOT NULL,
  	"to" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_reminder_log_id" integer;
  ALTER TABLE "academy_reminder_log" ADD CONSTRAINT "academy_reminder_log_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_reminder_log" ADD CONSTRAINT "academy_reminder_log_term_id_academy_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academy_terms"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "academy_reminder_log_coach_idx" ON "academy_reminder_log" USING btree ("coach_id");
  CREATE INDEX "academy_reminder_log_term_idx" ON "academy_reminder_log" USING btree ("term_id");
  CREATE INDEX "academy_reminder_log_updated_at_idx" ON "academy_reminder_log" USING btree ("updated_at");
  CREATE INDEX "academy_reminder_log_created_at_idx" ON "academy_reminder_log" USING btree ("created_at");
  CREATE UNIQUE INDEX "coach_term_kind_idx" ON "academy_reminder_log" USING btree ("coach_id","term_id","kind");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_reminder_log_fk" FOREIGN KEY ("academy_reminder_log_id") REFERENCES "public"."academy_reminder_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_academy_reminder_log_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_reminder_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_reminder_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "academy_reminder_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_academy_reminder_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_academy_reminder_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_reminder_log_id";
  DROP TYPE "public"."enum_academy_reminder_log_kind";`)
}
