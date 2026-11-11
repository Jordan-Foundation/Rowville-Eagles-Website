import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/** Loads the Foundation Football Curriculum (7 levels × 6 strands, 239 content descriptors). Existing rows are kept. */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Content is added after all migrations by ensureLaunchContent (src/lib/launch-content.ts): running
  // today's collection code here would break on a brand-new database. Kept so the migration history matches.
  void payload
  void req
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'curriculum-standards', where: { id: { exists: true } }, overrideAccess: true, req })
}
