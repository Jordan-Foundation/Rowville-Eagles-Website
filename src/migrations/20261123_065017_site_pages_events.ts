import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_events_category" AS ENUM('club', 'juniors', 'seniors', 'academy', 'social');
  CREATE TYPE "public"."enum_enquiries_team" AS ENUM('men', 'reserves', 'women', 'unsure');
  CREATE TYPE "public"."enum_enquiries_status" AS ENUM('new', 'contacted', 'signed', 'closed');
  CREATE TABLE "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"start" timestamp(3) with time zone NOT NULL,
  	"end" timestamp(3) with time zone,
  	"all_day" boolean DEFAULT false,
  	"category" "enum_events_category" DEFAULT 'club',
  	"location" varchar,
  	"summary" varchar,
  	"details" varchar,
  	"link" varchar,
  	"link_label" varchar,
  	"published" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "enquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"team" "enum_enquiries_team",
  	"age" numeric,
  	"position" varchar,
  	"previous_club" varchar,
  	"message" varchar,
  	"status" "enum_enquiries_status" DEFAULT 'new',
  	"emailed_to" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "about_committee" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" varchar NOT NULL,
  	"photo_id" integer,
  	"bio" varchar,
  	"email" varchar
  );
  
  CREATE TABLE "senior_teams" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enquiry_email" varchar DEFAULT 'refc.secretary@outlook.com' NOT NULL,
  	"men_tagline" varchar,
  	"men_about" varchar,
  	"men_photo_id" integer,
  	"men_coach_name" varchar,
  	"men_coach_role" varchar,
  	"men_coach_photo_id" integer,
  	"men_coach_bio" varchar,
  	"men_league" varchar,
  	"men_league_url" varchar,
  	"men_training" varchar,
  	"men_match_day" varchar,
  	"reserves_tagline" varchar,
  	"reserves_about" varchar,
  	"reserves_photo_id" integer,
  	"reserves_coach_name" varchar,
  	"reserves_coach_role" varchar,
  	"reserves_coach_photo_id" integer,
  	"reserves_coach_bio" varchar,
  	"reserves_league" varchar,
  	"reserves_league_url" varchar,
  	"reserves_training" varchar,
  	"reserves_match_day" varchar,
  	"women_tagline" varchar,
  	"women_about" varchar,
  	"women_photo_id" integer,
  	"women_coach_name" varchar,
  	"women_coach_role" varchar,
  	"women_coach_photo_id" integer,
  	"women_coach_bio" varchar,
  	"women_league" varchar,
  	"women_league_url" varchar,
  	"women_training" varchar,
  	"women_match_day" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "enquiries_id" integer;
  ALTER TABLE "about_committee" ADD CONSTRAINT "about_committee_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_committee" ADD CONSTRAINT "about_committee_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "senior_teams" ADD CONSTRAINT "senior_teams_men_photo_id_media_id_fk" FOREIGN KEY ("men_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "senior_teams" ADD CONSTRAINT "senior_teams_men_coach_photo_id_media_id_fk" FOREIGN KEY ("men_coach_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "senior_teams" ADD CONSTRAINT "senior_teams_reserves_photo_id_media_id_fk" FOREIGN KEY ("reserves_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "senior_teams" ADD CONSTRAINT "senior_teams_reserves_coach_photo_id_media_id_fk" FOREIGN KEY ("reserves_coach_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "senior_teams" ADD CONSTRAINT "senior_teams_women_photo_id_media_id_fk" FOREIGN KEY ("women_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "senior_teams" ADD CONSTRAINT "senior_teams_women_coach_photo_id_media_id_fk" FOREIGN KEY ("women_coach_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "events_start_idx" ON "events" USING btree ("start");
  CREATE INDEX "events_published_idx" ON "events" USING btree ("published");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status");
  CREATE INDEX "enquiries_updated_at_idx" ON "enquiries" USING btree ("updated_at");
  CREATE INDEX "enquiries_created_at_idx" ON "enquiries" USING btree ("created_at");
  CREATE INDEX "about_committee_order_idx" ON "about_committee" USING btree ("_order");
  CREATE INDEX "about_committee_parent_id_idx" ON "about_committee" USING btree ("_parent_id");
  CREATE INDEX "about_committee_photo_idx" ON "about_committee" USING btree ("photo_id");
  CREATE INDEX "senior_teams_men_men_photo_idx" ON "senior_teams" USING btree ("men_photo_id");
  CREATE INDEX "senior_teams_men_men_coach_photo_idx" ON "senior_teams" USING btree ("men_coach_photo_id");
  CREATE INDEX "senior_teams_reserves_reserves_photo_idx" ON "senior_teams" USING btree ("reserves_photo_id");
  CREATE INDEX "senior_teams_reserves_reserves_coach_photo_idx" ON "senior_teams" USING btree ("reserves_coach_photo_id");
  CREATE INDEX "senior_teams_women_women_photo_idx" ON "senior_teams" USING btree ("women_photo_id");
  CREATE INDEX "senior_teams_women_women_coach_photo_idx" ON "senior_teams" USING btree ("women_coach_photo_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enquiries_fk" FOREIGN KEY ("enquiries_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_enquiries_id_idx" ON "payload_locked_documents_rels" USING btree ("enquiries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "events" CASCADE;
  DROP TABLE IF EXISTS "enquiries" CASCADE;
  DROP TABLE IF EXISTS "about_committee" CASCADE;
  DROP TABLE IF EXISTS "senior_teams" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_enquiries_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_events_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_enquiries_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "enquiries_id";
  DROP TYPE IF EXISTS "public"."enum_events_category";
  DROP TYPE IF EXISTS "public"."enum_enquiries_team";
  DROP TYPE IF EXISTS "public"."enum_enquiries_status";`)
}
