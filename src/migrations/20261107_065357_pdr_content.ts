import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pdr_stages_scoring" AS ENUM('scored', 'judged');
  CREATE TYPE "public"."enum_pdr_stages_criteria_direction" AS ENUM('higher', 'lower');
  CREATE TYPE "public"."enum_pdr_videos_kind" AS ENUM('tutorial', 'demo', 'challenge');
  CREATE TYPE "public"."enum_pdr_badges_type" AS ENUM('level', 'monthly');
  CREATE TYPE "public"."enum_participants_pdr_tier" AS ENUM('free', 'standard', 'premium');
  CREATE TABLE "pdr_areas" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"order" numeric DEFAULT 1,
  	"has_leaderboard" boolean DEFAULT true,
  	"colour" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pdr_levels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar,
  	"area_id" integer NOT NULL,
  	"number" numeric NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pdr_stages_coaching_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar NOT NULL
  );
  
  CREATE TABLE "pdr_stages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"sort_key" varchar,
  	"level_id" integer NOT NULL,
  	"stage_number" numeric NOT NULL,
  	"code" varchar,
  	"area_id" integer,
  	"level_number" numeric,
  	"skill_name" varchar NOT NULL,
  	"technique" varchar,
  	"challenge" varchar,
  	"scoring" "enum_pdr_stages_scoring" DEFAULT 'scored',
  	"criteria_target" numeric,
  	"criteria_unit" varchar,
  	"criteria_direction" "enum_pdr_stages_criteria_direction" DEFAULT 'higher',
  	"criteria_time_limit_sec" numeric,
  	"criteria_distance_m" numeric,
  	"tutorial_video_id" integer,
  	"demo_video_id" integer,
  	"placeholder" boolean DEFAULT false,
  	"published" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pdr_videos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_pdr_videos_kind" DEFAULT 'tutorial',
  	"duration_sec" numeric,
  	"stream_uid" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pdr_badges" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"type" "enum_pdr_badges_type" DEFAULT 'level' NOT NULL,
  	"area_id" integer,
  	"level_id" integer,
  	"artwork_id" integer,
  	"how_to_earn" varchar,
  	"placeholder" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pdr_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"max_clip_seconds" numeric DEFAULT 90,
  	"max_file_m_b" numeric DEFAULT 200,
  	"retention_months" numeric DEFAULT 6,
  	"feedback_per_month" numeric DEFAULT 2,
  	"min_players_for_ranking" numeric DEFAULT 5,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "participants" ADD COLUMN "pdr_tier" "enum_participants_pdr_tier" DEFAULT 'free';
  ALTER TABLE "participants" ADD COLUMN "pdr_subscription_id" varchar;
  ALTER TABLE "participants" ADD COLUMN "pdr_subscription_status" varchar;
  ALTER TABLE "participants" ADD COLUMN "pdr_leaderboard_opt_out" boolean DEFAULT false;
  ALTER TABLE "participants" ADD COLUMN "pdr_leaderboard_name" varchar;
  ALTER TABLE "participants" ADD COLUMN "pdr_consent_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_areas_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_levels_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_stages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_videos_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_badges_id" integer;
  ALTER TABLE "pdr_levels" ADD CONSTRAINT "pdr_levels_area_id_pdr_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."pdr_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_stages_coaching_points" ADD CONSTRAINT "pdr_stages_coaching_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pdr_stages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pdr_stages" ADD CONSTRAINT "pdr_stages_level_id_pdr_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."pdr_levels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_stages" ADD CONSTRAINT "pdr_stages_area_id_pdr_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."pdr_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_stages" ADD CONSTRAINT "pdr_stages_tutorial_video_id_pdr_videos_id_fk" FOREIGN KEY ("tutorial_video_id") REFERENCES "public"."pdr_videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_stages" ADD CONSTRAINT "pdr_stages_demo_video_id_pdr_videos_id_fk" FOREIGN KEY ("demo_video_id") REFERENCES "public"."pdr_videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_badges" ADD CONSTRAINT "pdr_badges_area_id_pdr_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."pdr_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_badges" ADD CONSTRAINT "pdr_badges_level_id_pdr_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."pdr_levels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_badges" ADD CONSTRAINT "pdr_badges_artwork_id_media_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "pdr_areas_name_idx" ON "pdr_areas" USING btree ("name");
  CREATE UNIQUE INDEX "pdr_areas_slug_idx" ON "pdr_areas" USING btree ("slug");
  CREATE INDEX "pdr_areas_updated_at_idx" ON "pdr_areas" USING btree ("updated_at");
  CREATE INDEX "pdr_areas_created_at_idx" ON "pdr_areas" USING btree ("created_at");
  CREATE INDEX "pdr_levels_area_idx" ON "pdr_levels" USING btree ("area_id");
  CREATE INDEX "pdr_levels_number_idx" ON "pdr_levels" USING btree ("number");
  CREATE INDEX "pdr_levels_updated_at_idx" ON "pdr_levels" USING btree ("updated_at");
  CREATE INDEX "pdr_levels_created_at_idx" ON "pdr_levels" USING btree ("created_at");
  CREATE INDEX "pdr_stages_coaching_points_order_idx" ON "pdr_stages_coaching_points" USING btree ("_order");
  CREATE INDEX "pdr_stages_coaching_points_parent_id_idx" ON "pdr_stages_coaching_points" USING btree ("_parent_id");
  CREATE INDEX "pdr_stages_sort_key_idx" ON "pdr_stages" USING btree ("sort_key");
  CREATE INDEX "pdr_stages_level_idx" ON "pdr_stages" USING btree ("level_id");
  CREATE INDEX "pdr_stages_code_idx" ON "pdr_stages" USING btree ("code");
  CREATE INDEX "pdr_stages_area_idx" ON "pdr_stages" USING btree ("area_id");
  CREATE INDEX "pdr_stages_level_number_idx" ON "pdr_stages" USING btree ("level_number");
  CREATE INDEX "pdr_stages_tutorial_video_idx" ON "pdr_stages" USING btree ("tutorial_video_id");
  CREATE INDEX "pdr_stages_demo_video_idx" ON "pdr_stages" USING btree ("demo_video_id");
  CREATE INDEX "pdr_stages_updated_at_idx" ON "pdr_stages" USING btree ("updated_at");
  CREATE INDEX "pdr_stages_created_at_idx" ON "pdr_stages" USING btree ("created_at");
  CREATE INDEX "pdr_videos_stream_uid_idx" ON "pdr_videos" USING btree ("stream_uid");
  CREATE INDEX "pdr_videos_updated_at_idx" ON "pdr_videos" USING btree ("updated_at");
  CREATE INDEX "pdr_videos_created_at_idx" ON "pdr_videos" USING btree ("created_at");
  CREATE INDEX "pdr_badges_area_idx" ON "pdr_badges" USING btree ("area_id");
  CREATE UNIQUE INDEX "pdr_badges_level_idx" ON "pdr_badges" USING btree ("level_id");
  CREATE INDEX "pdr_badges_artwork_idx" ON "pdr_badges" USING btree ("artwork_id");
  CREATE INDEX "pdr_badges_updated_at_idx" ON "pdr_badges" USING btree ("updated_at");
  CREATE INDEX "pdr_badges_created_at_idx" ON "pdr_badges" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_areas_fk" FOREIGN KEY ("pdr_areas_id") REFERENCES "public"."pdr_areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_levels_fk" FOREIGN KEY ("pdr_levels_id") REFERENCES "public"."pdr_levels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_stages_fk" FOREIGN KEY ("pdr_stages_id") REFERENCES "public"."pdr_stages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_videos_fk" FOREIGN KEY ("pdr_videos_id") REFERENCES "public"."pdr_videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_badges_fk" FOREIGN KEY ("pdr_badges_id") REFERENCES "public"."pdr_badges"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_pdr_areas_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_areas_id");
  CREATE INDEX "payload_locked_documents_rels_pdr_levels_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_levels_id");
  CREATE INDEX "payload_locked_documents_rels_pdr_stages_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_stages_id");
  CREATE INDEX "payload_locked_documents_rels_pdr_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_videos_id");
  CREATE INDEX "payload_locked_documents_rels_pdr_badges_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_badges_id");`)
  // Starting content (areas, levels, stages, badges) is added after all migrations by ensureLaunchContent
  // (src/lib/launch-content.ts) — running today's code here would break on a brand-new database.
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pdr_areas" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pdr_levels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pdr_stages_coaching_points" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pdr_stages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pdr_videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pdr_badges" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pdr_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pdr_areas" CASCADE;
  DROP TABLE "pdr_levels" CASCADE;
  DROP TABLE "pdr_stages_coaching_points" CASCADE;
  DROP TABLE "pdr_stages" CASCADE;
  DROP TABLE "pdr_videos" CASCADE;
  DROP TABLE "pdr_badges" CASCADE;
  DROP TABLE "pdr_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_areas_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_levels_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_stages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_videos_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_badges_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_areas_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_levels_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_stages_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_videos_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_badges_id_idx";
  ALTER TABLE "participants" DROP COLUMN "pdr_tier";
  ALTER TABLE "participants" DROP COLUMN "pdr_subscription_id";
  ALTER TABLE "participants" DROP COLUMN "pdr_subscription_status";
  ALTER TABLE "participants" DROP COLUMN "pdr_leaderboard_opt_out";
  ALTER TABLE "participants" DROP COLUMN "pdr_leaderboard_name";
  ALTER TABLE "participants" DROP COLUMN "pdr_consent_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_areas_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_levels_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_stages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_videos_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_badges_id";
  DROP TYPE "public"."enum_pdr_stages_scoring";
  DROP TYPE "public"."enum_pdr_stages_criteria_direction";
  DROP TYPE "public"."enum_pdr_videos_kind";
  DROP TYPE "public"."enum_pdr_badges_type";
  DROP TYPE "public"."enum_participants_pdr_tier";`)
}
