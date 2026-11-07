import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pdr_progress_method" AS ENUM('verified', 'promoted');
  CREATE TABLE "pdr_progress" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"player_id" integer NOT NULL,
  	"stage_id" integer NOT NULL,
  	"area_id" integer,
  	"level_number" numeric,
  	"method" "enum_pdr_progress_method" DEFAULT 'verified' NOT NULL,
  	"score" numeric,
  	"passed_at" timestamp(3) with time zone,
  	"by_id" integer,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_progress_id" integer;
  ALTER TABLE "pdr_settings" ADD COLUMN "enabled" boolean DEFAULT false;
  ALTER TABLE "pdr_settings" ADD COLUMN "program_name" varchar DEFAULT 'Foundation+' NOT NULL;
  ALTER TABLE "pdr_settings" ADD COLUMN "tagline" varchar DEFAULT 'Level up your game — skills, challenges, badges and coach feedback.';
  ALTER TABLE "pdr_progress" ADD CONSTRAINT "pdr_progress_player_id_participants_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_progress" ADD CONSTRAINT "pdr_progress_stage_id_pdr_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pdr_stages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_progress" ADD CONSTRAINT "pdr_progress_area_id_pdr_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."pdr_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_progress" ADD CONSTRAINT "pdr_progress_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pdr_progress_player_idx" ON "pdr_progress" USING btree ("player_id");
  CREATE INDEX "pdr_progress_stage_idx" ON "pdr_progress" USING btree ("stage_id");
  CREATE INDEX "pdr_progress_area_idx" ON "pdr_progress" USING btree ("area_id");
  CREATE INDEX "pdr_progress_by_idx" ON "pdr_progress" USING btree ("by_id");
  CREATE INDEX "pdr_progress_updated_at_idx" ON "pdr_progress" USING btree ("updated_at");
  CREATE INDEX "pdr_progress_created_at_idx" ON "pdr_progress" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_progress_fk" FOREIGN KEY ("pdr_progress_id") REFERENCES "public"."pdr_progress"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_pdr_progress_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_progress_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pdr_progress" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pdr_progress" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_progress_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_progress_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_progress_id";
  ALTER TABLE "pdr_settings" DROP COLUMN "enabled";
  ALTER TABLE "pdr_settings" DROP COLUMN "program_name";
  ALTER TABLE "pdr_settings" DROP COLUMN "tagline";
  DROP TYPE "public"."enum_pdr_progress_method";`)
}
