import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_promotions_program_groups" AS ENUM('holiday-camp', 'academy-term', 'toddler', 'academy-trial', 'registration', 'other');
  CREATE TYPE "public"."enum_promotions_channels" AS ENUM('email', 'sms');
  CREATE TYPE "public"."enum_promotions_status" AS ENUM('draft', 'live', 'ended');
  CREATE TYPE "public"."enum_promotions_type" AS ENUM('percent', 'amount');
  CREATE TYPE "public"."enum_promotion_uses_kind" AS ENUM('program', '1on1', 'shop', 'tournament', 'fplus');
  CREATE TYPE "public"."enum_promotion_uses_status" AS ENUM('pending', 'paid', 'cancelled');
  CREATE TABLE "promotions_program_groups" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_promotions_program_groups",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "promotions_channels" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_promotions_channels",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "promotions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"status" "enum_promotions_status" DEFAULT 'draft' NOT NULL,
  	"type" "enum_promotions_type" DEFAULT 'percent' NOT NULL,
  	"value" numeric NOT NULL,
  	"uses_per_family" numeric,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"everything" boolean,
  	"one_on_one_all" boolean,
  	"shop_all" boolean,
  	"tournaments_all" boolean,
  	"foundation_plus" boolean,
  	"subject" varchar,
  	"message" varchar,
  	"sms_text" varchar,
  	"audience" jsonb,
  	"scheduled_for" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"sent_counts" jsonb,
  	"approved_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "promotions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"programs_id" integer,
  	"academy_terms_id" integer,
  	"products_id" integer,
  	"selection_rounds_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "promotion_uses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"promotion_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"kind" "enum_promotion_uses_kind" NOT NULL,
  	"reference" varchar NOT NULL,
  	"status" "enum_promotion_uses_status" DEFAULT 'pending' NOT NULL,
  	"amount_off" numeric NOT NULL,
  	"paid_amount" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "academy_bookings" ADD COLUMN "discount" numeric;
  ALTER TABLE "academy_bookings" ADD COLUMN "promotion_id" integer;
  ALTER TABLE "bookings" ADD COLUMN "discount" numeric;
  ALTER TABLE "bookings" ADD COLUMN "promotion_id" integer;
  ALTER TABLE "orders" ADD COLUMN "discount" numeric;
  ALTER TABLE "orders" ADD COLUMN "promotion_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "promotions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "promotion_uses_id" integer;
  ALTER TABLE "promotions_program_groups" ADD CONSTRAINT "promotions_program_groups_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotions_channels" ADD CONSTRAINT "promotions_channels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotions" ADD CONSTRAINT "promotions_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotions_rels" ADD CONSTRAINT "promotions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotions_rels" ADD CONSTRAINT "promotions_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotions_rels" ADD CONSTRAINT "promotions_rels_academy_terms_fk" FOREIGN KEY ("academy_terms_id") REFERENCES "public"."academy_terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotions_rels" ADD CONSTRAINT "promotions_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotions_rels" ADD CONSTRAINT "promotions_rels_selection_rounds_fk" FOREIGN KEY ("selection_rounds_id") REFERENCES "public"."selection_rounds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotions_rels" ADD CONSTRAINT "promotions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_uses" ADD CONSTRAINT "promotion_uses_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_uses" ADD CONSTRAINT "promotion_uses_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "promotions_program_groups_order_idx" ON "promotions_program_groups" USING btree ("order");
  CREATE INDEX "promotions_program_groups_parent_idx" ON "promotions_program_groups" USING btree ("parent_id");
  CREATE INDEX "promotions_channels_order_idx" ON "promotions_channels" USING btree ("order");
  CREATE INDEX "promotions_channels_parent_idx" ON "promotions_channels" USING btree ("parent_id");
  CREATE INDEX "promotions_status_idx" ON "promotions" USING btree ("status");
  CREATE INDEX "promotions_approved_by_idx" ON "promotions" USING btree ("approved_by_id");
  CREATE INDEX "promotions_updated_at_idx" ON "promotions" USING btree ("updated_at");
  CREATE INDEX "promotions_created_at_idx" ON "promotions" USING btree ("created_at");
  CREATE INDEX "promotions_rels_order_idx" ON "promotions_rels" USING btree ("order");
  CREATE INDEX "promotions_rels_parent_idx" ON "promotions_rels" USING btree ("parent_id");
  CREATE INDEX "promotions_rels_path_idx" ON "promotions_rels" USING btree ("path");
  CREATE INDEX "promotions_rels_programs_id_idx" ON "promotions_rels" USING btree ("programs_id");
  CREATE INDEX "promotions_rels_academy_terms_id_idx" ON "promotions_rels" USING btree ("academy_terms_id");
  CREATE INDEX "promotions_rels_products_id_idx" ON "promotions_rels" USING btree ("products_id");
  CREATE INDEX "promotions_rels_selection_rounds_id_idx" ON "promotions_rels" USING btree ("selection_rounds_id");
  CREATE INDEX "promotions_rels_users_id_idx" ON "promotions_rels" USING btree ("users_id");
  CREATE INDEX "promotion_uses_promotion_idx" ON "promotion_uses" USING btree ("promotion_id");
  CREATE INDEX "promotion_uses_account_idx" ON "promotion_uses" USING btree ("account_id");
  CREATE INDEX "promotion_uses_reference_idx" ON "promotion_uses" USING btree ("reference");
  CREATE INDEX "promotion_uses_status_idx" ON "promotion_uses" USING btree ("status");
  CREATE INDEX "promotion_uses_updated_at_idx" ON "promotion_uses" USING btree ("updated_at");
  CREATE INDEX "promotion_uses_created_at_idx" ON "promotion_uses" USING btree ("created_at");
  ALTER TABLE "academy_bookings" ADD CONSTRAINT "academy_bookings_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promotions_fk" FOREIGN KEY ("promotions_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promotion_uses_fk" FOREIGN KEY ("promotion_uses_id") REFERENCES "public"."promotion_uses"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "academy_bookings_promotion_idx" ON "academy_bookings" USING btree ("promotion_id");
  CREATE INDEX "bookings_promotion_idx" ON "bookings" USING btree ("promotion_id");
  CREATE INDEX "orders_promotion_idx" ON "orders" USING btree ("promotion_id");
  CREATE INDEX "payload_locked_documents_rels_promotions_id_idx" ON "payload_locked_documents_rels" USING btree ("promotions_id");
  CREATE INDEX "payload_locked_documents_rels_promotion_uses_id_idx" ON "payload_locked_documents_rels" USING btree ("promotion_uses_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "promotions_program_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promotions_channels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promotions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promotions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promotion_uses" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "promotions_program_groups" CASCADE;
  DROP TABLE "promotions_channels" CASCADE;
  DROP TABLE "promotions" CASCADE;
  DROP TABLE "promotions_rels" CASCADE;
  DROP TABLE "promotion_uses" CASCADE;
  ALTER TABLE "academy_bookings" DROP CONSTRAINT IF EXISTS "academy_bookings_promotion_id_promotions_id_fk";
  
  ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_promotion_id_promotions_id_fk";
  
  ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_promotion_id_promotions_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_promotions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_promotion_uses_fk";
  
  DROP INDEX IF EXISTS "academy_bookings_promotion_idx";
  DROP INDEX IF EXISTS "bookings_promotion_idx";
  DROP INDEX IF EXISTS "orders_promotion_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_promotions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_promotion_uses_id_idx";
  ALTER TABLE "academy_bookings" DROP COLUMN "discount";
  ALTER TABLE "academy_bookings" DROP COLUMN "promotion_id";
  ALTER TABLE "bookings" DROP COLUMN "discount";
  ALTER TABLE "bookings" DROP COLUMN "promotion_id";
  ALTER TABLE "orders" DROP COLUMN "discount";
  ALTER TABLE "orders" DROP COLUMN "promotion_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "promotions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "promotion_uses_id";
  DROP TYPE "public"."enum_promotions_program_groups";
  DROP TYPE "public"."enum_promotions_channels";
  DROP TYPE "public"."enum_promotions_status";
  DROP TYPE "public"."enum_promotions_type";
  DROP TYPE "public"."enum_promotion_uses_kind";
  DROP TYPE "public"."enum_promotion_uses_status";`)
}
