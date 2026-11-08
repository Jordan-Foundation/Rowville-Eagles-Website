import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "policies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code_of_conduct_link" varchar,
  	"code_of_conduct_text" varchar,
  	"code_of_conduct_updated" timestamp(3) with time zone,
  	"child_safe_link" varchar,
  	"child_safe_text" varchar,
  	"child_safe_updated" timestamp(3) with time zone,
  	"refunds_link" varchar,
  	"refunds_text" varchar,
  	"refunds_updated" timestamp(3) with time zone,
  	"academy_terms_link" varchar,
  	"academy_terms_text" varchar,
  	"academy_terms_updated" timestamp(3) with time zone,
  	"privacy_link" varchar,
  	"privacy_text" varchar,
  	"privacy_updated" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "policies" CASCADE;`)
}
