import type { Payload } from 'payload'
import type { Participant, PdrChallenge, User } from '@/payload-types'
import { birthYearOf, groupLabel } from '../../lib/age-groups'
import { sendEmail } from '../../lib/email'
import { emailLayout, esc } from '../../lib/email-templates'
import { siteUrl } from '../../lib/payments'
import { academyBrand } from '../brand'
import { canEnterChallenge, challengeResults, challengeState, monthKey, monthLabel, type ResultRow } from './challenge-rules'
import { displayName } from './leaderboard'
import { foundationSettings } from './load'
import { FoundationError, tellFamily } from './review'
import { createUpload, streamConfigured } from './stream'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
const q = { overrideAccess: true } as const
const LIVE = ['active', 'trialing', 'past_due']
export const challengeUrl = (id: number) => `${siteUrl()}/foundation-plus/challenges/${id}`

/** Live challenges players can see: this month's and past ones (newest first). */
export async function visibleChallenges(p: Payload, now = new Date()) {
  const { docs } = await p.find({ pagination: false, collection: 'pdr-challenges', where: { published: { equals: true }, month: { less_than_equal: monthKey(now) } }, sort: '-month', limit: 24, depth: 0, ...q })
  return docs
}

export async function currentChallenge(p: Payload, now = new Date()) {
  const { docs } = await p.find({ pagination: false, collection: 'pdr-challenges', where: { published: { equals: true }, month: { equals: monthKey(now) } }, limit: 1, depth: 0, ...q })
  return docs[0] ?? null
}

const groupKey = (ch: Pick<PdrChallenge, 'groupBy'>, kid: Pick<Participant, 'dateOfBirth'> | undefined) =>
  ch.groupBy === 'all' ? 'all' : kid ? (birthYearOf(kid.dateOfBirth)?.toString() ?? null) : null
export const groupName = (g: string) => (g === 'all' ? 'Overall' : groupLabel(Number(g)))

async function kidsById(p: Payload, ids: number[]) {
  if (!ids.length) return new Map<number, Participant>()
  const { docs } = await p.find({ pagination: false, collection: 'participants', where: { id: { in: ids } }, limit: ids.length, depth: 0, ...q, select: { firstName: true, lastName: true, dateOfBirth: true, pdr: true, account: true } })
  return new Map(docs.map((d) => [d.id, d as Participant]))
}

/** Every checked entry, as standings per group (live during the month; the saved results once finalised). */
export async function standings(p: Payload, ch: PdrChallenge) {
  const { docs } = await p.find({ pagination: false, collection: 'pdr-submissions', where: { challenge: { equals: ch.id }, status: { equals: 'verified' }, verifiedScore: { exists: true } }, limit: 10000, depth: 0, ...q, select: { player: true, verifiedScore: true, reviewedAt: true } })
  const entries = docs.map((d) => ({ player: rel(d.player), value: d.verifiedScore!, at: d.reviewedAt }))
  const kids = await kidsById(p, [...new Set(entries.map((e) => e.player))])
  const rows = challengeResults(entries, (id) => groupKey(ch, kids.get(id)), ch.direction === 'lower' ? 'lower' : 'higher', ch.winnersPerGroup ?? 1)
  return { rows, kids }
}

export type BoardLine = ResultRow & { name: string; mine: boolean }

/** Public board: opted-out players keep their place but show as "Player hidden". */
export async function challengeBoard(p: Payload, ch: PdrChallenge, mine: Set<number>) {
  const final = Boolean(ch.closedAt)
  let rows: ResultRow[]
  let kids: Map<number, Participant>
  if (final) {
    rows = (ch.results ?? []).map((r) => ({ player: rel(r.player), group: r.group ?? 'all', value: r.value ?? 0, rank: r.rank ?? 0, winner: Boolean(r.winner) }))
    kids = await kidsById(p, rows.map((r) => r.player))
  } else ({ rows, kids } = await standings(p, ch))
  const groups = new Map<string, BoardLine[]>()
  for (const r of rows) {
    const k = kids.get(r.player)
    const name = !k ? 'Player' : k.pdr?.leaderboardOptOut ? 'Player hidden' : displayName(k)
    groups.set(r.group, [...(groups.get(r.group) ?? []), { ...r, name, mine: mine.has(r.player) }])
  }
  return { final, groups: [...groups.entries()].map(([group, lines]) => ({ group, label: groupName(group), lines })) }
}

/** What a family's player has done in this challenge. */
export async function myEntries(p: Payload, ch: PdrChallenge, kidId: number) {
  const { docs } = await p.find({ pagination: false, collection: 'pdr-submissions', where: { challenge: { equals: ch.id }, player: { equals: kidId }, status: { not_equals: 'uploading' } }, sort: '-createdAt', limit: 50, depth: 0, ...q })
  const verified = docs.filter((d) => d.status === 'verified' && d.verifiedScore != null).map((d) => d.verifiedScore!)
  const best = verified.length ? (ch.direction === 'lower' ? Math.min(...verified) : Math.max(...verified)) : null
  return { attempts: docs, pending: docs.filter((d) => d.status === 'pending').length, best }
}

/** Step 1 of an entry: check, then a one-time upload link (step 2 is finishSubmission, shared with stages). */
export async function startChallengeSubmission(p: Payload, o: { kid: Participant; user: User; challengeId: number; claimedScore: number | null; note: string }) {
  if (!streamConfigured()) throw new FoundationError('Video uploads aren’t switched on yet — please try again soon.')
  const ch = await p.findByID({ collection: 'pdr-challenges', id: o.challengeId, depth: 0, ...q, disableErrors: true })
  if (!ch) throw new FoundationError('Challenge not found.')
  const { pending } = await myEntries(p, ch, o.kid.id)
  const recentUpload = await p.count({ collection: 'pdr-submissions', where: { challenge: { equals: ch.id }, player: { equals: o.kid.id }, status: { equals: 'uploading' }, createdAt: { greater_than: new Date(Date.now() - 3_600_000).toISOString() } }, ...q })
  const check = canEnterChallenge({ state: challengeState(ch.month), tier: (o.kid.pdr?.tier ?? 'free') as 'free', pending: pending + recentUpload.totalDocs, published: Boolean(ch.published) })
  if (!check.ok) throw new FoundationError(check.reason)
  if (o.claimedScore == null || o.claimedScore < 0) throw new FoundationError(`Enter your score (${ch.unit}).`)
  const s = await p.findGlobal({ slug: 'pdr-settings', depth: 0, ...q })
  const label = `${o.kid.firstName} ${o.kid.lastName} — ${monthLabel(ch.month)} challenge`
  const upload = await createUpload({ maxDurationSeconds: s.maxClipSeconds ?? 90, name: label })
  const sub = await p.create({
    collection: 'pdr-submissions',
    ...q,
    data: { label, player: o.kid.id, challenge: ch.id, type: 'challenge', status: 'uploading', claimedScore: o.claimedScore, playerNote: o.note || undefined, streamUid: upload.uid, submittedBy: o.user.id },
  })
  return { id: sub.id, uploadURL: upload.uploadURL, maxMB: s.maxFileMB ?? 200, maxSeconds: s.maxClipSeconds ?? 90 }
}

/** A coach checks a challenge entry: count the score, or ask for another go (rules not followed). */
export async function reviewChallengeEntry(p: Payload, coach: User, sub: { id: number; challenge?: unknown; player: unknown; claimedScore?: number | null }, o: { decision: 'verify' | 'reject'; score: number | null; feedback: string }, reviewed: Record<string, unknown>) {
  const [ch, kid, fs] = await Promise.all([
    p.findByID({ collection: 'pdr-challenges', id: rel(sub.challenge), depth: 0, ...q }),
    p.findByID({ collection: 'participants', id: rel(sub.player), depth: 0, ...q }) as Promise<Participant>,
    foundationSettings(p),
  ])
  const href = challengeUrl(ch.id)
  if (o.decision === 'reject') {
    if (!o.feedback.trim()) throw new FoundationError('Tell the player what to fix.')
    await p.update({ collection: 'pdr-submissions', id: sub.id, ...q, data: { ...reviewed, status: 'rejected' } })
    await tellFamily(p, kid, { subject: `${kid.firstName}’s challenge entry — please try again`, heading: 'Nearly there', intro: `A coach watched ${esc(kid.firstName)}’s <strong>${esc(ch.title)}</strong> entry and it didn’t count this time:<br><br><em>${esc(o.feedback)}</em><br><br>${challengeState(ch.month) === 'open' ? 'Send another before the end of the month.' : ''}`, rows: [], href, sms: `${fs.name}: ${kid.firstName}’s challenge entry needs another go —` })
    return { status: 'rejected' as const }
  }
  const score = o.score ?? sub.claimedScore ?? null
  if (score == null || !Number.isFinite(score) || score < 0) throw new FoundationError('Enter the score you counted.')
  const before = await myEntries(p, ch, kid.id)
  await p.update({ collection: 'pdr-submissions', id: sub.id, ...q, data: { ...reviewed, status: 'verified', verifiedScore: score } })
  const better = before.best == null || (ch.direction === 'lower' ? score < before.best : score > before.best)
  const { rows } = await standings(p, ch)
  const me = rows.find((r) => r.player === kid.id)
  const place = me ? `Currently <strong>#${me.rank}</strong> in ${esc(groupName(me.group))}.` : ''
  await tellFamily(p, kid, {
    subject: `${kid.firstName}: ${ch.title} — ${score} ${ch.unit}${better ? ' (new best!)' : ''}`,
    heading: better ? 'Challenge score counted!' : 'Entry checked',
    intro: `A coach checked ${esc(kid.firstName)}’s <strong>${esc(ch.title)}</strong> entry: <strong>${esc(String(score))} ${esc(ch.unit)}</strong>.${better ? '' : ' Their best score stays the same.'} ${place}${o.feedback ? `<br><br><em>${esc(o.feedback)}</em>` : ''}`,
    rows: [],
    href,
    sms: `${fs.name}: ${kid.firstName}’s challenge entry counted — ${score} ${ch.unit}.`,
  })
  return { status: 'verified' as const }
}

/** Families of Premium players (one email per account). */
async function premiumFamilies(p: Payload) {
  const { docs } = await p.find({ collection: 'participants', where: { 'pdr.tier': { equals: 'premium' }, 'pdr.subscriptionStatus': { in: LIVE } }, limit: 5000, depth: 1, ...q, pagination: false })
  const fams = new Map<number, { parent: User; kids: Participant[] }>()
  for (const k of docs) {
    const parent = typeof k.account === 'object' ? (k.account as User | null) : null
    if (!parent) continue
    fams.set(parent.id, { parent, kids: [...(fams.get(parent.id)?.kids ?? []), k as Participant] })
  }
  return [...fams.values()]
}

/** Daily: when a month starts, tell Premium families about its challenge (once). Only while Foundation+ is on. */
export async function announceChallenges(p: Payload, now = new Date()) {
  const fs = await foundationSettings(p)
  const ch = await currentChallenge(p, now)
  if (!fs.enabled || !ch || ch.announcedAt) return { sent: 0 }
  const fams = await premiumFamilies(p)
  for (const f of fams) {
    const names = f.kids.map((k) => k.firstName).join(' & ')
    const html = emailLayout('academy', [{
      heading: `${monthLabel(ch.month)} challenge: ${esc(ch.title)}`,
      intro: `${esc(ch.description)}${ch.prize ? `<br><br><strong>Prize:</strong> ${esc(ch.prize)}` : ''}<br><br>${esc(names)} can send as many attempts as they like before the end of the month — the best score counts.`,
      rows: [],
      cta: { label: 'See the challenge', href: challengeUrl(ch.id) },
    }])
    await sendEmail(p, { to: f.parent.email, subject: `${fs.name}: the ${monthLabel(ch.month)} challenge is live`, html, sender: 'academy', userId: f.parent.id })
  }
  await p.update({ collection: 'pdr-challenges', id: ch.id, ...q, data: { announcedAt: now.toISOString() } })
  return { sent: fams.length }
}

const GRACE_MS = 7 * 86_400_000

/**
 * Daily: once a challenge's month is over and every entry is checked (or a week has passed), save the
 * results, email the winners' families and send the academy the winners list to post prizes.
 */
export async function finaliseChallenges(p: Payload, now = new Date()) {
  const out = { finalised: 0, winners: 0, waiting: 0 }
  const { docs } = await p.find({ pagination: false, collection: 'pdr-challenges', where: { published: { equals: true }, closedAt: { exists: false }, month: { less_than: monthKey(now) } }, limit: 12, depth: 0, ...q })
  const fs = await foundationSettings(p)
  for (const ch of docs) {
    const [y, m] = ch.month.split('-').map(Number)
    const monthEnd = new Date(Date.UTC(y, m, 1)).getTime()
    const { totalDocs: pending } = await p.count({ collection: 'pdr-submissions', where: { challenge: { equals: ch.id }, status: { equals: 'pending' } }, ...q })
    if (pending && now.getTime() < monthEnd + GRACE_MS) {
      out.waiting++
      continue
    }
    const { rows, kids } = await standings(p, ch)
    await p.update({ collection: 'pdr-challenges', id: ch.id, ...q, data: { closedAt: now.toISOString(), results: rows.map((r) => ({ player: r.player, group: r.group, rank: r.rank, value: r.value, winner: r.winner })) } })
    const winners = rows.filter((r) => r.winner)
    for (const w of winners) {
      const kid = kids.get(w.player)
      if (!kid) continue
      await tellFamily(p, kid, {
        subject: `🏆 ${kid.firstName} won the ${monthLabel(ch.month)} challenge!`,
        heading: `${esc(kid.firstName)} won!`,
        intro: `${esc(kid.firstName)} finished <strong>#${w.rank} in ${esc(groupName(w.group))}</strong> in the <strong>${esc(ch.title)}</strong> challenge with <strong>${esc(String(w.value))} ${esc(ch.unit)}</strong>.${ch.prize ? `<br><br><strong>Prize:</strong> ${esc(ch.prize)} — we’ll be in touch to arrange it.` : ''}`,
        rows: [],
        href: challengeUrl(ch.id),
        sms: `${fs.name}: ${kid.firstName} won the ${monthLabel(ch.month)} challenge! 🏆`,
      })
    }
    if (winners.length) {
      const html = emailLayout('academy', [{
        heading: `${esc(monthLabel(ch.month))} challenge winners`,
        intro: `Results for <strong>${esc(ch.title)}</strong> are final and the families have been emailed.${ch.prize ? ` Prize: ${esc(ch.prize)}.` : ''} Tick “Prizes sent” on the challenge once they’re posted.`,
        rows: winners.map((w): [string, string] => {
          const k = kids.get(w.player)
          return [`${groupName(w.group)} · #${w.rank}`, `${k ? `${k.firstName} ${k.lastName}` : 'Player'} — ${w.value} ${ch.unit}`]
        }),
        cta: { label: 'Open the challenge', href: `${siteUrl()}/admin/collections/pdr-challenges/${ch.id}` },
      }])
      await sendEmail(p, { to: academyBrand.email, subject: `${fs.name}: ${monthLabel(ch.month)} challenge winners`, html, sender: 'academy' })
    }
    out.finalised++
    out.winners += winners.length
  }
  return out
}

/** Challenges this player won (for the Trophy Cabinet). */
export async function challengeWins(p: Payload, kidId: number) {
  const { docs } = await p.find({ pagination: false, collection: 'pdr-challenges', where: { 'results.player': { equals: kidId }, closedAt: { exists: true } }, limit: 100, depth: 0, sort: '-month', ...q })
  return docs.flatMap((ch) => {
    const r = (ch.results ?? []).find((x) => rel(x.player) === kidId && x.winner)
    return r ? [{ id: ch.id, title: ch.title, month: ch.month, rank: r.rank ?? 1, group: groupName(r.group ?? 'all'), value: r.value, unit: ch.unit }] : []
  })
}
