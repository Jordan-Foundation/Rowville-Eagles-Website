import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_messages_direction" AS ENUM('in', 'out', 'note');
  CREATE TYPE "public"."enum_messages_channel" AS ENUM('sms', 'portal', 'email', 'system');
  CREATE TYPE "public"."enum_messages_author_role" AS ENUM('family', 'coach', 'admin', 'system');
  CREATE TYPE "public"."enum_messages_delivery" AS ENUM('sms', 'email', 'failed', 'received');
  CREATE TABLE "conversations_reads" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "conversations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"account_id" integer,
  	"phone" varchar,
  	"last_message_at" timestamp(3) with time zone,
  	"last_family_at" timestamp(3) with time zone,
  	"last_staff_at" timestamp(3) with time zone,
  	"last_alert_at" timestamp(3) with time zone,
  	"last_preview" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "conversations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"academy_coaches_id" integer
  );
  
  CREATE TABLE "messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"conversation_id" integer NOT NULL,
  	"direction" "enum_messages_direction" NOT NULL,
  	"channel" "enum_messages_channel" NOT NULL,
  	"author_role" "enum_messages_author_role" NOT NULL,
  	"author_id" integer,
  	"author_name" varchar,
  	"delivery" "enum_messages_delivery",
  	"body" varchar NOT NULL,
  	"twilio_sid" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "conversations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "messages_id" integer;
  ALTER TABLE "conversations_reads" ADD CONSTRAINT "conversations_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversations_reads" ADD CONSTRAINT "conversations_reads_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversations_rels" ADD CONSTRAINT "conversations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conversations_rels" ADD CONSTRAINT "conversations_rels_academy_coaches_fk" FOREIGN KEY ("academy_coaches_id") REFERENCES "public"."academy_coaches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "conversations_reads_order_idx" ON "conversations_reads" USING btree ("_order");
  CREATE INDEX "conversations_reads_parent_id_idx" ON "conversations_reads" USING btree ("_parent_id");
  CREATE INDEX "conversations_reads_user_idx" ON "conversations_reads" USING btree ("user_id");
  CREATE UNIQUE INDEX "conversations_account_idx" ON "conversations" USING btree ("account_id");
  CREATE INDEX "conversations_phone_idx" ON "conversations" USING btree ("phone");
  CREATE INDEX "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");
  CREATE INDEX "conversations_updated_at_idx" ON "conversations" USING btree ("updated_at");
  CREATE INDEX "conversations_created_at_idx" ON "conversations" USING btree ("created_at");
  CREATE INDEX "conversations_rels_order_idx" ON "conversations_rels" USING btree ("order");
  CREATE INDEX "conversations_rels_parent_idx" ON "conversations_rels" USING btree ("parent_id");
  CREATE INDEX "conversations_rels_path_idx" ON "conversations_rels" USING btree ("path");
  CREATE INDEX "conversations_rels_academy_coaches_id_idx" ON "conversations_rels" USING btree ("academy_coaches_id");
  CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");
  CREATE INDEX "messages_author_idx" ON "messages" USING btree ("author_id");
  CREATE INDEX "messages_twilio_sid_idx" ON "messages" USING btree ("twilio_sid");
  CREATE INDEX "messages_updated_at_idx" ON "messages" USING btree ("updated_at");
  CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_conversations_fk" FOREIGN KEY ("conversations_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_messages_fk" FOREIGN KEY ("messages_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_conversations_id_idx" ON "payload_locked_documents_rels" USING btree ("conversations_id");
  CREATE INDEX "payload_locked_documents_rels_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("messages_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "conversations_reads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "conversations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "conversations_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "conversations_reads" CASCADE;
  DROP TABLE "conversations" CASCADE;
  DROP TABLE "conversations_rels" CASCADE;
  DROP TABLE "messages" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_conversations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_messages_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_conversations_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_messages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "conversations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "messages_id";
  DROP TYPE "public"."enum_messages_direction";
  DROP TYPE "public"."enum_messages_channel";
  DROP TYPE "public"."enum_messages_author_role";
  DROP TYPE "public"."enum_messages_delivery";`)
}
