import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_share_links_mode" AS ENUM('casual', 'term');
  CREATE TYPE "public"."enum_academy_share_links_weekday" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
  CREATE TYPE "public"."enum_academy_share_links_status" AS ENUM('active', 'booked', 'cancelled');
  CREATE TABLE "academy_share_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"token_hash" varchar NOT NULL,
  	"coach_id" integer NOT NULL,
  	"term_id" integer NOT NULL,
  	"mode" "enum_academy_share_links_mode" NOT NULL,
  	"starts_at" timestamp(3) with time zone,
  	"weekday" "enum_academy_share_links_weekday",
  	"start_time" varchar,
  	"client_first_name" varchar NOT NULL,
  	"client_last_name" varchar NOT NULL,
  	"client_player_first_name" varchar,
  	"client_email" varchar NOT NULL,
  	"client_mobile" varchar,
  	"message" varchar,
  	"hold_hours" numeric,
  	"hold_until" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"status" "enum_academy_share_links_status" DEFAULT 'active' NOT NULL,
  	"hold_booking_id" integer,
  	"booking_id" integer,
  	"sent_email" boolean,
  	"sent_sms" boolean,
  	"opened_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "pdr_challenges_results" ALTER COLUMN "player_id" DROP NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "academy_share_links_id" integer;
  ALTER TABLE "academy_share_links" ADD CONSTRAINT "academy_share_links_coach_id_academy_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."academy_coaches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_share_links" ADD CONSTRAINT "academy_share_links_term_id_academy_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academy_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_share_links" ADD CONSTRAINT "academy_share_links_hold_booking_id_academy_bookings_id_fk" FOREIGN KEY ("hold_booking_id") REFERENCES "public"."academy_bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_share_links" ADD CONSTRAINT "academy_share_links_booking_id_academy_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."academy_bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "academy_share_links" ADD CONSTRAINT "academy_share_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "academy_share_links_token_hash_idx" ON "academy_share_links" USING btree ("token_hash");
  CREATE INDEX "academy_share_links_coach_idx" ON "academy_share_links" USING btree ("coach_id");
  CREATE INDEX "academy_share_links_term_idx" ON "academy_share_links" USING btree ("term_id");
  CREATE INDEX "academy_share_links_status_idx" ON "academy_share_links" USING btree ("status");
  CREATE INDEX "academy_share_links_hold_booking_idx" ON "academy_share_links" USING btree ("hold_booking_id");
  CREATE INDEX "academy_share_links_booking_idx" ON "academy_share_links" USING btree ("booking_id");
  CREATE INDEX "academy_share_links_created_by_idx" ON "academy_share_links" USING btree ("created_by_id");
  CREATE INDEX "academy_share_links_updated_at_idx" ON "academy_share_links" USING btree ("updated_at");
  CREATE INDEX "academy_share_links_created_at_idx" ON "academy_share_links" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_academy_share_links_fk" FOREIGN KEY ("academy_share_links_id") REFERENCES "public"."academy_share_links"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_academy_share_links_id_idx" ON "payload_locked_documents_rels" USING btree ("academy_share_links_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_share_links" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "academy_share_links" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_academy_share_links_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_academy_share_links_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "academy_share_links_id";
  DROP TYPE "public"."enum_academy_share_links_mode";
  DROP TYPE "public"."enum_academy_share_links_weekday";
  DROP TYPE "public"."enum_academy_share_links_status";`)
}
