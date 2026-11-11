import type { Payload, PayloadRequest } from 'payload'
import { seedPdr } from '../academy/pdr/seed'
import { importCurriculum } from '../academy/curriculum/load'

/**
 * What a real (launch) database needs to work, with no sample data: Foundation+ content, the curriculum,
 * the Mini Ballers program (as a draft) and Friday Community Night. Runs after all migrations
 * (scripts/seed.ts on each deploy) and only adds what's missing, so it's safe to run again.
 */
export async function ensureLaunchContent(payload: Payload, req?: PayloadRequest) {
  const pdr = await seedPdr(payload, req)
  const standards = await importCurriculum(payload, req)
  await miniBallers(payload, req)
  await communityNight(payload, req)
  return { pdr, standards }
}

/** A draft "Mini Ballers" program for Management to finish (term, session time, coaches) and open. */
async function miniBallers(payload: Payload, req?: PayloadRequest) {
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

/** Friday Community Night (club, free, nothing to book). Mini Ballers is a club program. */
async function communityNight(payload: Payload, req?: PayloadRequest) {
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
