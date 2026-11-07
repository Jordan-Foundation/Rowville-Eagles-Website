import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pdr_challenges_direction" AS ENUM('higher', 'lower');
  CREATE TYPE "public"."enum_pdr_challenges_group_by" AS ENUM('birthYear', 'all');
  ALTER TYPE "public"."enum_pdr_submissions_type" ADD VALUE 'challenge';
  CREATE TABLE "pdr_challenges_results" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"player_id" integer,
  	"group" varchar,
  	"rank" numeric,
  	"value" numeric,
  	"winner" boolean
  );
  
  CREATE TABLE "pdr_challenges" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"month" varchar NOT NULL,
  	"published" boolean DEFAULT false,
  	"description" varchar NOT NULL,
  	"rules" varchar,
  	"demo_video_id" integer,
  	"unit" varchar DEFAULT 'points' NOT NULL,
  	"direction" "enum_pdr_challenges_direction" DEFAULT 'higher' NOT NULL,
  	"group_by" "enum_pdr_challenges_group_by" DEFAULT 'birthYear' NOT NULL,
  	"winners_per_group" numeric DEFAULT 1 NOT NULL,
  	"prize" varchar,
  	"announced_at" timestamp(3) with time zone,
  	"closed_at" timestamp(3) with time zone,
  	"prizes_sent" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "pdr_submissions" ALTER COLUMN "stage_id" DROP NOT NULL;
  ALTER TABLE "pdr_submissions" ADD COLUMN "challenge_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_challenges_id" integer;
  ALTER TABLE "pdr_challenges_results" ADD CONSTRAINT "pdr_challenges_results_player_id_participants_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_challenges_results" ADD CONSTRAINT "pdr_challenges_results_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pdr_challenges"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pdr_challenges" ADD CONSTRAINT "pdr_challenges_demo_video_id_pdr_videos_id_fk" FOREIGN KEY ("demo_video_id") REFERENCES "public"."pdr_videos"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pdr_challenges_results_order_idx" ON "pdr_challenges_results" USING btree ("_order");
  CREATE INDEX "pdr_challenges_results_parent_id_idx" ON "pdr_challenges_results" USING btree ("_parent_id");
  CREATE INDEX "pdr_challenges_results_player_idx" ON "pdr_challenges_results" USING btree ("player_id");
  CREATE UNIQUE INDEX "pdr_challenges_month_idx" ON "pdr_challenges" USING btree ("month");
  CREATE INDEX "pdr_challenges_demo_video_idx" ON "pdr_challenges" USING btree ("demo_video_id");
  CREATE INDEX "pdr_challenges_updated_at_idx" ON "pdr_challenges" USING btree ("updated_at");
  CREATE INDEX "pdr_challenges_created_at_idx" ON "pdr_challenges" USING btree ("created_at");
  ALTER TABLE "pdr_submissions" ADD CONSTRAINT "pdr_submissions_challenge_id_pdr_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."pdr_challenges"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_challenges_fk" FOREIGN KEY ("pdr_challenges_id") REFERENCES "public"."pdr_challenges"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pdr_submissions_challenge_idx" ON "pdr_submissions" USING btree ("challenge_id");
  CREATE INDEX "payload_locked_documents_rels_pdr_challenges_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_challenges_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DELETE FROM "pdr_submissions" WHERE "type" = 'challenge' OR "stage_id" IS NULL;
   ALTER TABLE "pdr_challenges_results" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pdr_challenges" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pdr_challenges_results" CASCADE;
  DROP TABLE "pdr_challenges" CASCADE;
  ALTER TABLE "pdr_submissions" DROP CONSTRAINT IF EXISTS "pdr_submissions_challenge_id_pdr_challenges_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_challenges_fk";
  
  ALTER TABLE "pdr_submissions" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "pdr_submissions" ALTER COLUMN "type" SET DEFAULT 'verification'::text;
  DROP TYPE "public"."enum_pdr_submissions_type";
  CREATE TYPE "public"."enum_pdr_submissions_type" AS ENUM('verification', 'feedback');
  ALTER TABLE "pdr_submissions" ALTER COLUMN "type" SET DEFAULT 'verification'::"public"."enum_pdr_submissions_type";
  ALTER TABLE "pdr_submissions" ALTER COLUMN "type" SET DATA TYPE "public"."enum_pdr_submissions_type" USING "type"::"public"."enum_pdr_submissions_type";
  DROP INDEX IF EXISTS "pdr_submissions_challenge_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_challenges_id_idx";
  ALTER TABLE "pdr_submissions" ALTER COLUMN "stage_id" SET NOT NULL;
  ALTER TABLE "pdr_submissions" DROP COLUMN "challenge_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_challenges_id";
  DROP TYPE "public"."enum_pdr_challenges_direction";
  DROP TYPE "public"."enum_pdr_challenges_group_by";`)
}
