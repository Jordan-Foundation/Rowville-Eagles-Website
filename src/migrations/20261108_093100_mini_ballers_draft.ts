import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/** A draft "Mini Ballers" program for Management to finish (term, session time, coaches) and open. */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Content is added after all migrations by ensureLaunchContent (src/lib/launch-content.ts): running
  // today's collection code here would break on a brand-new database. Kept so the migration history matches.
  void payload
  void req
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'programs', where: { slug: { equals: 'mini-ballers' }, status: { equals: 'draft' } }, overrideAccess: true, req })
}
