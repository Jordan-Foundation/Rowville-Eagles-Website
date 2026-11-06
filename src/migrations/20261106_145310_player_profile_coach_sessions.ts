import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_sessions" ADD COLUMN "attendance_by_id" integer;
  ALTER TABLE "academy_sessions" ADD COLUMN "attendance_at" timestamp(3) with time zone;
  ALTER TABLE "academy_sessions" ADD COLUMN "coach_notes" varchar;
  ALTER TABLE "participants" ADD COLUMN "football_current_club" varchar;
  ALTER TABLE "participants" ADD COLUMN "football_position" varchar;
  ALTER TABLE "participants" ADD COLUMN "football_goals" varchar;
  ALTER TABLE "academy_sessions" ADD CONSTRAINT "academy_sessions_attendance_by_id_users_id_fk" FOREIGN KEY ("attendance_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "academy_sessions_attendance_by_idx" ON "academy_sessions" USING btree ("attendance_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_sessions" DROP CONSTRAINT "academy_sessions_attendance_by_id_users_id_fk";
  
  DROP INDEX "academy_sessions_attendance_by_idx";
  ALTER TABLE "academy_sessions" DROP COLUMN "attendance_by_id";
  ALTER TABLE "academy_sessions" DROP COLUMN "attendance_at";
  ALTER TABLE "academy_sessions" DROP COLUMN "coach_notes";
  ALTER TABLE "participants" DROP COLUMN "football_current_club";
  ALTER TABLE "participants" DROP COLUMN "football_position";
  ALTER TABLE "participants" DROP COLUMN "football_goals";`)
}
