import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "academy_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"google_review_url" varchar,
  	"review_after_sessions" numeric DEFAULT 12,
  	"review_requests_on" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "academy_credits" ALTER COLUMN "amount" DROP NOT NULL;
  ALTER TABLE "academy_bookings_adjustments" ADD COLUMN "credit_sessions" numeric;
  ALTER TABLE "academy_bookings" ADD COLUMN "term_member_price" boolean;
  ALTER TABLE "academy_bookings" ADD COLUMN "credit_sessions_used" numeric DEFAULT 0;
  ALTER TABLE "academy_bookings" ADD COLUMN "credited_sessions" numeric DEFAULT 0;
  ALTER TABLE "academy_terms" ADD COLUMN "term_member_price" numeric DEFAULT 70 NOT NULL;
  ALTER TABLE "academy_terms" ADD COLUMN "term_member_window_days" numeric DEFAULT 14 NOT NULL;
  ALTER TABLE "academy_credits" ADD COLUMN "sessions" numeric;
  ALTER TABLE "academy_credits" ADD COLUMN "expires_at" timestamp(3) with time zone;

  -- Convert any existing dollar credit to whole 1-on-1 sessions (rounded up, at the booking's
  -- per-session price; $80 if unknown). Credits given now expire 12 months after they were given.
  UPDATE "academy_credits" c SET
    "sessions" = SIGN(c."amount") * CEIL(ABS(c."amount") / COALESCE(NULLIF(b."amount" / NULLIF(b."sessions_total", 0), 0), 80)),
    "expires_at" = CASE WHEN c."amount" > 0 THEN c."created_at" + INTERVAL '12 months' ELSE NULL END
  FROM (SELECT c2."id", b2."amount", b2."sessions_total" FROM "academy_credits" c2 LEFT JOIN "academy_bookings" b2 ON b2."id" = c2."booking_id") b
  WHERE b."id" = c."id";
  UPDATE "academy_credits" SET "sessions" = 0 WHERE "sessions" IS NULL;
  ALTER TABLE "academy_credits" ALTER COLUMN "sessions" SET NOT NULL;
  UPDATE "academy_bookings" SET
    "credit_sessions_used" = CASE WHEN COALESCE("credit_applied", 0) > 0 THEN CEIL("credit_applied" / NULLIF("amount" / NULLIF("sessions_total", 0), 0)) ELSE 0 END,
    "credited_sessions" = CASE WHEN COALESCE("credited_amount", 0) > 0 THEN CEIL("credited_amount" / NULLIF("amount" / NULLIF("sessions_total", 0), 0)) ELSE 0 END;
  ALTER TABLE "users" ADD COLUMN "review_request_sent_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "academy_settings" CASCADE;
  ALTER TABLE "academy_credits" ALTER COLUMN "amount" SET NOT NULL;
  ALTER TABLE "academy_bookings_adjustments" DROP COLUMN "credit_sessions";
  ALTER TABLE "academy_bookings" DROP COLUMN "term_member_price";
  ALTER TABLE "academy_bookings" DROP COLUMN "credit_sessions_used";
  ALTER TABLE "academy_bookings" DROP COLUMN "credited_sessions";
  ALTER TABLE "academy_terms" DROP COLUMN "term_member_price";
  ALTER TABLE "academy_terms" DROP COLUMN "term_member_window_days";
  ALTER TABLE "academy_credits" DROP COLUMN "sessions";
  ALTER TABLE "academy_credits" DROP COLUMN "expires_at";
  ALTER TABLE "users" DROP COLUMN "review_request_sent_at";`)
}
