import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "activity_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"area" varchar,
  	"what" varchar,
  	"action" varchar,
  	"source" varchar,
  	"doc_id" varchar,
  	"by_id" integer,
  	"by_name" varchar,
  	"changes" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activity_log_id" integer;
  ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "activity_log_area_idx" ON "activity_log" USING btree ("area");
  CREATE INDEX "activity_log_by_idx" ON "activity_log" USING btree ("by_id");
  CREATE INDEX "activity_log_updated_at_idx" ON "activity_log" USING btree ("updated_at");
  CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_log_fk" FOREIGN KEY ("activity_log_id") REFERENCES "public"."activity_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_activity_log_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "activity_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_activity_log_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_activity_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "activity_log_id";`)
}
