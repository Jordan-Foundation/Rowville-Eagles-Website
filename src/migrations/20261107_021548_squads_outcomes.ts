import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_selection_entries_outcome_queued" AS ENUM('selected', 'successful', 'unsuccessful');
  CREATE TABLE "squads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"round_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"capacity" numeric,
  	"fee" numeric,
  	"team_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "squads_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  CREATE TABLE "squads_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  ALTER TABLE "selection_rounds" ADD COLUMN "templates_selected_subject" varchar DEFAULT '{player} has been selected — {event}';
  ALTER TABLE "selection_rounds" ADD COLUMN "templates_selected_body" varchar DEFAULT 'Congratulations {parent} — {player} has been selected to play in {team} at {event}.
  
  Please complete registration and payment using the button below so we can confirm {player}’s place.';
  ALTER TABLE "selection_rounds" ADD COLUMN "templates_selected_sms" varchar DEFAULT '{event}: {player} has been selected for {team}! Complete registration: {link}';
  ALTER TABLE "selection_rounds" ADD COLUMN "templates_successful_subject" varchar DEFAULT 'Welcome to the Eagles, {player}!';
  ALTER TABLE "selection_rounds" ADD COLUMN "templates_successful_body" varchar DEFAULT 'Congratulations {parent} — after trials we’d love {player} to join {team} for the season.
  
  Please complete registration and payment using the button below to accept the place.';
  ALTER TABLE "selection_rounds" ADD COLUMN "templates_successful_sms" varchar DEFAULT 'Rowville Eagles: congratulations — {player} has a place in {team}! Complete registration: {link}';
  ALTER TABLE "selection_rounds" ADD COLUMN "templates_unsuccessful_subject" varchar DEFAULT 'Trial outcome for {player}';
  ALTER TABLE "selection_rounds" ADD COLUMN "templates_unsuccessful_body" varchar DEFAULT 'Thank you for trialling with Rowville Eagles. We’ve had a great number of players this season, and on this occasion we’re unable to offer {player} a place in a {ageGroup} team. We know this is disappointing.
  
  We’d love {player} to keep playing — we’ll keep their details in case a spot opens up, and you’re welcome to contact us for feedback.';
  ALTER TABLE "selection_rounds" ADD COLUMN "templates_unsuccessful_sms" varchar DEFAULT '';
  ALTER TABLE "selection_entries" ADD COLUMN "squad_id" integer;
  ALTER TABLE "selection_entries" ADD COLUMN "outcome_queued" "enum_selection_entries_outcome_queued";
  ALTER TABLE "selection_entries" ADD COLUMN "outcome_email" boolean DEFAULT true;
  ALTER TABLE "selection_entries" ADD COLUMN "selected_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "outcome_sent_at" timestamp(3) with time zone;
  ALTER TABLE "selection_entries" ADD COLUMN "outcome_sent_by_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "squads_id" integer;
  ALTER TABLE "squads" ADD CONSTRAINT "squads_round_id_selection_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."selection_rounds"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "squads" ADD CONSTRAINT "squads_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "squads_numbers" ADD CONSTRAINT "squads_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."squads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "squads_rels" ADD CONSTRAINT "squads_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."squads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "squads_rels" ADD CONSTRAINT "squads_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "squads_round_idx" ON "squads" USING btree ("round_id");
  CREATE INDEX "squads_team_idx" ON "squads" USING btree ("team_id");
  CREATE INDEX "squads_updated_at_idx" ON "squads" USING btree ("updated_at");
  CREATE INDEX "squads_created_at_idx" ON "squads" USING btree ("created_at");
  CREATE INDEX "squads_numbers_order_parent_idx" ON "squads_numbers" USING btree ("order","parent_id");
  CREATE INDEX "squads_rels_order_idx" ON "squads_rels" USING btree ("order");
  CREATE INDEX "squads_rels_parent_idx" ON "squads_rels" USING btree ("parent_id");
  CREATE INDEX "squads_rels_path_idx" ON "squads_rels" USING btree ("path");
  CREATE INDEX "squads_rels_users_id_idx" ON "squads_rels" USING btree ("users_id");
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_entries" ADD CONSTRAINT "selection_entries_outcome_sent_by_id_users_id_fk" FOREIGN KEY ("outcome_sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_squads_fk" FOREIGN KEY ("squads_id") REFERENCES "public"."squads"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "selection_entries_squad_idx" ON "selection_entries" USING btree ("squad_id");
  CREATE INDEX "selection_entries_outcome_sent_by_idx" ON "selection_entries" USING btree ("outcome_sent_by_id");
  CREATE INDEX "payload_locked_documents_rels_squads_id_idx" ON "payload_locked_documents_rels" USING btree ("squads_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "squads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "squads_numbers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "squads_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "squads" CASCADE;
  DROP TABLE "squads_numbers" CASCADE;
  DROP TABLE "squads_rels" CASCADE;
  ALTER TABLE "selection_entries" DROP CONSTRAINT "selection_entries_squad_id_squads_id_fk";
  
  ALTER TABLE "selection_entries" DROP CONSTRAINT "selection_entries_outcome_sent_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_squads_fk";
  
  DROP INDEX "selection_entries_squad_idx";
  DROP INDEX "selection_entries_outcome_sent_by_idx";
  DROP INDEX "payload_locked_documents_rels_squads_id_idx";
  ALTER TABLE "selection_rounds" DROP COLUMN "templates_selected_subject";
  ALTER TABLE "selection_rounds" DROP COLUMN "templates_selected_body";
  ALTER TABLE "selection_rounds" DROP COLUMN "templates_selected_sms";
  ALTER TABLE "selection_rounds" DROP COLUMN "templates_successful_subject";
  ALTER TABLE "selection_rounds" DROP COLUMN "templates_successful_body";
  ALTER TABLE "selection_rounds" DROP COLUMN "templates_successful_sms";
  ALTER TABLE "selection_rounds" DROP COLUMN "templates_unsuccessful_subject";
  ALTER TABLE "selection_rounds" DROP COLUMN "templates_unsuccessful_body";
  ALTER TABLE "selection_rounds" DROP COLUMN "templates_unsuccessful_sms";
  ALTER TABLE "selection_entries" DROP COLUMN "squad_id";
  ALTER TABLE "selection_entries" DROP COLUMN "outcome_queued";
  ALTER TABLE "selection_entries" DROP COLUMN "outcome_email";
  ALTER TABLE "selection_entries" DROP COLUMN "selected_at";
  ALTER TABLE "selection_entries" DROP COLUMN "outcome_sent_at";
  ALTER TABLE "selection_entries" DROP COLUMN "outcome_sent_by_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "squads_id";
  DROP TYPE "public"."enum_selection_entries_outcome_queued";`)
}
