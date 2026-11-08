import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { importCurriculum } from '../academy/curriculum/load'

/** Loads the Foundation Football Curriculum (7 levels × 6 strands, 239 content descriptors). Existing rows are kept. */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await importCurriculum(payload, req)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'curriculum-standards', where: { id: { exists: true } }, overrideAccess: true, req })
}
