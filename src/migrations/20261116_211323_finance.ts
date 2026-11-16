import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_coach_hour_adjustments_kind" AS ENUM('manual', 'paid-cancellation');
  CREATE TYPE "public"."enum_expenses_payment_method" AS ENUM('card', 'bank transfer', 'direct debit', 'cash', 'other');
  CREATE TYPE "public"."enum_expenses_source" AS ENUM('email', 'photo', 'bank', 'manual');
  CREATE TYPE "public"."enum_expenses_status" AS ENUM('needs_review', 'approved');
  CREATE TYPE "public"."enum_bank_transactions_source" AS ENUM('csv', 'ofx', 'xero', 'open-banking');
  CREATE TYPE "public"."enum_bank_transactions_direction" AS ENUM('debit', 'credit');
  CREATE TYPE "public"."enum_bank_transactions_status" AS ENUM('unmatched', 'matched', 'ignored', 'income_transfer');
  CREATE TYPE "public"."enum_finance_settings_setup_kinds" AS ENUM('one-on-one', 'small-group', 'academy', 'mini-ballers', 'camp', 'eagles-training', 'eagles-game');
  CREATE TYPE "public"."enum_finance_settings_report_day" AS ENUM('1', '2', '0');
  CREATE TABLE "coach_pay_rates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coach_id" integer NOT NULL,
  	"hourly_rate" numeric NOT NULL,
  	"effective_from" varchar NOT NULL,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coach_pay_profiles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coach_id" integer NOT NULL,
  	"super_on" boolean DEFAULT true,
  	"eagles_paid" boolean DEFAULT false,
  	"payroll_active" boolean DEFAULT true,
  	"super_fund" varchar,
  	"xero_employee" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coach_hour_adjustments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coach_id" integer NOT NULL,
  	"date" varchar NOT NULL,
  	"kind" "enum_coach_hour_adjustments_kind" DEFAULT 'manual' NOT NULL,
  	"start_time" varchar,
  	"minutes" numeric NOT NULL,
  	"session_key" varchar,
  	"reason" varchar NOT NULL,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pay_weeks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"week_start" varchar NOT NULL,
  	"week_end" varchar NOT NULL,
  	"generated_at" timestamp(3) with time zone,
  	"coaches" jsonb,
  	"bonus_keys" jsonb,
  	"reversed_keys" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "finance_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"period_start" varchar NOT NULL,
  	"period_end" varchar NOT NULL,
  	"sent_at" timestamp(3) with time zone,
  	"data" jsonb,
  	"sent_to" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "expense_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "receipt_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "expenses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" varchar NOT NULL,
  	"supplier" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"gst" numeric,
  	"description" varchar,
  	"category_id" integer,
  	"payment_method" "enum_expenses_payment_method",
  	"source" "enum_expenses_source" DEFAULT 'manual' NOT NULL,
  	"status" "enum_expenses_status" DEFAULT 'needs_review' NOT NULL,
  	"recurring" boolean DEFAULT false,
  	"receipt_id" integer,
  	"bank_transaction_id" integer,
  	"source_ref" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bank_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum_bank_transactions_source" DEFAULT 'csv' NOT NULL,
  	"account" varchar,
  	"date" varchar NOT NULL,
  	"description" varchar,
  	"amount" numeric NOT NULL,
  	"direction" "enum_bank_transactions_direction" NOT NULL,
  	"status" "enum_bank_transactions_status" DEFAULT 'unmatched' NOT NULL,
  	"external_id" varchar NOT NULL,
  	"matched_expense_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "projection_scenarios" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"inputs" jsonb,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "finance_audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"area" varchar,
  	"action" varchar,
  	"collection" varchar,
  	"doc_id" numeric,
  	"by_id" integer,
  	"reason" varchar,
  	"before" jsonb,
  	"after" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "finance_settings_setup_kinds" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_finance_settings_setup_kinds",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "finance_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"super_rate" numeric DEFAULT 12,
  	"super_on_bonus" boolean DEFAULT true,
  	"bonus_pct" numeric DEFAULT 10,
  	"setup_minutes" numeric DEFAULT 15,
  	"packup_minutes" numeric DEFAULT 15,
  	"block_gap_minutes" numeric DEFAULT 0,
  	"eagles_season_start" varchar,
  	"eagles_season_end" varchar,
  	"eagles_game_minutes" numeric DEFAULT 90,
  	"report_recipients" varchar,
  	"report_day" "enum_finance_settings_report_day" DEFAULT '1',
  	"report_hour" numeric DEFAULT 9,
  	"gmail_email" varchar,
  	"gmail_connected_at" timestamp(3) with time zone,
  	"gmail_last_checked_at" timestamp(3) with time zone,
  	"gmail_refresh_token" varchar,
  	"gmail_checked_ids" jsonb,
  	"gmail_last_error" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "coach_pay_rates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "coach_pay_profiles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "coach_hour_adjustments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pay_weeks_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "finance_reports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "expense_categories_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "receipt_files_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "expenses_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bank_transactions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "projection_scenarios_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "finance_audit_log_id" integer;
  ALTER TABLE "coach_pay_rates" ADD CONSTRAINT "coach_pay_rates_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coach_pay_profiles" ADD CONSTRAINT "coach_pay_profiles_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coach_hour_adjustments" ADD CONSTRAINT "coach_hour_adjustments_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coach_hour_adjustments" ADD CONSTRAINT "coach_hour_adjustments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_id_receipt_files_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipt_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_expense_id_expenses_id_fk" FOREIGN KEY ("matched_expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projection_scenarios" ADD CONSTRAINT "projection_scenarios_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "finance_audit_log" ADD CONSTRAINT "finance_audit_log_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "finance_settings_setup_kinds" ADD CONSTRAINT "finance_settings_setup_kinds_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."finance_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "coach_pay_rates_coach_idx" ON "coach_pay_rates" USING btree ("coach_id");
  CREATE INDEX "coach_pay_rates_effective_from_idx" ON "coach_pay_rates" USING btree ("effective_from");
  CREATE INDEX "coach_pay_rates_updated_at_idx" ON "coach_pay_rates" USING btree ("updated_at");
  CREATE INDEX "coach_pay_rates_created_at_idx" ON "coach_pay_rates" USING btree ("created_at");
  CREATE UNIQUE INDEX "coach_effectiveFrom_idx" ON "coach_pay_rates" USING btree ("coach_id","effective_from");
  CREATE UNIQUE INDEX "coach_pay_profiles_coach_idx" ON "coach_pay_profiles" USING btree ("coach_id");
  CREATE INDEX "coach_pay_profiles_updated_at_idx" ON "coach_pay_profiles" USING btree ("updated_at");
  CREATE INDEX "coach_pay_profiles_created_at_idx" ON "coach_pay_profiles" USING btree ("created_at");
  CREATE INDEX "coach_hour_adjustments_coach_idx" ON "coach_hour_adjustments" USING btree ("coach_id");
  CREATE INDEX "coach_hour_adjustments_date_idx" ON "coach_hour_adjustments" USING btree ("date");
  CREATE INDEX "coach_hour_adjustments_session_key_idx" ON "coach_hour_adjustments" USING btree ("session_key");
  CREATE INDEX "coach_hour_adjustments_created_by_idx" ON "coach_hour_adjustments" USING btree ("created_by_id");
  CREATE INDEX "coach_hour_adjustments_updated_at_idx" ON "coach_hour_adjustments" USING btree ("updated_at");
  CREATE INDEX "coach_hour_adjustments_created_at_idx" ON "coach_hour_adjustments" USING btree ("created_at");
  CREATE UNIQUE INDEX "pay_weeks_week_start_idx" ON "pay_weeks" USING btree ("week_start");
  CREATE INDEX "pay_weeks_updated_at_idx" ON "pay_weeks" USING btree ("updated_at");
  CREATE INDEX "pay_weeks_created_at_idx" ON "pay_weeks" USING btree ("created_at");
  CREATE UNIQUE INDEX "finance_reports_period_start_idx" ON "finance_reports" USING btree ("period_start");
  CREATE INDEX "finance_reports_updated_at_idx" ON "finance_reports" USING btree ("updated_at");
  CREATE INDEX "finance_reports_created_at_idx" ON "finance_reports" USING btree ("created_at");
  CREATE UNIQUE INDEX "expense_categories_name_idx" ON "expense_categories" USING btree ("name");
  CREATE INDEX "expense_categories_updated_at_idx" ON "expense_categories" USING btree ("updated_at");
  CREATE INDEX "expense_categories_created_at_idx" ON "expense_categories" USING btree ("created_at");
  CREATE INDEX "receipt_files_updated_at_idx" ON "receipt_files" USING btree ("updated_at");
  CREATE INDEX "receipt_files_created_at_idx" ON "receipt_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "receipt_files_filename_idx" ON "receipt_files" USING btree ("filename");
  CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");
  CREATE INDEX "expenses_supplier_idx" ON "expenses" USING btree ("supplier");
  CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");
  CREATE INDEX "expenses_status_idx" ON "expenses" USING btree ("status");
  CREATE INDEX "expenses_receipt_idx" ON "expenses" USING btree ("receipt_id");
  CREATE INDEX "expenses_bank_transaction_idx" ON "expenses" USING btree ("bank_transaction_id");
  CREATE UNIQUE INDEX "expenses_source_ref_idx" ON "expenses" USING btree ("source_ref");
  CREATE INDEX "expenses_updated_at_idx" ON "expenses" USING btree ("updated_at");
  CREATE INDEX "expenses_created_at_idx" ON "expenses" USING btree ("created_at");
  CREATE INDEX "bank_transactions_date_idx" ON "bank_transactions" USING btree ("date");
  CREATE INDEX "bank_transactions_status_idx" ON "bank_transactions" USING btree ("status");
  CREATE UNIQUE INDEX "bank_transactions_external_id_idx" ON "bank_transactions" USING btree ("external_id");
  CREATE INDEX "bank_transactions_matched_expense_idx" ON "bank_transactions" USING btree ("matched_expense_id");
  CREATE INDEX "bank_transactions_updated_at_idx" ON "bank_transactions" USING btree ("updated_at");
  CREATE INDEX "bank_transactions_created_at_idx" ON "bank_transactions" USING btree ("created_at");
  CREATE INDEX "projection_scenarios_created_by_idx" ON "projection_scenarios" USING btree ("created_by_id");
  CREATE INDEX "projection_scenarios_updated_at_idx" ON "projection_scenarios" USING btree ("updated_at");
  CREATE INDEX "projection_scenarios_created_at_idx" ON "projection_scenarios" USING btree ("created_at");
  CREATE INDEX "finance_audit_log_by_idx" ON "finance_audit_log" USING btree ("by_id");
  CREATE INDEX "finance_audit_log_updated_at_idx" ON "finance_audit_log" USING btree ("updated_at");
  CREATE INDEX "finance_audit_log_created_at_idx" ON "finance_audit_log" USING btree ("created_at");
  CREATE INDEX "finance_settings_setup_kinds_order_idx" ON "finance_settings_setup_kinds" USING btree ("order");
  CREATE INDEX "finance_settings_setup_kinds_parent_idx" ON "finance_settings_setup_kinds" USING btree ("parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coach_pay_rates_fk" FOREIGN KEY ("coach_pay_rates_id") REFERENCES "public"."coach_pay_rates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coach_pay_profiles_fk" FOREIGN KEY ("coach_pay_profiles_id") REFERENCES "public"."coach_pay_profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coach_hour_adjustments_fk" FOREIGN KEY ("coach_hour_adjustments_id") REFERENCES "public"."coach_hour_adjustments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pay_weeks_fk" FOREIGN KEY ("pay_weeks_id") REFERENCES "public"."pay_weeks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_reports_fk" FOREIGN KEY ("finance_reports_id") REFERENCES "public"."finance_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expense_categories_fk" FOREIGN KEY ("expense_categories_id") REFERENCES "public"."expense_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_receipt_files_fk" FOREIGN KEY ("receipt_files_id") REFERENCES "public"."receipt_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expenses_fk" FOREIGN KEY ("expenses_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bank_transactions_fk" FOREIGN KEY ("bank_transactions_id") REFERENCES "public"."bank_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_projection_scenarios_fk" FOREIGN KEY ("projection_scenarios_id") REFERENCES "public"."projection_scenarios"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_audit_log_fk" FOREIGN KEY ("finance_audit_log_id") REFERENCES "public"."finance_audit_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_coach_pay_rates_id_idx" ON "payload_locked_documents_rels" USING btree ("coach_pay_rates_id");
  CREATE INDEX "payload_locked_documents_rels_coach_pay_profiles_id_idx" ON "payload_locked_documents_rels" USING btree ("coach_pay_profiles_id");
  CREATE INDEX "payload_locked_documents_rels_coach_hour_adjustments_id_idx" ON "payload_locked_documents_rels" USING btree ("coach_hour_adjustments_id");
  CREATE INDEX "payload_locked_documents_rels_pay_weeks_id_idx" ON "payload_locked_documents_rels" USING btree ("pay_weeks_id");
  CREATE INDEX "payload_locked_documents_rels_finance_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_reports_id");
  CREATE INDEX "payload_locked_documents_rels_expense_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("expense_categories_id");
  CREATE INDEX "payload_locked_documents_rels_receipt_files_id_idx" ON "payload_locked_documents_rels" USING btree ("receipt_files_id");
  CREATE INDEX "payload_locked_documents_rels_expenses_id_idx" ON "payload_locked_documents_rels" USING btree ("expenses_id");
  CREATE INDEX "payload_locked_documents_rels_bank_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("bank_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_projection_scenarios_id_idx" ON "payload_locked_documents_rels" USING btree ("projection_scenarios_id");
  CREATE INDEX "payload_locked_documents_rels_finance_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_audit_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "coach_pay_rates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coach_pay_profiles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coach_hour_adjustments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pay_weeks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "finance_reports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "expense_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "receipt_files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "expenses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bank_transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projection_scenarios" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "finance_audit_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "finance_settings_setup_kinds" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "finance_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "coach_pay_rates" CASCADE;
  DROP TABLE IF EXISTS "coach_pay_profiles" CASCADE;
  DROP TABLE IF EXISTS "coach_hour_adjustments" CASCADE;
  DROP TABLE IF EXISTS "pay_weeks" CASCADE;
  DROP TABLE IF EXISTS "finance_reports" CASCADE;
  DROP TABLE IF EXISTS "expense_categories" CASCADE;
  DROP TABLE IF EXISTS "receipt_files" CASCADE;
  DROP TABLE IF EXISTS "expenses" CASCADE;
  DROP TABLE IF EXISTS "bank_transactions" CASCADE;
  DROP TABLE IF EXISTS "projection_scenarios" CASCADE;
  DROP TABLE IF EXISTS "finance_audit_log" CASCADE;
  DROP TABLE IF EXISTS "finance_settings_setup_kinds" CASCADE;
  DROP TABLE IF EXISTS "finance_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_coach_pay_rates_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_coach_pay_profiles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_coach_hour_adjustments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pay_weeks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_finance_reports_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_expense_categories_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_receipt_files_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_expenses_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_bank_transactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_projection_scenarios_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_finance_audit_log_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_coach_pay_rates_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_coach_pay_profiles_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_coach_hour_adjustments_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pay_weeks_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_finance_reports_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_expense_categories_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_receipt_files_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_expenses_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_bank_transactions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_projection_scenarios_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_finance_audit_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "coach_pay_rates_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "coach_pay_profiles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "coach_hour_adjustments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "pay_weeks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "finance_reports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "expense_categories_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "receipt_files_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "expenses_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "bank_transactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "projection_scenarios_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "finance_audit_log_id";
  DROP TYPE IF EXISTS "public"."enum_coach_hour_adjustments_kind";
  DROP TYPE IF EXISTS "public"."enum_expenses_payment_method";
  DROP TYPE IF EXISTS "public"."enum_expenses_source";
  DROP TYPE IF EXISTS "public"."enum_expenses_status";
  DROP TYPE IF EXISTS "public"."enum_bank_transactions_source";
  DROP TYPE IF EXISTS "public"."enum_bank_transactions_direction";
  DROP TYPE IF EXISTS "public"."enum_bank_transactions_status";
  DROP TYPE IF EXISTS "public"."enum_finance_settings_setup_kinds";
  DROP TYPE IF EXISTS "public"."enum_finance_settings_report_day";`)
}
