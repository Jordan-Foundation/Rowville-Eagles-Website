import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_staff_feed_kind" AS ENUM('problem', 'trial', 'enquiry', 'booking', 'payment');
  CREATE TYPE "public"."enum_staff_feed_text_status" AS ENUM('none', 'sent', 'held', 'failed');
  CREATE TABLE "staff_feed" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_staff_feed_kind" NOT NULL,
  	"urgent" boolean DEFAULT false,
  	"text_status" "enum_staff_feed_text_status" DEFAULT 'none',
  	"title" varchar NOT NULL,
  	"detail" varchar,
  	"href" varchar,
  	"source_key" varchar,
  	"digested_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "staff_feed_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "alert_emails" varchar;
  CREATE INDEX "staff_feed_kind_idx" ON "staff_feed" USING btree ("kind");
  CREATE INDEX "staff_feed_urgent_idx" ON "staff_feed" USING btree ("urgent");
  CREATE INDEX "staff_feed_text_status_idx" ON "staff_feed" USING btree ("text_status");
  CREATE UNIQUE INDEX "staff_feed_source_key_idx" ON "staff_feed" USING btree ("source_key");
  CREATE INDEX "staff_feed_digested_at_idx" ON "staff_feed" USING btree ("digested_at");
  CREATE INDEX "staff_feed_updated_at_idx" ON "staff_feed" USING btree ("updated_at");
  CREATE INDEX "staff_feed_created_at_idx" ON "staff_feed" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_staff_feed_fk" FOREIGN KEY ("staff_feed_id") REFERENCES "public"."staff_feed"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_staff_feed_id_idx" ON "payload_locked_documents_rels" USING btree ("staff_feed_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "staff_feed" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "staff_feed" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_staff_feed_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_staff_feed_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "staff_feed_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "alert_emails";
  DROP TYPE IF EXISTS "public"."enum_staff_feed_kind";
  DROP TYPE IF EXISTS "public"."enum_staff_feed_text_status";`)
}
