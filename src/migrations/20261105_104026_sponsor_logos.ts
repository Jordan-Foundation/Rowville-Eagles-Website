import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sponsors" ADD COLUMN "logo_url" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "tile_color" varchar;
  ALTER TABLE "sponsors" ADD COLUMN "blurb" varchar;

  -- Data: replace the four sample sponsors with the club's real sponsors (only adds ones not already present)
  DELETE FROM "sponsors" WHERE "name" IN ('Your Sponsor', 'Local Partner', 'Community Supporter', 'Major Partner') AND "logo_id" IS NULL;
  INSERT INTO "sponsors" ("name", "tier", "logo_url", "tile_color", "order")
  SELECT v.name, 'community', v.logo_url, v.tile_color, v.ord
  FROM (VALUES
    ('iBuild Renovations', '/sponsors/ibuild-renovations.png', NULL, 0),
    ('D&R Cleaning Services', '/sponsors/dr-cleaning-services.png', '#0b1045', 1),
    ('Coles', '/sponsors/coles.png', NULL, 2),
    ('COJO Group', '/sponsors/cojo-group.png', NULL, 3),
    ('CGD Partners', '/sponsors/cgd-partners.png', NULL, 4),
    ('Old Cars Removed', '/sponsors/old-cars-removed.png', '#2595d2', 5),
    ('KTD', '/sponsors/ktd.png', NULL, 6),
    ('Continental Steel', '/sponsors/continental-steel.png', NULL, 7),
    ('IC Build', '/sponsors/ic-build.png', NULL, 8)
  ) AS v(name, logo_url, tile_color, ord)
  WHERE NOT EXISTS (SELECT 1 FROM "sponsors" s WHERE lower(s."name") = lower(v.name));`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sponsors" DROP COLUMN "logo_url";
  ALTER TABLE "sponsors" DROP COLUMN "tile_color";
  ALTER TABLE "sponsors" DROP COLUMN "blurb";`)
}
