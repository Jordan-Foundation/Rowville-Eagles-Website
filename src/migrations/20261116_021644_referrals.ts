import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_referral_invites_featured" AS ENUM('academy-term', 'holiday-camp', 'mini-ballers', 'one-on-one', 'eagles');
  CREATE TYPE "public"."enum_referral_invites_status" AS ENUM('invited', 'signed_up', 'trial_registered', 'paid', 'expired');
  CREATE TYPE "public"."enum_referrals_attribution" AS ENUM('code', 'invite_match', 'manual');
  CREATE TYPE "public"."enum_referrals_program" AS ENUM('academy-term', 'holiday-camp', 'mini-ballers', 'one-on-one', 'eagles');
  CREATE TYPE "public"."enum_referrals_source_kind" AS ENUM('booking', 'academy');
  CREATE TYPE "public"."enum_referrals_status" AS ENUM('pending', 'confirmed', 'voided');
  CREATE TYPE "public"."enum_referral_milestones_reward_type" AS ENUM('physical_item', 'one_on_one_credit', 'academy_term_credit');
  CREATE TYPE "public"."enum_referral_rewards_status" AS ENUM('unlocked', 'claimed', 'fulfilled', 'redeemed', 'held');
  ALTER TYPE "public"."enum_academy_credits_reason" ADD VALUE 'referral' BEFORE 'used';
  CREATE TABLE "referral_invites" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"referrer_id" integer NOT NULL,
  	"sent_by_id" integer NOT NULL,
  	"invitee_name" varchar,
  	"invitee_email" varchar,
  	"invitee_phone" varchar,
  	"featured" "enum_referral_invites_featured" NOT NULL,
  	"status" "enum_referral_invites_status" DEFAULT 'invited' NOT NULL,
  	"account_id" integer,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "referrals_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"action" varchar,
  	"by_id" integer,
  	"note" varchar
  );
  
  CREATE TABLE "referrals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"referrer_id" integer NOT NULL,
  	"referrer_account_id" integer,
  	"referred_id" integer NOT NULL,
  	"referred_account_id" integer,
  	"invite_id" integer,
  	"attribution" "enum_referrals_attribution" NOT NULL,
  	"program" "enum_referrals_program" NOT NULL,
  	"source_kind" "enum_referrals_source_kind" NOT NULL,
  	"source_id" numeric NOT NULL,
  	"reference" varchar,
  	"amount" numeric,
  	"paid_at" timestamp(3) with time zone NOT NULL,
  	"confirm_after" timestamp(3) with time zone NOT NULL,
  	"status" "enum_referrals_status" DEFAULT 'pending' NOT NULL,
  	"confirmed_at" timestamp(3) with time zone,
  	"review_flag" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "referral_milestones" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"threshold" numeric NOT NULL,
  	"reward_name" varchar NOT NULL,
  	"reward_type" "enum_referral_milestones_reward_type" DEFAULT 'physical_item' NOT NULL,
  	"sizes" varchar,
  	"active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "referral_rewards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"participant_id" integer NOT NULL,
  	"account_id" integer,
  	"milestone_id" integer NOT NULL,
  	"status" "enum_referral_rewards_status" DEFAULT 'unlocked' NOT NULL,
  	"size" varchar,
  	"claimed_at" timestamp(3) with time zone,
  	"fulfilled_at" timestamp(3) with time zone,
  	"credit_id" integer,
  	"promotion_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "referral_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"windows_eagles" numeric DEFAULT 14,
  	"windows_academy_term" numeric DEFAULT 14,
  	"windows_holiday_camp" numeric DEFAULT 14,
  	"windows_mini_ballers" numeric DEFAULT 14,
  	"daily_invite_limit" numeric DEFAULT 10,
  	"invite_expiry_days" numeric DEFAULT 60,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "academy_bookings" ADD COLUMN "referral_code" varchar;
  ALTER TABLE "selection_entries" ADD COLUMN "referral_code" varchar;
  ALTER TABLE "bookings" ADD COLUMN "referral_code" varchar;
  ALTER TABLE "participants" ADD COLUMN "referral_code" varchar;
  ALTER TABLE "users" ADD COLUMN "referral_code" varchar;
  ALTER TABLE "users" ADD COLUMN "referral_code_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "referral_invites_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "referrals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "referral_milestones_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "referral_rewards_id" integer;
  ALTER TABLE "referral_invites" ADD CONSTRAINT "referral_invites_referrer_id_participants_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referral_invites" ADD CONSTRAINT "referral_invites_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referral_invites" ADD CONSTRAINT "referral_invites_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referrals_history" ADD CONSTRAINT "referrals_history_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referrals_history" ADD CONSTRAINT "referrals_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_participants_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_account_id_users_id_fk" FOREIGN KEY ("referrer_account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_participants_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_account_id_users_id_fk" FOREIGN KEY ("referred_account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invite_id_referral_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."referral_invites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_milestone_id_referral_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."referral_milestones"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_credit_id_academy_credits_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."academy_credits"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "referral_invites_token_idx" ON "referral_invites" USING btree ("token");
  CREATE INDEX "referral_invites_referrer_idx" ON "referral_invites" USING btree ("referrer_id");
  CREATE INDEX "referral_invites_sent_by_idx" ON "referral_invites" USING btree ("sent_by_id");
  CREATE INDEX "referral_invites_invitee_email_idx" ON "referral_invites" USING btree ("invitee_email");
  CREATE INDEX "referral_invites_invitee_phone_idx" ON "referral_invites" USING btree ("invitee_phone");
  CREATE INDEX "referral_invites_status_idx" ON "referral_invites" USING btree ("status");
  CREATE INDEX "referral_invites_account_idx" ON "referral_invites" USING btree ("account_id");
  CREATE INDEX "referral_invites_updated_at_idx" ON "referral_invites" USING btree ("updated_at");
  CREATE INDEX "referral_invites_created_at_idx" ON "referral_invites" USING btree ("created_at");
  CREATE INDEX "referrals_history_order_idx" ON "referrals_history" USING btree ("_order");
  CREATE INDEX "referrals_history_parent_id_idx" ON "referrals_history" USING btree ("_parent_id");
  CREATE INDEX "referrals_history_by_idx" ON "referrals_history" USING btree ("by_id");
  CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id");
  CREATE INDEX "referrals_referrer_account_idx" ON "referrals" USING btree ("referrer_account_id");
  CREATE UNIQUE INDEX "referrals_referred_idx" ON "referrals" USING btree ("referred_id");
  CREATE INDEX "referrals_referred_account_idx" ON "referrals" USING btree ("referred_account_id");
  CREATE INDEX "referrals_invite_idx" ON "referrals" USING btree ("invite_id");
  CREATE INDEX "referrals_program_idx" ON "referrals" USING btree ("program");
  CREATE INDEX "referrals_source_id_idx" ON "referrals" USING btree ("source_id");
  CREATE INDEX "referrals_reference_idx" ON "referrals" USING btree ("reference");
  CREATE INDEX "referrals_confirm_after_idx" ON "referrals" USING btree ("confirm_after");
  CREATE INDEX "referrals_status_idx" ON "referrals" USING btree ("status");
  CREATE INDEX "referrals_updated_at_idx" ON "referrals" USING btree ("updated_at");
  CREATE INDEX "referrals_created_at_idx" ON "referrals" USING btree ("created_at");
  CREATE UNIQUE INDEX "referral_milestones_threshold_idx" ON "referral_milestones" USING btree ("threshold");
  CREATE INDEX "referral_milestones_updated_at_idx" ON "referral_milestones" USING btree ("updated_at");
  CREATE INDEX "referral_milestones_created_at_idx" ON "referral_milestones" USING btree ("created_at");
  CREATE INDEX "referral_rewards_participant_idx" ON "referral_rewards" USING btree ("participant_id");
  CREATE INDEX "referral_rewards_account_idx" ON "referral_rewards" USING btree ("account_id");
  CREATE INDEX "referral_rewards_milestone_idx" ON "referral_rewards" USING btree ("milestone_id");
  CREATE INDEX "referral_rewards_status_idx" ON "referral_rewards" USING btree ("status");
  CREATE INDEX "referral_rewards_credit_idx" ON "referral_rewards" USING btree ("credit_id");
  CREATE INDEX "referral_rewards_promotion_idx" ON "referral_rewards" USING btree ("promotion_id");
  CREATE INDEX "referral_rewards_updated_at_idx" ON "referral_rewards" USING btree ("updated_at");
  CREATE INDEX "referral_rewards_created_at_idx" ON "referral_rewards" USING btree ("created_at");
  CREATE UNIQUE INDEX "participant_milestone_idx" ON "referral_rewards" USING btree ("participant_id","milestone_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_referral_invites_fk" FOREIGN KEY ("referral_invites_id") REFERENCES "public"."referral_invites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_referrals_fk" FOREIGN KEY ("referrals_id") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_referral_milestones_fk" FOREIGN KEY ("referral_milestones_id") REFERENCES "public"."referral_milestones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_referral_rewards_fk" FOREIGN KEY ("referral_rewards_id") REFERENCES "public"."referral_rewards"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "academy_bookings_referral_code_idx" ON "academy_bookings" USING btree ("referral_code");
  CREATE INDEX "selection_entries_referral_code_idx" ON "selection_entries" USING btree ("referral_code");
  CREATE INDEX "bookings_referral_code_idx" ON "bookings" USING btree ("referral_code");
  CREATE UNIQUE INDEX "participants_referral_code_idx" ON "participants" USING btree ("referral_code");
  CREATE INDEX "users_referral_code_idx" ON "users" USING btree ("referral_code");
  CREATE INDEX "payload_locked_documents_rels_referral_invites_id_idx" ON "payload_locked_documents_rels" USING btree ("referral_invites_id");
  CREATE INDEX "payload_locked_documents_rels_referrals_id_idx" ON "payload_locked_documents_rels" USING btree ("referrals_id");
  CREATE INDEX "payload_locked_documents_rels_referral_milestones_id_idx" ON "payload_locked_documents_rels" USING btree ("referral_milestones_id");
  CREATE INDEX "payload_locked_documents_rels_referral_rewards_id_idx" ON "payload_locked_documents_rels" USING btree ("referral_rewards_id");`)
  // The five standard Refer a Friend rewards (editable in Admin → Referrals)
  await db.execute(sql`
  INSERT INTO "referral_milestones" ("threshold", "reward_name", "reward_type", "sizes", "active", "sort_order", "updated_at", "created_at") VALUES
    (2, 'Free kit', 'physical_item', '120, 130, 140, 150, 160, S, M, L, XL, 2XL', true, 1, now(), now()),
    (4, 'Free bag', 'physical_item', NULL, true, 2, now(), now()),
    (6, 'Free hoodie', 'physical_item', '120, 130, 140, 150, 160, S, M, L, XL, 2XL', true, 3, now(), now()),
    (8, 'Free 1-on-1 session', 'one_on_one_credit', NULL, true, 4, now(), now()),
    (10, 'Free Academy term', 'academy_term_credit', NULL, true, 5, now(), now())
  ON CONFLICT ("threshold") DO NOTHING;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "referral_invites" CASCADE;
  DROP TABLE IF EXISTS "referrals_history" CASCADE;
  DROP TABLE IF EXISTS "referrals" CASCADE;
  DROP TABLE IF EXISTS "referral_milestones" CASCADE;
  DROP TABLE IF EXISTS "referral_rewards" CASCADE;
  DROP TABLE IF EXISTS "referral_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_referral_invites_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_referrals_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_referral_milestones_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_referral_rewards_fk";
  
  ALTER TABLE "academy_credits" ALTER COLUMN "reason" SET DATA TYPE text;
  UPDATE "academy_credits" SET "reason" = 'goodwill' WHERE "reason" = 'referral';
  ALTER TABLE "academy_credits" ALTER COLUMN "reason" SET DATA TYPE text;
  DROP TYPE "public"."enum_academy_credits_reason";
  CREATE TYPE "public"."enum_academy_credits_reason" AS ENUM('cancellation', 'coach_cancellation', 'goodwill', 'used', 'adjustment');
  ALTER TABLE "academy_credits" ALTER COLUMN "reason" SET DATA TYPE "public"."enum_academy_credits_reason" USING "reason"::"public"."enum_academy_credits_reason";
  DROP INDEX IF EXISTS "academy_bookings_referral_code_idx";
  DROP INDEX IF EXISTS "selection_entries_referral_code_idx";
  DROP INDEX IF EXISTS "bookings_referral_code_idx";
  DROP INDEX IF EXISTS "participants_referral_code_idx";
  DROP INDEX IF EXISTS "users_referral_code_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_referral_invites_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_referrals_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_referral_milestones_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_referral_rewards_id_idx";
  ALTER TABLE "academy_bookings" DROP COLUMN IF EXISTS "referral_code";
  ALTER TABLE "selection_entries" DROP COLUMN IF EXISTS "referral_code";
  ALTER TABLE "bookings" DROP COLUMN IF EXISTS "referral_code";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "referral_code";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "referral_code";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "referral_code_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "referral_invites_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "referrals_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "referral_milestones_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "referral_rewards_id";
  DROP TYPE "public"."enum_referral_invites_featured";
  DROP TYPE "public"."enum_referral_invites_status";
  DROP TYPE "public"."enum_referrals_attribution";
  DROP TYPE "public"."enum_referrals_program";
  DROP TYPE "public"."enum_referrals_source_kind";
  DROP TYPE "public"."enum_referrals_status";
  DROP TYPE "public"."enum_referral_milestones_reward_type";
  DROP TYPE "public"."enum_referral_rewards_status";`)
}
