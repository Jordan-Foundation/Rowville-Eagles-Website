import type { Payload, PayloadRequest } from 'payload'
import { AREAS, NAMED_BADGES, PLACEHOLDER, START_LEVELS, STAGES_PER_LEVEL } from './content'

/** The one real stage to start with; everything else is a clearly labelled placeholder. */
export const PASSING_1_1 = {
  skillName: 'Inside-foot pass – preferred foot',
  technique:
    'Stand side-on to the wall with your standing foot planted beside the ball, toes pointing at the target. Turn the kicking foot out so the inside of the foot faces the ball, lock the ankle with toes up, and strike through the middle of the ball. Follow through towards the wall, then cushion the return with the inside of the same foot so the ball is ready for the next pass.',
  challenge: 'Complete 30 ground passes against a wall in 30 seconds, using your preferred foot, from 1 metre away. Every pass must stay on the ground and be controlled before the next one. Film the whole attempt in one clip with the wall and your feet in view.',
  criteria: { target: 30, unit: 'passes', timeLimitSec: 30, distanceM: 1, direction: 'higher' as const },
  coachingPoints: ['Standing foot beside the ball, pointing at the wall', 'Inside of the foot, ankle locked, toes up', 'Strike the middle of the ball so it stays on the ground', 'Follow through towards the target', 'Soft first touch to set up the next pass'],
}

/**
 * Create the starting PDR content if it isn't there yet (safe to run again — existing records,
 * including anything edited in the admin, are left alone).
 */
export async function seedPdr(payload: Payload, req?: PayloadRequest) {
  const q = { overrideAccess: true, req, depth: 0 } as const
  const made = { areas: 0, levels: 0, stages: 0, badges: 0 }
  for (const [i, a] of AREAS.entries()) {
    let area = (await payload.find({ pagination: false, collection: 'pdr-areas', where: { slug: { equals: a.slug } }, limit: 1, ...q })).docs[0]
    if (!area) {
      area = await payload.create({ collection: 'pdr-areas', ...q, data: { name: a.name, slug: a.slug, order: i + 1, hasLeaderboard: a.hasLeaderboard, colour: a.colour } })
      made.areas++
    }
    for (let n = 1; n <= START_LEVELS; n++) {
      let level = (await payload.find({ pagination: false, collection: 'pdr-levels', where: { area: { equals: area.id }, number: { equals: n } }, limit: 1, ...q })).docs[0]
      if (!level) {
        level = await payload.create({ collection: 'pdr-levels', ...q, data: { area: area.id, number: n } })
        made.levels++
        // The level's badge is created by the level hook; give it its starting name
        const named = NAMED_BADGES[`${a.slug}:${n}`]
        if (named) {
          await payload.update({ collection: 'pdr-badges', where: { level: { equals: level.id } }, ...q, data: { name: named, placeholder: false } })
        }
        made.badges++
      }
      for (let s = 1; s <= STAGES_PER_LEVEL; s++) {
        const exists = await payload.count({ collection: 'pdr-stages', where: { level: { equals: level.id }, stageNumber: { equals: s } }, overrideAccess: true, req })
        if (exists.totalDocs) continue
        const real = a.slug === 'passing' && n === 1 && s === 1
        let videos: { tutorialVideo?: number; demoVideo?: number } = {}
        if (real) {
          const tut = await payload.create({ collection: 'pdr-videos', ...q, data: { title: 'Passing 1.1 — tutorial', kind: 'tutorial', notes: 'Upload to Cloudflare Stream, then paste its video ID here.' } })
          const demo = await payload.create({ collection: 'pdr-videos', ...q, data: { title: 'Passing 1.1 — demonstration', kind: 'demo', notes: 'Upload to Cloudflare Stream, then paste its video ID here.' } })
          videos = { tutorialVideo: tut.id, demoVideo: demo.id }
        }
        await payload.create({
          collection: 'pdr-stages',
          ...q,
          data: real
            ? { level: level.id, stageNumber: s, ...PASSING_1_1, coachingPoints: PASSING_1_1.coachingPoints.map((point) => ({ point })), scoring: 'scored', placeholder: false, published: true, ...videos }
            : {
                level: level.id,
                stageNumber: s,
                skillName: `${PLACEHOLDER} — ${a.name} ${n}.${s}`,
                technique: `${PLACEHOLDER}: technique for ${a.name} ${n}.${s}.`,
                challenge: `${PLACEHOLDER}: challenge for ${a.name} ${n}.${s}.`,
                scoring: 'scored',
                placeholder: true,
                published: false,
              },
        })
        made.stages++
      }
    }
  }
  return made
}
