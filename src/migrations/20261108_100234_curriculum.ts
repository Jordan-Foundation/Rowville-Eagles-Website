import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_curriculum_standards_level" AS ENUM('F', '8', '9', '10', '11', '12', '13');
  CREATE TYPE "public"."enum_curriculum_standards_strand" AS ENUM('ATT', 'DEF', 'PHY', 'PAS', 'TAC', 'CHA');
  CREATE TABLE "curriculum_standards_descriptors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "curriculum_standards" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"order" numeric,
  	"level" "enum_curriculum_standards_level" NOT NULL,
  	"strand" "enum_curriculum_standards_strand" NOT NULL,
  	"standard" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "curriculum_standards_id" integer;
  ALTER TABLE "curriculum_standards_descriptors" ADD CONSTRAINT "curriculum_standards_descriptors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."curriculum_standards"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "curriculum_standards_descriptors_order_idx" ON "curriculum_standards_descriptors" USING btree ("_order");
  CREATE INDEX "curriculum_standards_descriptors_parent_id_idx" ON "curriculum_standards_descriptors" USING btree ("_parent_id");
  CREATE INDEX "curriculum_standards_updated_at_idx" ON "curriculum_standards" USING btree ("updated_at");
  CREATE INDEX "curriculum_standards_created_at_idx" ON "curriculum_standards" USING btree ("created_at");
  CREATE UNIQUE INDEX "level_strand_idx" ON "curriculum_standards" USING btree ("level","strand");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_curriculum_standards_fk" FOREIGN KEY ("curriculum_standards_id") REFERENCES "public"."curriculum_standards"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_curriculum_standards_id_idx" ON "payload_locked_documents_rels" USING btree ("curriculum_standards_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "curriculum_standards_descriptors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "curriculum_standards" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "curriculum_standards_descriptors" CASCADE;
  DROP TABLE "curriculum_standards" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_curriculum_standards_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_curriculum_standards_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "curriculum_standards_id";
  DROP TYPE "public"."enum_curriculum_standards_level";
  DROP TYPE "public"."enum_curriculum_standards_strand";`)
}
