import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_camp_coaches_status" AS ENUM('invited', 'confirmed', 'declined', 'removed');
  CREATE TABLE "camp_coaches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"program_id" integer NOT NULL,
  	"coach_id" integer NOT NULL,
  	"status" "enum_camp_coaches_status" DEFAULT 'invited' NOT NULL,
  	"token_hash" varchar,
  	"alt_token_hash" varchar,
  	"invited_at" timestamp(3) with time zone NOT NULL,
  	"reminded_at" timestamp(3) with time zone,
  	"escalated_at" timestamp(3) with time zone,
  	"responded_at" timestamp(3) with time zone,
  	"decline_reason" varchar,
  	"decline_seen" boolean DEFAULT false,
  	"invited_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coach_blocks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coach_id" integer NOT NULL,
  	"from" timestamp(3) with time zone NOT NULL,
  	"to" timestamp(3) with time zone NOT NULL,
  	"reason" varchar NOT NULL,
  	"program_id" integer,
  	"camp_coach_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "programs" ADD COLUMN "extra_coaches" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "camp_coaches_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "coach_blocks_id" integer;
  ALTER TABLE "academy_settings" ADD COLUMN "camps_coaches_per_group" numeric DEFAULT 1;
  ALTER TABLE "academy_settings" ADD COLUMN "camps_extra_coaches" numeric DEFAULT 1;
  ALTER TABLE "academy_settings" ADD COLUMN "camps_confirm_reminder_hours" numeric DEFAULT 24;
  ALTER TABLE "academy_settings" ADD COLUMN "camps_escalate_hours" numeric DEFAULT 48;
  ALTER TABLE "camp_coaches" ADD CONSTRAINT "camp_coaches_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "camp_coaches" ADD CONSTRAINT "camp_coaches_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "camp_coaches" ADD CONSTRAINT "camp_coaches_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coach_blocks" ADD CONSTRAINT "coach_blocks_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coach_blocks" ADD CONSTRAINT "coach_blocks_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coach_blocks" ADD CONSTRAINT "coach_blocks_camp_coach_id_camp_coaches_id_fk" FOREIGN KEY ("camp_coach_id") REFERENCES "public"."camp_coaches"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "camp_coaches_program_idx" ON "camp_coaches" USING btree ("program_id");
  CREATE INDEX "camp_coaches_coach_idx" ON "camp_coaches" USING btree ("coach_id");
  CREATE INDEX "camp_coaches_status_idx" ON "camp_coaches" USING btree ("status");
  CREATE INDEX "camp_coaches_token_hash_idx" ON "camp_coaches" USING btree ("token_hash");
  CREATE INDEX "camp_coaches_alt_token_hash_idx" ON "camp_coaches" USING btree ("alt_token_hash");
  CREATE INDEX "camp_coaches_invited_by_idx" ON "camp_coaches" USING btree ("invited_by_id");
  CREATE INDEX "camp_coaches_updated_at_idx" ON "camp_coaches" USING btree ("updated_at");
  CREATE INDEX "camp_coaches_created_at_idx" ON "camp_coaches" USING btree ("created_at");
  CREATE INDEX "coach_blocks_coach_idx" ON "coach_blocks" USING btree ("coach_id");
  CREATE INDEX "coach_blocks_from_idx" ON "coach_blocks" USING btree ("from");
  CREATE INDEX "coach_blocks_to_idx" ON "coach_blocks" USING btree ("to");
  CREATE INDEX "coach_blocks_program_idx" ON "coach_blocks" USING btree ("program_id");
  CREATE INDEX "coach_blocks_camp_coach_idx" ON "coach_blocks" USING btree ("camp_coach_id");
  CREATE INDEX "coach_blocks_updated_at_idx" ON "coach_blocks" USING btree ("updated_at");
  CREATE INDEX "coach_blocks_created_at_idx" ON "coach_blocks" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_camp_coaches_fk" FOREIGN KEY ("camp_coaches_id") REFERENCES "public"."camp_coaches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coach_blocks_fk" FOREIGN KEY ("coach_blocks_id") REFERENCES "public"."coach_blocks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_camp_coaches_id_idx" ON "payload_locked_documents_rels" USING btree ("camp_coaches_id");
  CREATE INDEX "payload_locked_documents_rels_coach_blocks_id_idx" ON "payload_locked_documents_rels" USING btree ("coach_blocks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE IF EXISTS "camp_coaches" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "coach_blocks" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "camp_coaches" CASCADE;
  DROP TABLE IF EXISTS "coach_blocks" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_camp_coaches_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_coach_blocks_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_camp_coaches_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_coach_blocks_id_idx";
  ALTER TABLE "programs" DROP COLUMN IF EXISTS "extra_coaches";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "camp_coaches_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "coach_blocks_id";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "camps_coaches_per_group";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "camps_extra_coaches";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "camps_confirm_reminder_hours";
  ALTER TABLE "academy_settings" DROP COLUMN IF EXISTS "camps_escalate_hours";
  DROP TYPE IF EXISTS "public"."enum_camp_coaches_status";`)
}
