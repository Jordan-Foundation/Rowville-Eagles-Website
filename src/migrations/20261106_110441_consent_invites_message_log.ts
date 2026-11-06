import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_consent_review_status" AS ENUM('new', 'pending', 'sent', 'confirmed');
  CREATE TYPE "public"."enum_consent_records_channel" AS ENUM('service', 'marketing_email', 'marketing_sms', 'sms_all');
  CREATE TYPE "public"."enum_consent_records_action" AS ENUM('granted', 'withdrawn');
  CREATE TYPE "public"."enum_consent_records_basis" AS ENUM('express', 'inferred');
  CREATE TYPE "public"."enum_consent_records_source" AS ENUM('signup', 'checkout', 'profile', 'consent_email', 'unsubscribe_link', 'stop_reply', 'admin');
  CREATE TYPE "public"."enum_message_log_kind" AS ENUM('service', 'marketing');
  CREATE TYPE "public"."enum_message_log_sender" AS ENUM('club', 'academy');
  CREATE TYPE "public"."enum_message_log_status" AS ENUM('sent', 'failed', 'not-configured', 'skipped-opted-out');
  CREATE TYPE "public"."enum_invite_tokens_purpose" AS ENUM('create-account', 'confirm-consent');
  CREATE TABLE "consent_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"email" varchar,
  	"phone" varchar,
  	"channel" "enum_consent_records_channel" NOT NULL,
  	"action" "enum_consent_records_action" NOT NULL,
  	"basis" "enum_consent_records_basis",
  	"wording" varchar NOT NULL,
  	"source" "enum_consent_records_source" NOT NULL,
  	"ip" varchar,
  	"user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "message_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"to" varchar NOT NULL,
  	"subject" varchar NOT NULL,
  	"kind" "enum_message_log_kind" NOT NULL,
  	"sender" "enum_message_log_sender",
  	"user_id" numeric,
  	"status" "enum_message_log_status",
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "invite_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"purpose" "enum_invite_tokens_purpose" NOT NULL,
  	"user_id" integer NOT NULL,
  	"email" varchar NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "service_consent_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "marketing_email" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "marketing_sms" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "sms_opt_out" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "consent_review_status" "enum_users_consent_review_status" DEFAULT 'new';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consent_records_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "message_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invite_tokens_id" integer;
  ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "consent_records_user_idx" ON "consent_records" USING btree ("user_id");
  CREATE INDEX "consent_records_email_idx" ON "consent_records" USING btree ("email");
  CREATE INDEX "consent_records_phone_idx" ON "consent_records" USING btree ("phone");
  CREATE INDEX "consent_records_updated_at_idx" ON "consent_records" USING btree ("updated_at");
  CREATE INDEX "consent_records_created_at_idx" ON "consent_records" USING btree ("created_at");
  CREATE INDEX "message_log_to_idx" ON "message_log" USING btree ("to");
  CREATE INDEX "message_log_user_id_idx" ON "message_log" USING btree ("user_id");
  CREATE INDEX "message_log_updated_at_idx" ON "message_log" USING btree ("updated_at");
  CREATE INDEX "message_log_created_at_idx" ON "message_log" USING btree ("created_at");
  CREATE INDEX "invite_tokens_user_idx" ON "invite_tokens" USING btree ("user_id");
  CREATE UNIQUE INDEX "invite_tokens_token_hash_idx" ON "invite_tokens" USING btree ("token_hash");
  CREATE INDEX "invite_tokens_updated_at_idx" ON "invite_tokens" USING btree ("updated_at");
  CREATE INDEX "invite_tokens_created_at_idx" ON "invite_tokens" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_records_fk" FOREIGN KEY ("consent_records_id") REFERENCES "public"."consent_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_message_log_fk" FOREIGN KEY ("message_log_id") REFERENCES "public"."message_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invite_tokens_fk" FOREIGN KEY ("invite_tokens_id") REFERENCES "public"."invite_tokens"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_consent_records_id_idx" ON "payload_locked_documents_rels" USING btree ("consent_records_id");
  CREATE INDEX "payload_locked_documents_rels_message_log_id_idx" ON "payload_locked_documents_rels" USING btree ("message_log_id");
  CREATE INDEX "payload_locked_documents_rels_invite_tokens_id_idx" ON "payload_locked_documents_rels" USING btree ("invite_tokens_id");
  -- Data: everyone who already has an account is an existing member. Treat them as opted OUT of marketing
  -- (column defaults are false) and flag them for the one-time "confirm your preferences" email.
  UPDATE "users" SET "consent_review_status" = 'pending', "marketing_email" = false, "marketing_sms" = false;
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "consent_records" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "message_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "invite_tokens" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "consent_records" CASCADE;
  DROP TABLE "message_log" CASCADE;
  DROP TABLE "invite_tokens" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consent_records_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_message_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invite_tokens_fk";
  
  DROP INDEX "payload_locked_documents_rels_consent_records_id_idx";
  DROP INDEX "payload_locked_documents_rels_message_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_invite_tokens_id_idx";
  ALTER TABLE "users" DROP COLUMN "service_consent_at";
  ALTER TABLE "users" DROP COLUMN "marketing_email";
  ALTER TABLE "users" DROP COLUMN "marketing_sms";
  ALTER TABLE "users" DROP COLUMN "sms_opt_out";
  ALTER TABLE "users" DROP COLUMN "consent_review_status";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "consent_records_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "message_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invite_tokens_id";
  DROP TYPE "public"."enum_users_consent_review_status";
  DROP TYPE "public"."enum_consent_records_channel";
  DROP TYPE "public"."enum_consent_records_action";
  DROP TYPE "public"."enum_consent_records_basis";
  DROP TYPE "public"."enum_consent_records_source";
  DROP TYPE "public"."enum_message_log_kind";
  DROP TYPE "public"."enum_message_log_sender";
  DROP TYPE "public"."enum_message_log_status";
  DROP TYPE "public"."enum_invite_tokens_purpose";`)
}
