import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_bookings_adjustments_action" AS ENUM('cancel_booking', 'cancel_sessions', 'makeup', 'goodwill');
  CREATE TYPE "public"."enum_academy_bookings_adjustments_by" AS ENUM('family', 'coach', 'admin');
  CREATE TYPE "public"."enum_academy_bookings_adjustments_outcome" AS ENUM('refund', 'credit', 'makeup', 'none');
  CREATE TYPE "public"."enum_academy_bookings_adjustments_refund_status" AS ENUM('none', 'pending', 'refunded', 'failed', 'simulated');
  CREATE TYPE "public"."enum_academy_sessions_cancelled_by" AS ENUM('family', 'coach', 'admin');
  CREATE TYPE "public"."enum_academy_credits_status" AS ENUM('active', 'pending', 'void');
  CREATE TYPE "public"."enum_academy_credits_reason" AS ENUM('cancellation', 'coach_cancellation', 'goodwill', 'used', 'adjustment');
  CREATE TABLE "academy_bookings_adjustments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"action" "enum_academy_bookings_adjustments_action" NOT NULL,
  	"by" "enum_academy_bookings_adjustments_by",
  	"outcome" "enum_academy_bookings_adjustments_outcome",
  	"sessions" varchar,
  	"cash" numeric,
  	"credit" numeric,
  	"refund_status" "enum_academy_bookings_adjustments_refund_status",
  	"rule" varchar,
  	"reason" varchar,
  	"stripe_refund_ids" varchar,
  	"error" varchar,
  	"actor_id" integer,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "academy_credits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"amount" numeric NOT NULL,
  	"status" "enum_academy_credits_status" DEFAULT 'active' NOT NULL,
  	"reason" "enum_academy_credits_reason" NOT NULL,
  	"booking_id" integer,
  	"note" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "academy_bookings" ADD COLUMN "credit_applied" numeric DEFAULT 0;
  ALTER TABLE "academy_bookings" ADD COLUMN "refunded_amount" numeric DEFAULT 0;
  ALTER TABLE "academy_bookings" ADD COLUMN "credited_amount" numeric DEFAULT 0;
  ALTER TABLE "academy_sessions" ADD COLUMN "cancelled_by" "enum_academy_sessions_cancelled_by";
  ALTER TABLE "academy_sessions" ADD COLUMN "cancelled_at" timestamp(3) with time zone;
  ALTER TABLE "academy_sessions" ADD COLUMN "cancel_reason" varchar;
  ALTER TABLE "academy_sessions" ADD COLUMN "make_up_for_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_credits_id" integer;
  ALTER TABLE "academy_bookings_adjustments" ADD CONSTRAINT "academy_bookings_adjustments_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_bookings_adjustments" ADD CONSTRAINT "academy_bookings_adjustments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_credits" ADD CONSTRAINT "academy_credits_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_credits" ADD CONSTRAINT "academy_credits_booking_id_academy_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."academy_bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_credits" ADD CONSTRAINT "academy_credits_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "academy_bookings_adjustments_order_idx" ON "academy_bookings_adjustments" USING btree ("_order");
  CREATE INDEX "academy_bookings_adjustments_parent_id_idx" ON "academy_bookings_adjustments" USING btree ("_parent_id");
  CREATE INDEX "academy_bookings_adjustments_actor_idx" ON "academy_bookings_adjustments" USING btree ("actor_id");
  CREATE INDEX "academy_credits_account_idx" ON "academy_credits" USING btree ("account_id");
  CREATE INDEX "academy_credits_status_idx" ON "academy_credits" USING btree ("status");
  CREATE INDEX "academy_credits_booking_idx" ON "academy_credits" USING btree ("booking_id");
  CREATE INDEX "academy_credits_created_by_idx" ON "academy_credits" USING btree ("created_by_id");
  CREATE INDEX "academy_credits_updated_at_idx" ON "academy_credits" USING btree ("updated_at");
  CREATE INDEX "academy_credits_created_at_idx" ON "academy_credits" USING btree ("created_at");
  ALTER TABLE "academy_sessions" ADD CONSTRAINT "academy_sessions_make_up_for_id_academy_sessions_id_fk" FOREIGN KEY ("make_up_for_id") REFERENCES "public"."academy_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_credits_fk" FOREIGN KEY ("academy_credits_id") REFERENCES "public"."academy_credits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "academy_sessions_make_up_for_idx" ON "academy_sessions" USING btree ("make_up_for_id");
  CREATE INDEX "payload_locked_documents_rels_academy_credits_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_credits_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_bookings_adjustments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "academy_credits" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "academy_bookings_adjustments" CASCADE;
  DROP TABLE "academy_credits" CASCADE;
  ALTER TABLE "academy_sessions" DROP CONSTRAINT "academy_sessions_make_up_for_id_academy_sessions_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_academy_credits_fk";
  
  DROP INDEX "academy_sessions_make_up_for_idx";
  DROP INDEX "payload_locked_documents_rels_academy_credits_id_idx";
  ALTER TABLE "academy_bookings" DROP COLUMN "credit_applied";
  ALTER TABLE "academy_bookings" DROP COLUMN "refunded_amount";
  ALTER TABLE "academy_bookings" DROP COLUMN "credited_amount";
  ALTER TABLE "academy_sessions" DROP COLUMN "cancelled_by";
  ALTER TABLE "academy_sessions" DROP COLUMN "cancelled_at";
  ALTER TABLE "academy_sessions" DROP COLUMN "cancel_reason";
  ALTER TABLE "academy_sessions" DROP COLUMN "make_up_for_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_credits_id";
  DROP TYPE "public"."enum_academy_bookings_adjustments_action";
  DROP TYPE "public"."enum_academy_bookings_adjustments_by";
  DROP TYPE "public"."enum_academy_bookings_adjustments_outcome";
  DROP TYPE "public"."enum_academy_bookings_adjustments_refund_status";
  DROP TYPE "public"."enum_academy_sessions_cancelled_by";
  DROP TYPE "public"."enum_academy_credits_status";
  DROP TYPE "public"."enum_academy_credits_reason";`)
}
