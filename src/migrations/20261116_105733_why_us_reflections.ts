import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "difference_page_reflections_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"line" varchar
  );
  
  ALTER TABLE "difference_page" ADD COLUMN "reflections_nav" varchar DEFAULT 'Reflections';
  ALTER TABLE "difference_page" ADD COLUMN "reflections_headline" varchar DEFAULT 'Match Reflections after every game';
  ALTER TABLE "difference_page" ADD COLUMN "reflections_body" varchar DEFAULT 'Win or lose, after every game our players take two minutes to reflect: three things they did well, three things to work on, and one focus for the next game. It builds the habit every good player has — honest, positive self-review — and their coach reads and replies to every one.';
  ALTER TABLE "difference_page" ADD COLUMN "reflections_more" varchar DEFAULT 'Reflections open three hours after kick-off, from the family account or a private link the player can use on their own device. Each moment is tagged to a skill area, so over a season players (and parents) can see their strengths grow and where to keep working. Before the next game, the player’s focus is right there on their profile. Coaches read every reflection, tap Seen and leave a note, and each week they get a summary of the team’s themes to plan training around. Reflections are private to the family and the club’s coaches.';
  ALTER TABLE "difference_page" ADD COLUMN "reflections_image_id" integer;
  ALTER TABLE "difference_page_reflections_steps" ADD CONSTRAINT "difference_page_reflections_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."difference_page"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "difference_page_reflections_steps_order_idx" ON "difference_page_reflections_steps" USING btree ("_order");
  CREATE INDEX "difference_page_reflections_steps_parent_id_idx" ON "difference_page_reflections_steps" USING btree ("_parent_id");
  ALTER TABLE "difference_page" ADD CONSTRAINT "difference_page_reflections_image_id_media_id_fk" FOREIGN KEY ("reflections_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "difference_page_reflections_reflections_image_idx" ON "difference_page" USING btree ("reflections_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "difference_page_reflections_steps" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "difference_page_reflections_steps" CASCADE;
  ALTER TABLE "difference_page" DROP CONSTRAINT IF EXISTS "difference_page_reflections_image_id_media_id_fk";
  
  DROP INDEX IF EXISTS "difference_page_reflections_reflections_image_idx";
  ALTER TABLE "difference_page" DROP COLUMN IF EXISTS "reflections_nav";
  ALTER TABLE "difference_page" DROP COLUMN IF EXISTS "reflections_headline";
  ALTER TABLE "difference_page" DROP COLUMN IF EXISTS "reflections_body";
  ALTER TABLE "difference_page" DROP COLUMN IF EXISTS "reflections_more";
  ALTER TABLE "difference_page" DROP COLUMN IF EXISTS "reflections_image_id";`)
}
