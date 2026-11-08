import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/** A draft "Mini Ballers" program for Management to finish (term, session time, coaches) and open. */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const { totalDocs } = await payload.count({ collection: 'programs', where: { type: { equals: 'toddler' } }, overrideAccess: true, req })
  if (totalDocs) return
  await payload.create({
    collection: 'programs',
    overrideAccess: true,
    req,
    data: {
      title: 'Mini Ballers',
      slug: 'mini-ballers',
      type: 'toddler',
      brand: 'academy',
      status: 'draft',
      price: 0,
      pricePerSession: 20,
      trialPlacesPerNight: 2,
      trialPrice: 0,
      ageRange: 'Ages 2–5',
      scheduleNote: 'Once a week · 30 minutes',
      summary: 'Fun first football for 2–5 year olds: 30-minute small-group sessions that introduce the ball through games. Parents stay to supervise.',
    },
  })
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'programs', where: { slug: { equals: 'mini-ballers' }, status: { equals: 'draft' } }, overrideAccess: true, req })
}
