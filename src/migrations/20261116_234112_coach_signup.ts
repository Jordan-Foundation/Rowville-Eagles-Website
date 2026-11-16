import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_invite_tokens_purpose" ADD VALUE 'coach-invite';
  CREATE TABLE "wwcc_files" (
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
  
  ALTER TABLE "users" ADD COLUMN "wwcc_photo_id" integer;
  ALTER TABLE "users" ADD COLUMN "wwcc_submitted_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "wwcc_checked_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "wwcc_checked_by_id" integer;
  ALTER TABLE "users" ADD COLUMN "coach_invited_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "wwcc_files_id" integer;
  CREATE INDEX "wwcc_files_updated_at_idx" ON "wwcc_files" USING btree ("updated_at");
  CREATE INDEX "wwcc_files_created_at_idx" ON "wwcc_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "wwcc_files_filename_idx" ON "wwcc_files" USING btree ("filename");
  ALTER TABLE "users" ADD CONSTRAINT "users_wwcc_photo_id_wwcc_files_id_fk" FOREIGN KEY ("wwcc_photo_id") REFERENCES "public"."wwcc_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_wwcc_checked_by_id_users_id_fk" FOREIGN KEY ("wwcc_checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wwcc_files_fk" FOREIGN KEY ("wwcc_files_id") REFERENCES "public"."wwcc_files"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_wwcc_wwcc_photo_idx" ON "users" USING btree ("wwcc_photo_id");
  CREATE INDEX "users_wwcc_wwcc_checked_by_idx" ON "users" USING btree ("wwcc_checked_by_id");
  CREATE INDEX "payload_locked_documents_rels_wwcc_files_id_idx" ON "payload_locked_documents_rels" USING btree ("wwcc_files_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "wwcc_files" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "wwcc_files" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_wwcc_photo_id_wwcc_files_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_wwcc_checked_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_wwcc_files_fk";
  
  DELETE FROM "invite_tokens" WHERE "purpose" = 'coach-invite';
  ALTER TABLE "invite_tokens" ALTER COLUMN "purpose" SET DATA TYPE text;
  DROP TYPE "public"."enum_invite_tokens_purpose";
  CREATE TYPE "public"."enum_invite_tokens_purpose" AS ENUM('create-account', 'confirm-consent', 'fplus-trial', 'fplus-join');
  ALTER TABLE "invite_tokens" ALTER COLUMN "purpose" SET DATA TYPE "public"."enum_invite_tokens_purpose" USING "purpose"::"public"."enum_invite_tokens_purpose";
  DROP INDEX IF EXISTS "users_wwcc_wwcc_photo_idx";
  DROP INDEX IF EXISTS "users_wwcc_wwcc_checked_by_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_wwcc_files_id_idx";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "wwcc_photo_id";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "wwcc_submitted_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "wwcc_checked_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "wwcc_checked_by_id";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "coach_invited_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "wwcc_files_id";`)
}
