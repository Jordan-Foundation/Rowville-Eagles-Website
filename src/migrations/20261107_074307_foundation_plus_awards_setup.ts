import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pdr_awards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"player_id" integer NOT NULL,
  	"badge_id" integer NOT NULL,
  	"awarded_at" timestamp(3) with time zone,
  	"celebrated_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "setup_progress" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ticked" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pdr_awards_id" integer;
  ALTER TABLE "pdr_awards" ADD CONSTRAINT "pdr_awards_player_id_participants_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pdr_awards" ADD CONSTRAINT "pdr_awards_badge_id_pdr_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."pdr_badges"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pdr_awards_player_idx" ON "pdr_awards" USING btree ("player_id");
  CREATE INDEX "pdr_awards_badge_idx" ON "pdr_awards" USING btree ("badge_id");
  CREATE INDEX "pdr_awards_updated_at_idx" ON "pdr_awards" USING btree ("updated_at");
  CREATE INDEX "pdr_awards_created_at_idx" ON "pdr_awards" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pdr_awards_fk" FOREIGN KEY ("pdr_awards_id") REFERENCES "public"."pdr_awards"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_pdr_awards_id_idx" ON "payload_locked_documents_rels" USING btree ("pdr_awards_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pdr_awards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "setup_progress" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pdr_awards" CASCADE;
  DROP TABLE "setup_progress" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pdr_awards_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_pdr_awards_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pdr_awards_id";`)
}
