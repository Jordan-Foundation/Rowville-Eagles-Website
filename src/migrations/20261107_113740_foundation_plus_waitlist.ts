import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "fplus_waitlist" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"source" varchar,
  	"notified_at" timestamp(3) with time zone,
  	"claimed_at" timestamp(3) with time zone,
  	"wording" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "form_throttle" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"form" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fplus_waitlist_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "form_throttle_id" integer;
  ALTER TABLE "pdr_settings" ADD COLUMN "plans_standard_monthly" numeric DEFAULT 9.95;
  ALTER TABLE "pdr_settings" ADD COLUMN "plans_standard_yearly" numeric DEFAULT 89;
  ALTER TABLE "pdr_settings" ADD COLUMN "plans_premium_monthly" numeric DEFAULT 24.95;
  ALTER TABLE "pdr_settings" ADD COLUMN "plans_premium_yearly" numeric DEFAULT 229;
  ALTER TABLE "pdr_settings" ADD COLUMN "plans_sibling_discount_pct" numeric DEFAULT 25;
  ALTER TABLE "pdr_settings" ADD COLUMN "plans_trial_days" numeric DEFAULT 30;
  CREATE UNIQUE INDEX "fplus_waitlist_email_idx" ON "fplus_waitlist" USING btree ("email");
  CREATE INDEX "fplus_waitlist_updated_at_idx" ON "fplus_waitlist" USING btree ("updated_at");
  CREATE INDEX "fplus_waitlist_created_at_idx" ON "fplus_waitlist" USING btree ("created_at");
  CREATE INDEX "form_throttle_key_idx" ON "form_throttle" USING btree ("key");
  CREATE INDEX "form_throttle_form_idx" ON "form_throttle" USING btree ("form");
  CREATE INDEX "form_throttle_updated_at_idx" ON "form_throttle" USING btree ("updated_at");
  CREATE INDEX "form_throttle_created_at_idx" ON "form_throttle" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fplus_waitlist_fk" FOREIGN KEY ("fplus_waitlist_id") REFERENCES "public"."fplus_waitlist"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_form_throttle_fk" FOREIGN KEY ("form_throttle_id") REFERENCES "public"."form_throttle"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_fplus_waitlist_id_idx" ON "payload_locked_documents_rels" USING btree ("fplus_waitlist_id");
  CREATE INDEX "payload_locked_documents_rels_form_throttle_id_idx" ON "payload_locked_documents_rels" USING btree ("form_throttle_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "fplus_waitlist" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "form_throttle" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "fplus_waitlist" CASCADE;
  DROP TABLE "form_throttle" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fplus_waitlist_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_form_throttle_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_fplus_waitlist_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_form_throttle_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "fplus_waitlist_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "form_throttle_id";
  ALTER TABLE "pdr_settings" DROP COLUMN "plans_standard_monthly";
  ALTER TABLE "pdr_settings" DROP COLUMN "plans_standard_yearly";
  ALTER TABLE "pdr_settings" DROP COLUMN "plans_premium_monthly";
  ALTER TABLE "pdr_settings" DROP COLUMN "plans_premium_yearly";
  ALTER TABLE "pdr_settings" DROP COLUMN "plans_sibling_discount_pct";
  ALTER TABLE "pdr_settings" DROP COLUMN "plans_trial_days";`)
}
