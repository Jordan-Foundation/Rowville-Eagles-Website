import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "player_reports" ADD COLUMN "family_notified_at" timestamp(3) with time zone;
  ALTER TABLE "promotions" ADD COLUMN "send_state" jsonb;
  ALTER TABLE "promotions" ADD COLUMN "send_completed_at" timestamp(3) with time zone;
  -- Already-released reports were already announced to families; already-sent promotions are finished
  UPDATE "player_reports" SET "family_notified_at" = "released_at" WHERE "status" = 'released';
  UPDATE "promotions" SET "send_completed_at" = "sent_at" WHERE "sent_at" IS NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "player_reports" DROP COLUMN "family_notified_at";
  ALTER TABLE "promotions" DROP COLUMN "send_state";
  ALTER TABLE "promotions" DROP COLUMN "send_completed_at";`)
}
