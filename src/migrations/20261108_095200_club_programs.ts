import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/** Mini Ballers is a Rowville Eagles program (club brand, paid to the club); add the Friday Community Night program. */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Content is added after all migrations by ensureLaunchContent (src/lib/launch-content.ts): running
  // today's collection code here would break on a brand-new database. Kept so the migration history matches.
  void payload
  void req
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'programs', where: { slug: { equals: 'friday-community-night' } }, overrideAccess: true, req })
}
