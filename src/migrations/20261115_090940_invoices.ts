import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_invoices_payee" AS ENUM('academy', 'club');
  CREATE TYPE "public"."enum_invoices_status" AS ENUM('draft', 'sent', 'paid', 'cancelled', 'refunded');
  CREATE TYPE "public"."enum_invoices_paid_via" AS ENUM('card', 'manual');
  CREATE TABLE "invoices_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"source" varchar
  );
  
  CREATE TABLE "invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"payee" "enum_invoices_payee" DEFAULT 'academy' NOT NULL,
  	"status" "enum_invoices_status" DEFAULT 'draft' NOT NULL,
  	"account_id" integer,
  	"contact_name" varchar NOT NULL,
  	"contact_email" varchar,
  	"contact_phone" varchar,
  	"player_name" varchar,
  	"total" numeric,
  	"note" varchar,
  	"due_date" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"reminded_at" timestamp(3) with time zone,
  	"paid_at" timestamp(3) with time zone,
  	"paid_via" "enum_invoices_paid_via",
  	"payment_note" varchar,
  	"token" varchar NOT NULL,
  	"stripe_checkout_id" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invoices_id" integer;
  ALTER TABLE "invoices_items" ADD CONSTRAINT "invoices_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "invoices_items_order_idx" ON "invoices_items" USING btree ("_order");
  CREATE INDEX "invoices_items_parent_id_idx" ON "invoices_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "invoices_reference_idx" ON "invoices" USING btree ("reference");
  CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");
  CREATE INDEX "invoices_account_idx" ON "invoices" USING btree ("account_id");
  CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");
  CREATE INDEX "invoices_created_by_idx" ON "invoices" USING btree ("created_by_id");
  CREATE INDEX "invoices_updated_at_idx" ON "invoices" USING btree ("updated_at");
  CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk" FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("invoices_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   
  
  DROP TABLE IF EXISTS "invoices_items" CASCADE;
  DROP TABLE IF EXISTS "invoices" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_invoices_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_invoices_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "invoices_id";
  DROP TYPE IF EXISTS "public"."enum_invoices_payee";
  DROP TYPE IF EXISTS "public"."enum_invoices_status";
  DROP TYPE IF EXISTS "public"."enum_invoices_paid_via";`)
}
