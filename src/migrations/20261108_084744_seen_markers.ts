import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "seen_markers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "seen_markers_id" integer;
  ALTER TABLE "seen_markers" ADD CONSTRAINT "seen_markers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "seen_markers_user_idx" ON "seen_markers" USING btree ("user_id");
  CREATE INDEX "seen_markers_updated_at_idx" ON "seen_markers" USING btree ("updated_at");
  CREATE INDEX "seen_markers_created_at_idx" ON "seen_markers" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_key_idx" ON "seen_markers" USING btree ("user_id","key");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seen_markers_fk" FOREIGN KEY ("seen_markers_id") REFERENCES "public"."seen_markers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_seen_markers_id_idx" ON "payload_locked_documents_rels" USING btree ("seen_markers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "seen_markers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "seen_markers" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_seen_markers_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_seen_markers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "seen_markers_id";`)
}
