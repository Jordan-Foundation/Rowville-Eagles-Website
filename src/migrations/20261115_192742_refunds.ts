import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_refunds_kind" AS ENUM('booking', 'academy', 'order', 'invoice');
  CREATE TYPE "public"."enum_refunds_payee" AS ENUM('academy', 'club');
  CREATE TYPE "public"."enum_refunds_status" AS ENUM('refunded', 'simulated', 'failed');
  CREATE TABLE "refunds" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_refunds_kind" NOT NULL,
  	"doc_id" numeric NOT NULL,
  	"reference" varchar,
  	"payee" "enum_refunds_payee",
  	"category" varchar,
  	"account_id" integer,
  	"description" varchar,
  	"player_name" varchar,
  	"amount" numeric NOT NULL,
  	"status" "enum_refunds_status" NOT NULL,
  	"cancelled" boolean,
  	"reason" varchar,
  	"error" varchar,
  	"stripe_refund_ids" varchar,
  	"nonce" varchar,
  	"by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "refunds_id" integer;
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "refunds_kind_idx" ON "refunds" USING btree ("kind");
  CREATE INDEX "refunds_doc_id_idx" ON "refunds" USING btree ("doc_id");
  CREATE INDEX "refunds_reference_idx" ON "refunds" USING btree ("reference");
  CREATE INDEX "refunds_account_idx" ON "refunds" USING btree ("account_id");
  CREATE UNIQUE INDEX "refunds_nonce_idx" ON "refunds" USING btree ("nonce");
  CREATE INDEX "refunds_by_idx" ON "refunds" USING btree ("by_id");
  CREATE INDEX "refunds_updated_at_idx" ON "refunds" USING btree ("updated_at");
  CREATE INDEX "refunds_created_at_idx" ON "refunds" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_refunds_fk" FOREIGN KEY ("refunds_id") REFERENCES "public"."refunds"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_refunds_id_idx" ON "payload_locked_documents_rels" USING btree ("refunds_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   
  DROP TABLE IF EXISTS "refunds" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_refunds_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_refunds_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "refunds_id";
  DROP TYPE IF EXISTS "public"."enum_refunds_kind";
  DROP TYPE IF EXISTS "public"."enum_refunds_payee";
  DROP TYPE IF EXISTS "public"."enum_refunds_status";`)
}
