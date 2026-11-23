import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_import_batches_status" AS ENUM('imported', 'undone');
  CREATE TYPE "public"."enum_participants_imported_registration_status" AS ENUM('paid', 'not_paid', 'na');
  CREATE TYPE "public"."enum_users_launch_email_status" AS ENUM('sent', 'delivered', 'bounced', 'failed');
  CREATE TYPE "public"."enum_users_launch_sms_status" AS ENUM('sent', 'delivered', 'failed', 'skipped');
  CREATE TYPE "public"."enum_users_launch_follow_up_status" AS ENUM('sent', 'delivered', 'bounced', 'failed');
  CREATE TYPE "public"."enum_portal_launch_run_status" AS ENUM('idle', 'scheduled', 'sending', 'done');
  CREATE TABLE "import_batches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"file_name" varchar NOT NULL,
  	"by_id" integer,
  	"status" "enum_import_batches_status" DEFAULT 'imported',
  	"counts" jsonb,
  	"log" jsonb,
  	"undone_at" timestamp(3) with time zone,
  	"undone_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "portal_launch" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"launch_subject" varchar DEFAULT 'Your new Rowville Eagles portal is ready, {{parent_first_name}}',
  	"launch_body" varchar DEFAULT 'Hi {{parent_first_name}},
  
  We''ve launched our new club website and player portal, and we''ve already set everything up for {{player_names}}. Your details, team and shirt number are all in, so there''s nothing to fill in.
  
  [[Open my account|{{activation_link}}]]
  
  Tap the button, choose a password, and you''re in. This link is just for you and works for 14 days.
  
  {{player_numbers_list}}
  
  **What you can do in the portal**
  - **Team page** – notice board, fixtures, training times and the parent forum, all in one place
  - **Instant updates** – get a notification when training is cancelled, a fixture changes or the coach posts news
  - **Book and pay online** – 1-on-1s, academy terms and holiday camps, any time
  - **One login for the whole family** – all your kids in the one account
  
  **Add it to your phone as an app (30 seconds)**
  
  *iPhone*
  1. Open the link above in **Safari**
  2. Tap the **Share** button (the square with the arrow)
  3. Scroll down and tap **Add to Home Screen**, then **Add**
  4. Open the new Rowville Eagles icon on your home screen and tap **Allow** when it asks about notifications
  
  *Android*
  1. Open the link above in **Chrome**
  2. Tap the **⋮** menu (top right)
  3. Tap **Install app** or **Add to Home screen**
  4. Open the app and tap **Allow** for notifications
  
  On iPhone, notifications only work once it''s on your home screen, so it''s worth the 30 seconds.
  
  Questions? Just reply to this email or call/text us on {{club_phone}}.
  
  See you at training,
  Jordan, Lachlan and the Foundation Football team',
  	"launch_sms" varchar DEFAULT 'Rowville Eagles: Hi {{parent_first_name}}, our new club portal is live and {{player_names}} is already set up. Tap to open your account: {{short_link}} Then add it to your home screen as an app - steps are in your email. Reply STOP to opt out',
  	"follow_up_subject" varchar DEFAULT 'Booking 1-on-1s is now done in the app',
  	"follow_up_body" varchar DEFAULT 'Hi {{parent_first_name}},
  
  {{#not_activated}}**You haven''t opened your account yet** – it takes a minute and everything is already set up.
  
  [[Open my account|{{activation_link}}]]
  
  {{/not_activated}}Now that the portal is up and running, all 1-on-1 sessions are booked and paid for in the app from here on.
  
  **How to book**
  1. Open the app and tap **Book a 1-on-1**
  2. Choose your coach
  3. Pick a single session or a full term
  4. Choose a time that suits
  5. Pay securely by card – you''ll get a confirmation straight away and a reminder before each session
  
  **When sessions run**
  {{one_on_one_hours}}
  
  Popular times go quickly, so it''s worth booking early – especially for a full term.
  
  [[Book a 1-on-1|{{book_link}}]]
  
  Any 1-on-1s you''ve already arranged with your coach go ahead as planned. Need to cancel? Do it 24 hours or more before the session and you''ll get it back as a session credit or refund – cancellations inside 24 hours can''t be refunded.
  
  Any questions, reply here or call/text {{club_phone}}.
  
  Cheers,
  Jordan, Lachlan and the Foundation Football team',
  	"reminder_enabled" boolean DEFAULT true,
  	"reminder_days" numeric DEFAULT 5,
  	"follow_up_days" numeric DEFAULT 7,
  	"follow_up_paused" boolean DEFAULT false,
  	"run_status" "enum_portal_launch_run_status" DEFAULT 'idle',
  	"run_scheduled_for" timestamp(3) with time zone,
  	"run_filter" jsonb,
  	"run_by_id" integer,
  	"run_started_at" timestamp(3) with time zone,
  	"run_finished_at" timestamp(3) with time zone,
  	"run_counts" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "participants" ADD COLUMN "imported_batch_id" integer;
  ALTER TABLE "participants" ADD COLUMN "imported_registration_status" "enum_participants_imported_registration_status";
  ALTER TABLE "participants" ADD COLUMN "imported_registration_source" varchar;
  ALTER TABLE "participants" ADD COLUMN "imported_mobile" varchar;
  ALTER TABLE "participants" ADD COLUMN "imported_email" varchar;
  ALTER TABLE "participants" ADD COLUMN "imported_owing_email_at" timestamp(3) with time zone;
  ALTER TABLE "participants" ADD COLUMN "imported_notes" varchar;
  ALTER TABLE "users" ADD COLUMN "family_account_id" integer;
  ALTER TABLE "users" ADD COLUMN "imported_batch_id" integer;
  ALTER TABLE "users" ADD COLUMN "imported_relationship" varchar;
  ALTER TABLE "users" ADD COLUMN "imported_prior_client" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "imported_suburb" varchar;
  ALTER TABLE "users" ADD COLUMN "imported_postcode" varchar;
  ALTER TABLE "users" ADD COLUMN "imported_gets_messages" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "launch_email_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "launch_email_status" "enum_users_launch_email_status";
  ALTER TABLE "users" ADD COLUMN "launch_sms_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "launch_sms_status" "enum_users_launch_sms_status";
  ALTER TABLE "users" ADD COLUMN "launch_sms_sid" varchar;
  ALTER TABLE "users" ADD COLUMN "launch_sms_tries" numeric;
  ALTER TABLE "users" ADD COLUMN "launch_reminder_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "launch_follow_up_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "launch_follow_up_status" "enum_users_launch_follow_up_status";
  ALTER TABLE "users" ADD COLUMN "launch_unsubscribed_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "launch_email_subject" varchar;
  ALTER TABLE "users" ADD COLUMN "launch_follow_up_subject" varchar;
  ALTER TABLE "users" ADD COLUMN "launch_short_code" varchar;
  ALTER TABLE "users" ADD COLUMN "launch_short_code_expires" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "import_batches_id" integer;
  ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_undone_by_id_users_id_fk" FOREIGN KEY ("undone_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portal_launch" ADD CONSTRAINT "portal_launch_run_by_id_users_id_fk" FOREIGN KEY ("run_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "import_batches_by_idx" ON "import_batches" USING btree ("by_id");
  CREATE INDEX "import_batches_status_idx" ON "import_batches" USING btree ("status");
  CREATE INDEX "import_batches_undone_by_idx" ON "import_batches" USING btree ("undone_by_id");
  CREATE INDEX "import_batches_updated_at_idx" ON "import_batches" USING btree ("updated_at");
  CREATE INDEX "import_batches_created_at_idx" ON "import_batches" USING btree ("created_at");
  CREATE INDEX "portal_launch_run_run_by_idx" ON "portal_launch" USING btree ("run_by_id");
  ALTER TABLE "participants" ADD CONSTRAINT "participants_imported_batch_id_import_batches_id_fk" FOREIGN KEY ("imported_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_family_account_id_users_id_fk" FOREIGN KEY ("family_account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_imported_batch_id_import_batches_id_fk" FOREIGN KEY ("imported_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_batches_fk" FOREIGN KEY ("import_batches_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "participants_imported_imported_batch_idx" ON "participants" USING btree ("imported_batch_id");
  CREATE INDEX "participants_imported_imported_registration_status_idx" ON "participants" USING btree ("imported_registration_status");
  CREATE INDEX "users_family_account_idx" ON "users" USING btree ("family_account_id");
  CREATE INDEX "users_imported_imported_batch_idx" ON "users" USING btree ("imported_batch_id");
  CREATE INDEX "users_launch_launch_email_at_idx" ON "users" USING btree ("launch_email_at");
  CREATE INDEX "users_launch_launch_sms_sid_idx" ON "users" USING btree ("launch_sms_sid");
  CREATE UNIQUE INDEX "users_launch_launch_short_code_idx" ON "users" USING btree ("launch_short_code");
  CREATE INDEX "payload_locked_documents_rels_import_batches_id_idx" ON "payload_locked_documents_rels" USING btree ("import_batches_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "import_batches" CASCADE;
  DROP TABLE IF EXISTS "portal_launch" CASCADE;
  ALTER TABLE "participants" DROP CONSTRAINT IF EXISTS "participants_imported_batch_id_import_batches_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_family_account_id_users_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_imported_batch_id_import_batches_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_import_batches_fk";
  
  DROP INDEX IF EXISTS "participants_imported_imported_batch_idx";
  DROP INDEX IF EXISTS "participants_imported_imported_registration_status_idx";
  DROP INDEX IF EXISTS "users_family_account_idx";
  DROP INDEX IF EXISTS "users_imported_imported_batch_idx";
  DROP INDEX IF EXISTS "users_launch_launch_email_at_idx";
  DROP INDEX IF EXISTS "users_launch_launch_sms_sid_idx";
  DROP INDEX IF EXISTS "users_launch_launch_short_code_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_import_batches_id_idx";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "imported_batch_id";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "imported_registration_status";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "imported_registration_source";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "imported_mobile";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "imported_email";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "imported_owing_email_at";
  ALTER TABLE "participants" DROP COLUMN IF EXISTS "imported_notes";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "family_account_id";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "imported_batch_id";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "imported_relationship";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "imported_prior_client";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "imported_suburb";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "imported_postcode";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "imported_gets_messages";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_email_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_email_status";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_sms_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_sms_status";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_sms_sid";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_sms_tries";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_reminder_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_follow_up_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_follow_up_status";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_unsubscribed_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_email_subject";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_follow_up_subject";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_short_code";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "launch_short_code_expires";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "import_batches_id";
  DROP TYPE IF EXISTS "public"."enum_import_batches_status";
  DROP TYPE IF EXISTS "public"."enum_participants_imported_registration_status";
  DROP TYPE IF EXISTS "public"."enum_users_launch_email_status";
  DROP TYPE IF EXISTS "public"."enum_users_launch_sms_status";
  DROP TYPE IF EXISTS "public"."enum_users_launch_follow_up_status";
  DROP TYPE IF EXISTS "public"."enum_portal_launch_run_status";`)
}
