import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Data-only: attach the bundled logo files to sponsors that already existed under a similar name
 * (e.g. created by hand in the admin), as long as they have no uploaded logo or logo path yet.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "sponsors" s SET "logo_url" = v.logo_url, "tile_color" = COALESCE(s."tile_color", v.tile_color)
  FROM (VALUES
    ('%ibuild%', '/sponsors/ibuild-renovations.png', NULL),
    ('%d&r%', '/sponsors/dr-cleaning-services.png', '#0b1045'),
    ('%d & r%', '/sponsors/dr-cleaning-services.png', '#0b1045'),
    ('%coles%', '/sponsors/coles.png', NULL),
    ('%cojo%', '/sponsors/cojo-group.png', NULL),
    ('%cgd%', '/sponsors/cgd-partners.png', NULL),
    ('%old car%', '/sponsors/old-cars-removed.png', '#2595d2'),
    ('%ktd%', '/sponsors/ktd.png', NULL),
    ('%continental%', '/sponsors/continental-steel.png', NULL),
    ('%ic build%', '/sponsors/ic-build.png', NULL)
  ) AS v(pattern, logo_url, tile_color)
  WHERE lower(s."name") LIKE v.pattern AND s."logo_id" IS NULL AND (s."logo_url" IS NULL OR s."logo_url" = '');`)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // Data backfill — nothing to undo structurally.
}
