import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_settings_back_to_back_applies_to" AS ENUM('casual', 'term', 'pack');
  CREATE TABLE "academy_settings_closed_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "academy_settings_back_to_back_applies_to" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_academy_settings_back_to_back_applies_to",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "academy_coaches" ADD COLUMN "back_to_back" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "app_installed_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "app_push_enabled_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "app_card_snoozed_until" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "app_welcome_sent_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "app_reminder_sent_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "notify_reminders" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "notify_changes" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "notify_teams" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "notify_openings" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "notify_messages" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "notify_progress" boolean DEFAULT true;
  ALTER TABLE "academy_settings" ADD COLUMN "booking_hours_term_weekday_from" varchar DEFAULT '16:00';
  ALTER TABLE "academy_settings" ADD COLUMN "booking_hours_term_weekday_to" varchar DEFAULT '21:00';
  ALTER TABLE "academy_settings" ADD COLUMN "booking_hours_term_weekend_from" varchar DEFAULT '07:00';
  ALTER TABLE "academy_settings" ADD COLUMN "booking_hours_term_weekend_to" varchar DEFAULT '21:00';
  ALTER TABLE "academy_settings" ADD COLUMN "booking_hours_holiday_from" varchar DEFAULT '07:00';
  ALTER TABLE "academy_settings" ADD COLUMN "booking_hours_holiday_to" varchar DEFAULT '21:00';
  ALTER TABLE "academy_settings" ADD COLUMN "back_to_back_enabled" boolean DEFAULT true;
  ALTER TABLE "academy_settings" ADD COLUMN "back_to_back_release_hours" numeric DEFAULT 0;
  ALTER TABLE "academy_settings_closed_dates" ADD CONSTRAINT "academy_settings_closed_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "academy_settings_back_to_back_applies_to" ADD CONSTRAINT "academy_settings_back_to_back_applies_to_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."academy_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "academy_settings_closed_dates_order_idx" ON "academy_settings_closed_dates" USING btree ("_order");
  CREATE INDEX "academy_settings_closed_dates_parent_id_idx" ON "academy_settings_closed_dates" USING btree ("_parent_id");
  CREATE INDEX "academy_settings_back_to_back_applies_to_order_idx" ON "academy_settings_back_to_back_applies_to" USING btree ("order");
  CREATE INDEX "academy_settings_back_to_back_applies_to_parent_idx" ON "academy_settings_back_to_back_applies_to" USING btree ("parent_id");
  -- Back-to-back applies to every 1-on-1 booking type by default
  INSERT INTO "academy_settings_back_to_back_applies_to" ("order", "parent_id", "value")
    SELECT v.ord, s.id, v.val::"enum_academy_settings_back_to_back_applies_to" FROM "academy_settings" s
    CROSS JOIN (VALUES (1, 'casual'), (2, 'term'), (3, 'pack')) AS v(ord, val);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "academy_settings_closed_dates" CASCADE;
  DROP TABLE IF EXISTS "academy_settings_back_to_back_applies_to" CASCADE;
  ALTER TABLE "academy_coaches" DROP COLUMN IF EXISTS "back_to_back";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "app_installed_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "app_push_enabled_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "app_card_snoozed_until";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "app_welcome_sent_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "app_reminder_sent_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "notify_reminders";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "notify_changes";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "notify_teams";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "notify_openings";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "notify_messages";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "notify_progress";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "booking_hours_term_weekday_from";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "booking_hours_term_weekday_to";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "booking_hours_term_weekend_from";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "booking_hours_term_weekend_to";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "booking_hours_holiday_from";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "booking_hours_holiday_to";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "back_to_back_enabled";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "back_to_back_release_hours";
  DROP TYPE IF EXISTS "public"."enum_academy_settings_back_to_back_applies_to";`)
}
