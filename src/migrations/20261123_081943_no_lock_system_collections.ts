import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_audit_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_fplus_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_form_throttle_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_academy_reminder_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_selection_audit_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_import_batches_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reflection_reminders_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_consent_records_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_message_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_report_reminder_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_promotion_uses_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_seen_markers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_invite_tokens_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_push_subscriptions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_number_audit_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_activity_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_staff_feed_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_finance_audit_log_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_audit_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_fplus_events_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_form_throttle_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_academy_reminder_log_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_selection_audit_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_import_batches_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_reflection_reminders_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_consent_records_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_message_log_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_report_reminder_log_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_promotion_uses_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_seen_markers_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_invite_tokens_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_push_subscriptions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_number_audit_log_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_activity_log_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_staff_feed_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_finance_audit_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "pdr_audit_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "fplus_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "form_throttle_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "academy_reminder_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "selection_audit_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "import_batches_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "reflection_reminders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "consent_records_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "message_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "report_reminder_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "promotion_uses_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "seen_markers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "invite_tokens_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "push_subscriptions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "number_audit_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "activity_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "staff_feed_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "finance_audit_log_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_audit_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fplus_events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "form_throttle_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_reminder_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "selection_audit_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "import_batches_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reflection_reminders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consent_records_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "message_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "report_reminder_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "promotion_uses_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "seen_markers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invite_tokens_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_subscriptions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "number_audit_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activity_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "staff_feed_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "finance_audit_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_audit_fk" FOREIGN KEY ("pdr_audit_id") REFERENCES "public"."pdr_audit"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fplus_events_fk" FOREIGN KEY ("fplus_events_id") REFERENCES "public"."fplus_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_form_throttle_fk" FOREIGN KEY ("form_throttle_id") REFERENCES "public"."form_throttle"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_reminder_log_fk" FOREIGN KEY ("academy_reminder_log_id") REFERENCES "public"."academy_reminder_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_selection_audit_fk" FOREIGN KEY ("selection_audit_id") REFERENCES "public"."selection_audit"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_batches_fk" FOREIGN KEY ("import_batches_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reflection_reminders_fk" FOREIGN KEY ("reflection_reminders_id") REFERENCES "public"."reflection_reminders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consent_records_fk" FOREIGN KEY ("consent_records_id") REFERENCES "public"."consent_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_message_log_fk" FOREIGN KEY ("message_log_id") REFERENCES "public"."message_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_report_reminder_log_fk" FOREIGN KEY ("report_reminder_log_id") REFERENCES "public"."report_reminder_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promotion_uses_fk" FOREIGN KEY ("promotion_uses_id") REFERENCES "public"."promotion_uses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seen_markers_fk" FOREIGN KEY ("seen_markers_id") REFERENCES "public"."seen_markers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invite_tokens_fk" FOREIGN KEY ("invite_tokens_id") REFERENCES "public"."invite_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_number_audit_log_fk" FOREIGN KEY ("number_audit_log_id") REFERENCES "public"."number_audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_log_fk" FOREIGN KEY ("activity_log_id") REFERENCES "public"."activity_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_staff_feed_fk" FOREIGN KEY ("staff_feed_id") REFERENCES "public"."staff_feed"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_audit_log_fk" FOREIGN KEY ("finance_audit_log_id") REFERENCES "public"."finance_audit_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_pdr_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_audit_id");
  CREATE INDEX "payload_locked_documents_rels_fplus_events_id_idx" ON "payload_locked_documents_rels" USING btree ("fplus_events_id");
  CREATE INDEX "payload_locked_documents_rels_form_throttle_id_idx" ON "payload_locked_documents_rels" USING btree ("form_throttle_id");
  CREATE INDEX "payload_locked_documents_rels_academy_reminder_log_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_reminder_log_id");
  CREATE INDEX "payload_locked_documents_rels_selection_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("selection_audit_id");
  CREATE INDEX "payload_locked_documents_rels_import_batches_id_idx" ON "payload_locked_documents_rels" USING btree ("import_batches_id");
  CREATE INDEX "payload_locked_documents_rels_reflection_reminders_id_idx" ON "payload_locked_documents_rels" USING btree ("reflection_reminders_id");
  CREATE INDEX "payload_locked_documents_rels_consent_records_id_idx" ON "payload_locked_documents_rels" USING btree ("consent_records_id");
  CREATE INDEX "payload_locked_documents_rels_message_log_id_idx" ON "payload_locked_documents_rels" USING btree ("message_log_id");
  CREATE INDEX "payload_locked_documents_rels_report_reminder_log_id_idx" ON "payload_locked_documents_rels" USING btree ("report_reminder_log_id");
  CREATE INDEX "payload_locked_documents_rels_promotion_uses_id_idx" ON "payload_locked_documents_rels" USING btree ("promotion_uses_id");
  CREATE INDEX "payload_locked_documents_rels_seen_markers_id_idx" ON "payload_locked_documents_rels" USING btree ("seen_markers_id");
  CREATE INDEX "payload_locked_documents_rels_invite_tokens_id_idx" ON "payload_locked_documents_rels" USING btree ("invite_tokens_id");
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_number_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("number_audit_log_id");
  CREATE INDEX "payload_locked_documents_rels_activity_log_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_log_id");
  CREATE INDEX "payload_locked_documents_rels_staff_feed_id_idx" ON "payload_locked_documents_rels" USING btree ("staff_feed_id");
  CREATE INDEX "payload_locked_documents_rels_finance_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_audit_log_id");`)
}
