import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_session_summaries_worked_on" AS ENUM('First touch', 'Ball mastery', 'Dribbling & 1v1', 'Passing', 'Receiving & turning', 'Shooting & finishing', 'Weak foot', 'Defending 1v1', 'Heading', 'Speed & agility', 'Game understanding', 'Confidence');
  CREATE TYPE "public"."enum_session_summaries_kind" AS ENUM('one-on-one', 'group');
  CREATE TABLE "push_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"p256dh" varchar NOT NULL,
  	"auth" varchar NOT NULL,
  	"device" varchar,
  	"last_sent_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "session_summaries_worked_on" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_session_summaries_worked_on",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "session_summaries_players" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"session_id" integer NOT NULL,
  	"name" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "session_summaries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"session_id" integer NOT NULL,
  	"kind" "enum_session_summaries_kind",
  	"coach_id" integer NOT NULL,
  	"session_at" timestamp(3) with time zone NOT NULL,
  	"went_well" varchar,
  	"next_steps" varchar,
  	"homework" varchar,
  	"effort" numeric,
  	"private_notes" varchar,
  	"submitted_at" timestamp(3) with time zone,
  	"submitted_by_id" integer,
  	"emailed_at" timestamp(3) with time zone,
  	"hidden" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"public_key" varchar,
  	"private_key" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_subscriptions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "session_summaries_id" integer;
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "session_summaries_worked_on" ADD CONSTRAINT "session_summaries_worked_on_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."session_summaries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "session_summaries_players" ADD CONSTRAINT "session_summaries_players_session_id_academy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."academy_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "session_summaries_players" ADD CONSTRAINT "session_summaries_players_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."session_summaries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_session_id_academy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."academy_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");
  CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
  CREATE INDEX "push_subscriptions_updated_at_idx" ON "push_subscriptions" USING btree ("updated_at");
  CREATE INDEX "push_subscriptions_created_at_idx" ON "push_subscriptions" USING btree ("created_at");
  CREATE INDEX "session_summaries_worked_on_order_idx" ON "session_summaries_worked_on" USING btree ("order");
  CREATE INDEX "session_summaries_worked_on_parent_idx" ON "session_summaries_worked_on" USING btree ("parent_id");
  CREATE INDEX "session_summaries_players_order_idx" ON "session_summaries_players" USING btree ("_order");
  CREATE INDEX "session_summaries_players_parent_id_idx" ON "session_summaries_players" USING btree ("_parent_id");
  CREATE INDEX "session_summaries_players_session_idx" ON "session_summaries_players" USING btree ("session_id");
  CREATE UNIQUE INDEX "session_summaries_session_idx" ON "session_summaries" USING btree ("session_id");
  CREATE INDEX "session_summaries_coach_idx" ON "session_summaries" USING btree ("coach_id");
  CREATE INDEX "session_summaries_session_at_idx" ON "session_summaries" USING btree ("session_at");
  CREATE INDEX "session_summaries_submitted_by_idx" ON "session_summaries" USING btree ("submitted_by_id");
  CREATE INDEX "session_summaries_updated_at_idx" ON "session_summaries" USING btree ("updated_at");
  CREATE INDEX "session_summaries_created_at_idx" ON "session_summaries" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_session_summaries_fk" FOREIGN KEY ("session_summaries_id") REFERENCES "public"."session_summaries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_session_summaries_id_idx" ON "payload_locked_documents_rels" USING btree ("session_summaries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "push_subscriptions" CASCADE;
  DROP TABLE IF EXISTS "session_summaries_worked_on" CASCADE;
  DROP TABLE IF EXISTS "session_summaries_players" CASCADE;
  DROP TABLE IF EXISTS "session_summaries" CASCADE;
  DROP TABLE IF EXISTS "push_keys" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_push_subscriptions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_session_summaries_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_push_subscriptions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_session_summaries_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "push_subscriptions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "session_summaries_id";
  DROP TYPE IF EXISTS "public"."enum_session_summaries_worked_on";
  DROP TYPE IF EXISTS "public"."enum_session_summaries_kind";`)
}
