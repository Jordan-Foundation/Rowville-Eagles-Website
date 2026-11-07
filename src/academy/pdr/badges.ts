import type { Payload, PayloadRequest } from 'payload'
import type { Media, Participant, PdrBadge, User } from '@/payload-types'
import { sendEmail } from '../../lib/email'
import { emailLayout, esc } from '../../lib/email-templates'
import { siteUrl } from '../../lib/payments'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))

/** Every stage of the level passed? (A level with no stages is never complete.) */
export const levelComplete = (levelStageIds: number[], passed: Set<number>) => levelStageIds.length > 0 && levelStageIds.every((id) => passed.has(id))

/** What families see: placeholder badges get a plain name until they're named in the admin. */
export const badgeName = (b: Pick<PdrBadge, 'name' | 'placeholder'>, area?: string, level?: number | null) =>
  b.placeholder ? `${area ?? ''} Level ${level ?? ''} badge`.replace(/\s+/g, ' ').trim() : b.name

export type CabinetBadge = { id: number; name: string; howToEarn: string; area: { id: number; name: string; colour: string | null; slug: string }; level: number; artwork: string | null; earnedAt: string | null; awardId: number | null; celebrated: boolean }

/** Trophy Cabinet: every level badge by area (earned first within each area). */
export function buildCabinet(o: {
  areas: { id: number; name: string; slug: string; colour?: string | null; order?: number | null }[]
  levels: { id: number; area: number; number: number }[]
  badges: (Pick<PdrBadge, 'id' | 'name' | 'placeholder' | 'howToEarn' | 'type'> & { level: number | null; artworkUrl: string | null })[]
  awards: { id: number; badge: number; awardedAt?: string | null; celebratedAt?: string | null }[]
}) {
  const awardBy = new Map(o.awards.map((a) => [a.badge, a]))
  const levelBy = new Map(o.levels.map((l) => [l.id, l]))
  return [...o.areas]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((area) => ({
      area,
      badges: o.badges
        .filter((b) => b.type === 'level' && b.level && levelBy.get(b.level)?.area === area.id)
        .map((b): CabinetBadge => {
          const lv = levelBy.get(b.level!)!
          const aw = awardBy.get(b.id)
          return {
            id: b.id,
            name: badgeName(b, area.name, lv.number),
            howToEarn: b.howToEarn || `Pass every stage of ${area.name} Level ${lv.number}.`,
            area: { id: area.id, name: area.name, colour: area.colour ?? null, slug: area.slug },
            level: lv.number,
            artwork: b.artworkUrl,
            earnedAt: aw?.awardedAt ?? null,
            awardId: aw?.id ?? null,
            celebrated: Boolean(aw?.celebratedAt),
          }
        })
        .sort((a, b) => a.level - b.level),
    }))
}

/**
 * After a stage is passed: if that completes the level, award the level's badge (once) and email the family.
 * Safe to call repeatedly.
 */
export async function awardLevelBadge(payload: Payload, playerId: number, areaId: number, levelNumber: number, req?: PayloadRequest) {
  const q = { depth: 0, overrideAccess: true, req } as const
  const level = (await payload.find({ collection: 'pdr-levels', where: { area: { equals: areaId }, number: { equals: levelNumber } }, limit: 1, ...q })).docs[0]
  if (!level) return null
  const badge = (await payload.find({ collection: 'pdr-badges', where: { level: { equals: level.id } }, limit: 1, ...q })).docs[0]
  if (!badge) return null
  const [{ docs: stages }, { docs: progress }, { totalDocs: already }] = await Promise.all([
    payload.find({ collection: 'pdr-stages', where: { level: { equals: level.id } }, limit: 100, ...q, select: { stageNumber: true } }),
    payload.find({ collection: 'pdr-progress', where: { player: { equals: playerId }, area: { equals: areaId }, levelNumber: { equals: levelNumber } }, limit: 100, ...q, select: { stage: true } }),
    payload.count({ collection: 'pdr-awards', where: { player: { equals: playerId }, badge: { equals: badge.id } }, overrideAccess: true, req }),
  ])
  if (already || !levelComplete(stages.map((s) => s.id), new Set(progress.map((p) => rel(p.stage))))) return null
  const award = await payload.create({ collection: 'pdr-awards', overrideAccess: true, req, data: { player: playerId, badge: badge.id, awardedAt: new Date().toISOString() } })
  try {
    const kid = (await payload.findByID({ collection: 'participants', id: playerId, ...q })) as Participant
    const area = await payload.findByID({ collection: 'pdr-areas', id: areaId, ...q })
    const parent = kid.account ? ((await payload.findByID({ collection: 'users', id: rel(kid.account), ...q, disableErrors: true })) as User | null) : null
    if (parent) {
      const name = badgeName(badge, area.name, levelNumber)
      const html = emailLayout('academy', [
        {
          heading: 'New badge! 🏅',
          intro: `${esc(kid.firstName)} has passed every stage of <strong>${esc(area.name)} Level ${levelNumber}</strong> and earned the <strong>${esc(name)}</strong> badge${levelNumber < 10 ? ` — Level ${levelNumber + 1} is now open` : ''}.`,
          cta: { label: 'See the Trophy Cabinet', href: `${siteUrl()}/foundation-plus/${kid.id}/trophies` },
        },
      ])
      await sendEmail(payload, { to: parent.email, subject: `${kid.firstName} earned a new badge: ${name} 🏅`, html, sender: 'academy', userId: parent.id })
    }
  } catch (e) {
    payload.logger.error({ err: e, msg: `Badge email for player ${playerId} failed` })
  }
  return award
}

export const artworkUrl = (a: unknown) => (a && typeof a === 'object' ? ((a as Media).url ?? null) : null)
