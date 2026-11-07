import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_message_log_channel" AS ENUM('email', 'sms', 'sms_in', 'call');
  ALTER TYPE "public"."enum_message_log_status" ADD VALUE 'received';
  ALTER TYPE "public"."enum_message_log_status" ADD VALUE 'answered';
  ALTER TYPE "public"."enum_message_log_status" ADD VALUE 'missed';
  ALTER TYPE "public"."enum_message_log_status" ADD VALUE 'voicemail';
  ALTER TABLE "users" ADD COLUMN "phone_e164" varchar;
  ALTER TABLE "message_log" ADD COLUMN "channel" "enum_message_log_channel" DEFAULT 'email';
  ALTER TABLE "message_log" ADD COLUMN "provider_id" varchar;
  ALTER TABLE "academy_settings" ADD COLUMN "call_forward_to" varchar;
  ALTER TABLE "academy_settings" ADD COLUMN "voicemail_greeting" varchar DEFAULT 'Thanks for calling Foundation Academy. We can’t take your call right now. Please leave your name, your child’s name and a message after the tone, and we’ll call you back as soon as we can.';
  CREATE INDEX "users_phone_e164_idx" ON "users" USING btree ("phone_e164");
  CREATE INDEX "message_log_channel_idx" ON "message_log" USING btree ("channel");
  CREATE INDEX "message_log_provider_id_idx" ON "message_log" USING btree ("provider_id");`)
  // Normalised mobiles for matching texts/calls to accounts (same rules as toE164)
  await db.execute(sql`
  UPDATE "users" u SET "phone_e164" = CASE
      WHEN n.d ~ '^04[0-9]{8}$' THEN '+61' || substr(n.d, 2)
      WHEN n.d ~ '^[+]614[0-9]{8}$' THEN n.d
      WHEN n.d ~ '^614[0-9]{8}$' THEN '+' || n.d
    END
  FROM (SELECT "id", regexp_replace(coalesce("phone", ''), '[[:space:]()-]', '', 'g') AS d FROM "users") n
  WHERE n."id" = u."id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "message_log" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "public"."enum_message_log_status";
  CREATE TYPE "public"."enum_message_log_status" AS ENUM('sent', 'failed', 'not-configured', 'skipped-opted-out');
  ALTER TABLE "message_log" ALTER COLUMN "status" SET DATA TYPE "public"."enum_message_log_status" USING "status"::"public"."enum_message_log_status";
  DROP INDEX "users_phone_e164_idx";
  DROP INDEX "message_log_channel_idx";
  DROP INDEX "message_log_provider_id_idx";
  ALTER TABLE "users" DROP COLUMN "phone_e164";
  ALTER TABLE "message_log" DROP COLUMN "channel";
  ALTER TABLE "message_log" DROP COLUMN "provider_id";
  ALTER TABLE "academy_settings" DROP COLUMN "call_forward_to";
  ALTER TABLE "academy_settings" DROP COLUMN "voicemail_greeting";
  DROP TYPE "public"."enum_message_log_channel";`)
}
