import type { Payload } from 'payload'
import { notFound, redirect } from 'next/navigation'
import type { Participant, User } from '@/payload-types'
import { hasRole } from '../../access'
import { currentUser } from '../../lib/auth'
import { payload as getPayload } from '../../lib/payload'
import { buildReport, type Tier } from './report'

export async function foundationSettings(payload: Payload) {
  const s = await payload.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true }).catch(() => null)
  return { enabled: Boolean(s?.enabled), name: s?.programName?.trim() || 'Foundation+', tagline: s?.tagline ?? '' }
}

export const isStaffOrCoach = (u: User | null | undefined) => Boolean(u && hasRole(u, 'admin', 'committee', 'coach'))

/** Foundation+ pages: hidden from families while switched off; staff and coaches can preview. */
export async function foundationGate() {
  const p = await getPayload()
  const [settings, user] = await Promise.all([foundationSettings(p), currentUser()])
  if (!settings.enabled && !isStaffOrCoach(user)) notFound()
  return { p, settings, user, preview: !settings.enabled }
}

/** The player whose report this is: their parent's account, or staff/coaches. */
export async function reportPlayer(p: Payload, user: User | null, id: string, next: string) {
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  const kid = (await p.findByID({ collection: 'participants', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })) as Participant | null
  if (!kid) notFound()
  const owner = (typeof kid.account === 'object' ? kid.account?.id : kid.account) === user.id
  if (!owner && !isStaffOrCoach(user)) notFound()
  return kid
}

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))

export async function loadReport(p: Payload, kid: Participant) {
  const q = { depth: 0, overrideAccess: true, limit: 2000 } as const
  const [areas, levels, stages, progress] = await Promise.all([
    p.find({ collection: 'pdr-areas', sort: 'order', ...q }),
    p.find({ collection: 'pdr-levels', ...q }),
    p.find({ collection: 'pdr-stages', sort: 'sortKey', ...q }),
    p.find({ collection: 'pdr-progress', where: { player: { equals: kid.id } }, ...q }),
  ])
  const tier = (kid.pdr?.tier ?? 'free') as Tier
  const report = buildReport({
    areas: areas.docs.map((a) => ({ id: a.id, name: a.name, slug: a.slug, order: a.order, colour: a.colour, hasLeaderboard: a.hasLeaderboard })),
    levels: levels.docs.map((l) => ({ id: l.id, area: rel(l.area), number: l.number, title: l.title })),
    stages: stages.docs.map((s) => ({ id: s.id, area: rel(s.area), levelNumber: s.levelNumber ?? 0, stageNumber: s.stageNumber, code: s.code ?? '', skillName: s.skillName, published: s.published, placeholder: s.placeholder })),
    progress: progress.docs.map((x) => ({ stage: rel(x.stage), method: x.method, score: x.score, promotedScore: x.promotedScore, passedAt: x.passedAt })),
    tier,
  })
  return { report, tier, stageDocs: stages.docs }
}

export const streamEmbed = (uid: string | null | undefined) => {
  const code = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
  return uid && code ? `https://customer-${code}.cloudflarestream.com/${uid}/iframe` : null
}
