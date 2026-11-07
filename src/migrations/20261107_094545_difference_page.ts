import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "difference_page_curriculum_strands" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"line" varchar
  );
  
  CREATE TABLE "difference_page_sessions_stages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"line" varchar
  );
  
  CREATE TABLE "difference_page_year_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"months" varchar,
  	"title" varchar,
  	"detail" varchar
  );
  
  CREATE TABLE "difference_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_title" varchar DEFAULT 'What makes us different',
  	"hero_intro" varchar DEFAULT 'Paid, professionally trained coaches, a real football curriculum and a year-round program — built so every player knows what they’re working on and what comes next.',
  	"hero_image_id" integer,
  	"coaches_nav" varchar DEFAULT 'Coaches',
  	"coaches_headline" varchar DEFAULT 'Paid, professionally developed coaches',
  	"coaches_body" varchar DEFAULT 'Every session is led by a paid coach who has completed our professional development program. That means qualified, consistent and accountable coaching for your child — every week, all year.',
  	"coaches_more" varchar DEFAULT 'Before they coach a single session, our coaches complete a 10-week professional development program that teaches them to deliver sessions “the Foundation way”. They learn our lesson sequence, how children learn, how to communicate with and motivate young players, how to break down technique, and how to use constraints to develop it. Just as importantly, they learn who we are — our culture and our values — so every coach is aligned from day one.',
  	"coaches_image_id" integer,
  	"curriculum_nav" varchar DEFAULT 'Curriculum',
  	"curriculum_headline" varchar DEFAULT 'A real football curriculum',
  	"curriculum_body" varchar DEFAULT 'Modelled on the Victorian school curriculum, our football curriculum runs from Foundation level (up to age 7) through every age to 13. Each player follows a clear progression, so players and parents always know what they’re working on and what comes next.',
  	"curriculum_more" varchar DEFAULT 'Each level sets out achievement standards across six strands. Coaches plan sessions against those standards, track progress through the year, and report on it — the same way a good school does.',
  	"curriculum_image_id" integer,
  	"sessions_nav" varchar DEFAULT 'Sessions',
  	"sessions_headline" varchar DEFAULT 'Every session, five stages',
  	"sessions_body" varchar DEFAULT 'Every session is built around one learning objective and follows the same five stages, so players get the most out of every minute.',
  	"sessions_more" varchar DEFAULT 'Sessions run for 75 minutes for U5–U11 and 90 minutes for U12 and up.',
  	"sessions_lengths" varchar DEFAULT '75 minutes for U5–U11 · 90 minutes for U12+',
  	"reports_nav" varchar DEFAULT 'Reports',
  	"reports_headline" varchar DEFAULT 'Player reports you can follow',
  	"reports_body" varchar DEFAULT 'Once or twice a year, coaches assess each player against the curriculum’s achievement standards in every strand. Reports live on your child’s profile in the player portal, so you can see their progress over time.',
  	"reports_more" varchar DEFAULT 'Each strand is assessed on a five-point scale — Well below, Below, At, Above or Well above the standard for their level — with a short comment from the coach on what’s going well and what to work on next.',
  	"reports_image_id" integer,
  	"year_nav" varchar DEFAULT 'Year-round',
  	"year_headline" varchar DEFAULT 'A year-round program, four terms',
  	"year_body" varchar DEFAULT 'We run all four Victorian school terms, so development doesn’t stop when the season does — around 80–100 training sessions a year.',
  	"year_more" varchar DEFAULT 'In the off-season (Terms 1 and 4) players train twice a week with the Rowville Foundation Academy. In season (Terms 2 and 3) they train twice a week with their team and play weekly games, with an optional third academy session focused on their personal targets.',
  	"year_sessions_per_year" varchar DEFAULT '80–100 sessions a year',
  	"pathways_nav" varchar DEFAULT 'Two pathways',
  	"pathways_headline" varchar DEFAULT 'One club, two pathways',
  	"pathways_body" varchar DEFAULT 'Players can be Rowville players in our club teams, Rowville Foundation Academy players, or both. Players from other clubs are welcome in the academy and stay connected to Rowville — and you can join part-way through the season through the academy, even when teams are full.',
  	"pathways_more" varchar DEFAULT 'The academy and the club share the same curriculum and coaching approach, so moving between them — or doing both — is seamless.',
  	"pathways_image_id" integer,
  	"community_nav" varchar DEFAULT 'Community night',
  	"community_headline" varchar DEFAULT 'Free Friday Community Night',
  	"community_body" varchar DEFAULT 'Every Friday night is for families: a fun-only game, a free dinner, music and dessert. It’s our way of bringing back the community and culture we feel football has lost.',
  	"community_more" varchar DEFAULT 'Dinner is usually pizza. There’s nothing to book — just rock up. We only ask that a parent or carer stays to supervise their child.',
  	"community_when" varchar DEFAULT 'Fridays at 5:30pm during Victorian school terms (not school holidays)',
  	"community_where" varchar DEFAULT 'Parkridge Reserve, 208 Dandelion Drive, Rowville VIC 3178',
  	"community_welcome" varchar DEFAULT 'All welcome',
  	"fplus_nav" varchar DEFAULT 'Foundation+',
  	"fplus_headline" varchar DEFAULT 'Foundation+: training that keeps going at home',
  	"fplus_body" varchar DEFAULT 'Our online training platform: levelled drills in six areas, video challenges checked by Academy coaches, badges and leaderboards.',
  	"cta_headline" varchar DEFAULT 'Come and see the difference',
  	"cta_body" varchar DEFAULT 'Book into the academy, register interest for a team, or start a free month of Foundation+.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "difference_page_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  ALTER TABLE "difference_page_curriculum_strands" ADD CONSTRAINT "difference_page_curriculum_strands_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."difference_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "difference_page_sessions_stages" ADD CONSTRAINT "difference_page_sessions_stages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."difference_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "difference_page_year_terms" ADD CONSTRAINT "difference_page_year_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."difference_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "difference_page" ADD CONSTRAINT "difference_page_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "difference_page" ADD CONSTRAINT "difference_page_coaches_image_id_media_id_fk" FOREIGN KEY ("coaches_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "difference_page" ADD CONSTRAINT "difference_page_curriculum_image_id_media_id_fk" FOREIGN KEY ("curriculum_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "difference_page" ADD CONSTRAINT "difference_page_reports_image_id_media_id_fk" FOREIGN KEY ("reports_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "difference_page" ADD CONSTRAINT "difference_page_pathways_image_id_media_id_fk" FOREIGN KEY ("pathways_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "difference_page_rels" ADD CONSTRAINT "difference_page_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."difference_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "difference_page_rels" ADD CONSTRAINT "difference_page_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "difference_page_curriculum_strands_order_idx" ON "difference_page_curriculum_strands" USING btree ("_order");
  CREATE INDEX "difference_page_curriculum_strands_parent_id_idx" ON "difference_page_curriculum_strands" USING btree ("_parent_id");
  CREATE INDEX "difference_page_sessions_stages_order_idx" ON "difference_page_sessions_stages" USING btree ("_order");
  CREATE INDEX "difference_page_sessions_stages_parent_id_idx" ON "difference_page_sessions_stages" USING btree ("_parent_id");
  CREATE INDEX "difference_page_year_terms_order_idx" ON "difference_page_year_terms" USING btree ("_order");
  CREATE INDEX "difference_page_year_terms_parent_id_idx" ON "difference_page_year_terms" USING btree ("_parent_id");
  CREATE INDEX "difference_page_hero_hero_image_idx" ON "difference_page" USING btree ("hero_image_id");
  CREATE INDEX "difference_page_coaches_coaches_image_idx" ON "difference_page" USING btree ("coaches_image_id");
  CREATE INDEX "difference_page_curriculum_curriculum_image_idx" ON "difference_page" USING btree ("curriculum_image_id");
  CREATE INDEX "difference_page_reports_reports_image_idx" ON "difference_page" USING btree ("reports_image_id");
  CREATE INDEX "difference_page_pathways_pathways_image_idx" ON "difference_page" USING btree ("pathways_image_id");
  CREATE INDEX "difference_page_rels_order_idx" ON "difference_page_rels" USING btree ("order");
  CREATE INDEX "difference_page_rels_parent_idx" ON "difference_page_rels" USING btree ("parent_id");
  CREATE INDEX "difference_page_rels_path_idx" ON "difference_page_rels" USING btree ("path");
  CREATE INDEX "difference_page_rels_media_id_idx" ON "difference_page_rels" USING btree ("media_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "difference_page_curriculum_strands" CASCADE;
  DROP TABLE "difference_page_sessions_stages" CASCADE;
  DROP TABLE "difference_page_year_terms" CASCADE;
  DROP TABLE "difference_page" CASCADE;
  DROP TABLE "difference_page_rels" CASCADE;`)
}
