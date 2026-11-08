import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/** Mini Ballers is a Rowville Eagles program (club brand, paid to the club); add the Friday Community Night program. */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.update({ collection: 'programs', where: { type: { equals: 'toddler' } }, data: { brand: 'club', payee: 'club' }, overrideAccess: true, req })
  const { totalDocs } = await payload.count({ collection: 'programs', where: { type: { equals: 'community' } }, overrideAccess: true, req })
  if (totalDocs) return
  await payload.create({
    collection: 'programs',
    overrideAccess: true,
    req,
    data: {
      title: 'Friday Community Night',
      slug: 'friday-community-night',
      type: 'community',
      brand: 'club',
      payee: 'club',
      status: 'open',
      price: 0,
      ageRange: 'All welcome',
      scheduleNote: 'Fridays · 5:30pm · school terms',
      location: 'Parkridge Reserve, 208 Dandelion Drive, Rowville VIC 3178',
      summary: 'Every Friday is for families: a fun-only game, a free dinner, music and dessert. Nothing to book — just rock up.',
      description: {
        root: {
          type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
          children: [
            'Every Friday night is for families: a fun-only game, a free dinner, music and dessert. It’s our way of bringing back the community and culture we feel football has lost.',
            'Dinner is usually pizza. There’s nothing to book — just rock up. We only ask that a parent or carer stays to supervise their child.',
            'Fridays at 5:30pm during Victorian school terms (not school holidays), at Parkridge Reserve, 208 Dandelion Drive, Rowville. All welcome.',
          ].map((text) => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }] })),
        },
      } as never,
    },
  })
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'programs', where: { slug: { equals: 'friday-community-night' } }, overrideAccess: true, req })
}
