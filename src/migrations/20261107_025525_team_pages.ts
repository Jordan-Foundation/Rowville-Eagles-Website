import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_teams_training_day" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TYPE "public"."enum_teams_type" AS ENUM('rowville', 'tournament');
  CREATE TYPE "public"."enum_teams_brand" AS ENUM('club', 'academy');
  CREATE TYPE "public"."enum_team_members_source" AS ENUM('selection', 'registration', 'admin');
  CREATE TABLE "teams_fixtures" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"opponent" varchar NOT NULL,
  	"venue" varchar,
  	"result" varchar
  );
  
  CREATE TABLE "teams_training" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" "enum_teams_training_day" NOT NULL,
  	"start" varchar NOT NULL,
  	"end" varchar,
  	"location" varchar
  );
  
  CREATE TABLE "team_members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"team_id" integer NOT NULL,
  	"participant_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"active" boolean DEFAULT true,
  	"source" "enum_team_members_source" DEFAULT 'admin',
  	"selection_entry_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "team_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"team_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"author_id" integer NOT NULL,
  	"pinned" boolean DEFAULT false,
  	"sent_at" timestamp(3) with time zone,
  	"sent_to" numeric,
  	"edited_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "forum_threads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"team_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"author_id" integer NOT NULL,
  	"pinned" boolean DEFAULT false,
  	"locked" boolean DEFAULT false,
  	"last_activity_at" timestamp(3) with time zone,
  	"removed_at" timestamp(3) with time zone,
  	"removed_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "forum_replies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"thread_id" integer NOT NULL,
  	"body" varchar NOT NULL,
  	"author_id" integer NOT NULL,
  	"removed_at" timestamp(3) with time zone,
  	"removed_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "teams" ALTER COLUMN "category" DROP NOT NULL;
  ALTER TABLE "teams" ADD COLUMN "type" "enum_teams_type" DEFAULT 'rowville' NOT NULL;
  ALTER TABLE "teams" ADD COLUMN "season" numeric;
  ALTER TABLE "teams" ADD COLUMN "archived" boolean DEFAULT false;
  ALTER TABLE "teams" ADD COLUMN "brand" "enum_teams_brand" DEFAULT 'club';
  ALTER TABLE "teams" ADD COLUMN "event" varchar;
  ALTER TABLE "teams" ADD COLUMN "sections_info" boolean DEFAULT true;
  ALTER TABLE "teams" ADD COLUMN "sections_notices" boolean DEFAULT true;
  ALTER TABLE "teams" ADD COLUMN "sections_fixtures" boolean DEFAULT true;
  ALTER TABLE "teams" ADD COLUMN "sections_training" boolean DEFAULT true;
  ALTER TABLE "teams" ADD COLUMN "sections_forum" boolean DEFAULT true;
  ALTER TABLE "teams" ADD COLUMN "info_dates" varchar;
  ALTER TABLE "teams" ADD COLUMN "info_venues" varchar;
  ALTER TABLE "teams" ADD COLUMN "info_schedule" varchar;
  ALTER TABLE "teams" ADD COLUMN "info_what_to_bring" varchar;
  ALTER TABLE "teams" ADD COLUMN "info_costs" varchar;
  ALTER TABLE "teams" ADD COLUMN "info_contacts" varchar;
  ALTER TABLE "teams" ADD COLUMN "external_url" varchar;
  ALTER TABLE "teams" ADD COLUMN "training_changed_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "team_members_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "team_posts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "forum_threads_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "forum_replies_id" integer;
  ALTER TABLE "teams_fixtures" ADD CONSTRAINT "teams_fixtures_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "teams_training" ADD CONSTRAINT "teams_training_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "team_members" ADD CONSTRAINT "team_members_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "team_members" ADD CONSTRAINT "team_members_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "team_members" ADD CONSTRAINT "team_members_selection_entry_id_selection_entries_id_fk" FOREIGN KEY ("selection_entry_id") REFERENCES "public"."selection_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "team_posts" ADD CONSTRAINT "team_posts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "team_posts" ADD CONSTRAINT "team_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_removed_by_id_users_id_fk" FOREIGN KEY ("removed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_removed_by_id_users_id_fk" FOREIGN KEY ("removed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "teams_fixtures_order_idx" ON "teams_fixtures" USING btree ("_order");
  CREATE INDEX "teams_fixtures_parent_id_idx" ON "teams_fixtures" USING btree ("_parent_id");
  CREATE INDEX "teams_training_order_idx" ON "teams_training" USING btree ("_order");
  CREATE INDEX "teams_training_parent_id_idx" ON "teams_training" USING btree ("_parent_id");
  CREATE INDEX "team_members_team_idx" ON "team_members" USING btree ("team_id");
  CREATE INDEX "team_members_participant_idx" ON "team_members" USING btree ("participant_id");
  CREATE INDEX "team_members_account_idx" ON "team_members" USING btree ("account_id");
  CREATE INDEX "team_members_selection_entry_idx" ON "team_members" USING btree ("selection_entry_id");
  CREATE INDEX "team_members_updated_at_idx" ON "team_members" USING btree ("updated_at");
  CREATE INDEX "team_members_created_at_idx" ON "team_members" USING btree ("created_at");
  CREATE INDEX "team_posts_team_idx" ON "team_posts" USING btree ("team_id");
  CREATE INDEX "team_posts_author_idx" ON "team_posts" USING btree ("author_id");
  CREATE INDEX "team_posts_updated_at_idx" ON "team_posts" USING btree ("updated_at");
  CREATE INDEX "team_posts_created_at_idx" ON "team_posts" USING btree ("created_at");
  CREATE INDEX "forum_threads_team_idx" ON "forum_threads" USING btree ("team_id");
  CREATE INDEX "forum_threads_author_idx" ON "forum_threads" USING btree ("author_id");
  CREATE INDEX "forum_threads_last_activity_at_idx" ON "forum_threads" USING btree ("last_activity_at");
  CREATE INDEX "forum_threads_removed_by_idx" ON "forum_threads" USING btree ("removed_by_id");
  CREATE INDEX "forum_threads_updated_at_idx" ON "forum_threads" USING btree ("updated_at");
  CREATE INDEX "forum_threads_created_at_idx" ON "forum_threads" USING btree ("created_at");
  CREATE INDEX "forum_replies_thread_idx" ON "forum_replies" USING btree ("thread_id");
  CREATE INDEX "forum_replies_author_idx" ON "forum_replies" USING btree ("author_id");
  CREATE INDEX "forum_replies_removed_by_idx" ON "forum_replies" USING btree ("removed_by_id");
  CREATE INDEX "forum_replies_updated_at_idx" ON "forum_replies" USING btree ("updated_at");
  CREATE INDEX "forum_replies_created_at_idx" ON "forum_replies" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_team_members_fk" FOREIGN KEY ("team_members_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_team_posts_fk" FOREIGN KEY ("team_posts_id") REFERENCES "public"."team_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forum_threads_fk" FOREIGN KEY ("forum_threads_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forum_replies_fk" FOREIGN KEY ("forum_replies_id") REFERENCES "public"."forum_replies"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_team_members_id_idx" ON "payload_locked_documents_rels" USING btree ("team_members_id");
  CREATE INDEX "payload_locked_documents_rels_team_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("team_posts_id");
  CREATE INDEX "payload_locked_documents_rels_forum_threads_id_idx" ON "payload_locked_documents_rels" USING btree ("forum_threads_id");
  CREATE INDEX "payload_locked_documents_rels_forum_replies_id_idx" ON "payload_locked_documents_rels" USING btree ("forum_replies_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "teams_fixtures" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "teams_training" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "team_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "team_posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forum_threads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forum_replies" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "teams_fixtures" CASCADE;
  DROP TABLE "teams_training" CASCADE;
  DROP TABLE "team_members" CASCADE;
  DROP TABLE "team_posts" CASCADE;
  DROP TABLE "forum_threads" CASCADE;
  DROP TABLE "forum_replies" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_team_members_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_team_posts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_forum_threads_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_forum_replies_fk";
  
  DROP INDEX "payload_locked_documents_rels_team_members_id_idx";
  DROP INDEX "payload_locked_documents_rels_team_posts_id_idx";
  DROP INDEX "payload_locked_documents_rels_forum_threads_id_idx";
  DROP INDEX "payload_locked_documents_rels_forum_replies_id_idx";
  ALTER TABLE "teams" ALTER COLUMN "category" SET NOT NULL;
  ALTER TABLE "teams" DROP COLUMN "type";
  ALTER TABLE "teams" DROP COLUMN "season";
  ALTER TABLE "teams" DROP COLUMN "archived";
  ALTER TABLE "teams" DROP COLUMN "brand";
  ALTER TABLE "teams" DROP COLUMN "event";
  ALTER TABLE "teams" DROP COLUMN "sections_info";
  ALTER TABLE "teams" DROP COLUMN "sections_notices";
  ALTER TABLE "teams" DROP COLUMN "sections_fixtures";
  ALTER TABLE "teams" DROP COLUMN "sections_training";
  ALTER TABLE "teams" DROP COLUMN "sections_forum";
  ALTER TABLE "teams" DROP COLUMN "info_dates";
  ALTER TABLE "teams" DROP COLUMN "info_venues";
  ALTER TABLE "teams" DROP COLUMN "info_schedule";
  ALTER TABLE "teams" DROP COLUMN "info_what_to_bring";
  ALTER TABLE "teams" DROP COLUMN "info_costs";
  ALTER TABLE "teams" DROP COLUMN "info_contacts";
  ALTER TABLE "teams" DROP COLUMN "external_url";
  ALTER TABLE "teams" DROP COLUMN "training_changed_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "team_members_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "team_posts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "forum_threads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "forum_replies_id";
  DROP TYPE "public"."enum_teams_training_day";
  DROP TYPE "public"."enum_teams_type";
  DROP TYPE "public"."enum_teams_brand";
  DROP TYPE "public"."enum_team_members_source";`)
}
