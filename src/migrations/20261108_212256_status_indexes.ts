import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE INDEX "academy_bookings_status_idx" ON "academy_bookings" USING btree ("status");
  CREATE INDEX "academy_bookings_hold_expires_at_idx" ON "academy_bookings" USING btree ("hold_expires_at");
  CREATE INDEX "academy_sessions_status_idx" ON "academy_sessions" USING btree ("status");
  CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status");
  CREATE INDEX "programs_type_idx" ON "programs" USING btree ("type");
  CREATE INDEX "programs_status_idx" ON "programs" USING btree ("status");
  CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");
  CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
  CREATE INDEX "participants_pdr_pdr_subscription_status_idx" ON "participants" USING btree ("pdr_subscription_status");
  CREATE INDEX "users_consent_review_status_idx" ON "users" USING btree ("consent_review_status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "academy_bookings_status_idx";
  DROP INDEX IF EXISTS "academy_bookings_hold_expires_at_idx";
  DROP INDEX IF EXISTS "academy_sessions_status_idx";
  DROP INDEX IF EXISTS "posts_status_idx";
  DROP INDEX IF EXISTS "programs_type_idx";
  DROP INDEX IF EXISTS "programs_status_idx";
  DROP INDEX IF EXISTS "bookings_status_idx";
  DROP INDEX IF EXISTS "orders_status_idx";
  DROP INDEX IF EXISTS "participants_pdr_pdr_subscription_status_idx";
  DROP INDEX IF EXISTS "users_consent_review_status_idx";`)
}
