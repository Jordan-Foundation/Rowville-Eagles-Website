import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_invite_tokens_purpose" ADD VALUE 'fplus-trial';
  ALTER TYPE "public"."enum_invite_tokens_purpose" ADD VALUE 'fplus-join';
  CREATE TABLE "fplus_trial_cards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"fingerprint" varchar NOT NULL,
  	"account_id" integer,
  	"player_id" integer,
  	"subscription_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "participants" ADD COLUMN "pdr_trial_reminder_sent_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fplus_trial_cards_id" integer;
  ALTER TABLE "fplus_trial_cards" ADD CONSTRAINT "fplus_trial_cards_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fplus_trial_cards" ADD CONSTRAINT "fplus_trial_cards_player_id_participants_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "fplus_trial_cards_fingerprint_idx" ON "fplus_trial_cards" USING btree ("fingerprint");
  CREATE INDEX "fplus_trial_cards_account_idx" ON "fplus_trial_cards" USING btree ("account_id");
  CREATE INDEX "fplus_trial_cards_player_idx" ON "fplus_trial_cards" USING btree ("player_id");
  CREATE INDEX "fplus_trial_cards_updated_at_idx" ON "fplus_trial_cards" USING btree ("updated_at");
  CREATE INDEX "fplus_trial_cards_created_at_idx" ON "fplus_trial_cards" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fplus_trial_cards_fk" FOREIGN KEY ("fplus_trial_cards_id") REFERENCES "public"."fplus_trial_cards"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_fplus_trial_cards_id_idx" ON "payload_locked_documents_rels" USING btree ("fplus_trial_cards_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "fplus_trial_cards" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "fplus_trial_cards" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fplus_trial_cards_fk";
  
  ALTER TABLE "invite_tokens" ALTER COLUMN "purpose" SET DATA TYPE text;
  DROP TYPE "public"."enum_invite_tokens_purpose";
  CREATE TYPE "public"."enum_invite_tokens_purpose" AS ENUM('create-account', 'confirm-consent');
  ALTER TABLE "invite_tokens" ALTER COLUMN "purpose" SET DATA TYPE "public"."enum_invite_tokens_purpose" USING "purpose"::"public"."enum_invite_tokens_purpose";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_fplus_trial_cards_id_idx";
  ALTER TABLE "participants" DROP COLUMN "pdr_trial_reminder_sent_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "fplus_trial_cards_id";`)
}
