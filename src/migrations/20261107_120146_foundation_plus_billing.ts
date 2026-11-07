import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_fplus_events_type" AS ENUM('trial_started', 'trial_converted', 'trial_cancelled', 'subscribed', 'reactivated', 'plan_changed', 'payment_failed', 'payment_recovered', 'cancelled', 'grace_expired', 'trial_blocked');
  ALTER TYPE "public"."enum_participants_memberships" ADD VALUE 'foundation-plus';
  CREATE TABLE "fplus_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar,
  	"type" "enum_fplus_events_type" NOT NULL,
  	"plan" varchar,
  	"amount" numeric,
  	"player_id" integer,
  	"account_id" integer,
  	"subscription_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "participants" ADD COLUMN "pdr_plan" varchar;
  ALTER TABLE "participants" ADD COLUMN "pdr_trial_ends_at" timestamp(3) with time zone;
  ALTER TABLE "participants" ADD COLUMN "pdr_current_period_end" timestamp(3) with time zone;
  ALTER TABLE "participants" ADD COLUMN "pdr_cancel_at_period_end" boolean;
  ALTER TABLE "participants" ADD COLUMN "pdr_past_due_since" timestamp(3) with time zone;
  ALTER TABLE "participants" ADD COLUMN "pdr_trial_used_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "stripe_customer_academy" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fplus_events_id" integer;
  ALTER TABLE "fplus_events" ADD CONSTRAINT "fplus_events_player_id_participants_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fplus_events" ADD CONSTRAINT "fplus_events_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "fplus_events_type_idx" ON "fplus_events" USING btree ("type");
  CREATE INDEX "fplus_events_player_idx" ON "fplus_events" USING btree ("player_id");
  CREATE INDEX "fplus_events_account_idx" ON "fplus_events" USING btree ("account_id");
  CREATE INDEX "fplus_events_subscription_id_idx" ON "fplus_events" USING btree ("subscription_id");
  CREATE INDEX "fplus_events_updated_at_idx" ON "fplus_events" USING btree ("updated_at");
  CREATE INDEX "fplus_events_created_at_idx" ON "fplus_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fplus_events_fk" FOREIGN KEY ("fplus_events_id") REFERENCES "public"."fplus_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "participants_pdr_pdr_subscription_id_idx" ON "participants" USING btree ("pdr_subscription_id");
  CREATE INDEX "users_stripe_customer_academy_idx" ON "users" USING btree ("stripe_customer_academy");
  CREATE INDEX "payload_locked_documents_rels_fplus_events_id_idx" ON "payload_locked_documents_rels" USING btree ("fplus_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "fplus_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "fplus_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fplus_events_fk";
  
  ALTER TABLE "participants_memberships" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_participants_memberships";
  CREATE TYPE "public"."enum_participants_memberships" AS ENUM('rowville', 'rfa');
  ALTER TABLE "participants_memberships" ALTER COLUMN "value" SET DATA TYPE "public"."enum_participants_memberships" USING "value"::"public"."enum_participants_memberships";
  DROP INDEX IF EXISTS "participants_pdr_pdr_subscription_id_idx";
  DROP INDEX IF EXISTS "users_stripe_customer_academy_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_fplus_events_id_idx";
  ALTER TABLE "participants" DROP COLUMN "pdr_plan";
  ALTER TABLE "participants" DROP COLUMN "pdr_trial_ends_at";
  ALTER TABLE "participants" DROP COLUMN "pdr_current_period_end";
  ALTER TABLE "participants" DROP COLUMN "pdr_cancel_at_period_end";
  ALTER TABLE "participants" DROP COLUMN "pdr_past_due_since";
  ALTER TABLE "participants" DROP COLUMN "pdr_trial_used_at";
  ALTER TABLE "users" DROP COLUMN "stripe_customer_academy";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "fplus_events_id";
  DROP TYPE "public"."enum_fplus_events_type";`)
}
