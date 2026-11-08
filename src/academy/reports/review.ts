import type { Payload } from 'payload'
import type { PlayerReport, User } from '@/payload-types'
import { esc, emailLayout } from '../../lib/email-templates'
import { sendEmail } from '../../lib/email'
import { sendSms } from '../../lib/sms'
import { siteUrl } from '../../lib/payments'
import { isLevel } from '../curriculum/levels'
import { canApprove, canReturn, cleanEntry, groupByFamily, managementCanEdit, namesList, type ReleaseItem, type ReportInput } from './rules'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (v: unknown): number | null => (v && typeof v === 'object' ? (v as { id: number }).id : typeof v === 'number' ? v : null)
const log = (r: PlayerReport, action: string, by: number, note?: string) => [...(r.history ?? []), { action, by, at: new Date().toISOString(), note: note || undefined }]
const userName = (u: Pick<User, 'firstName' | 'lastName' | 'email'> | null) => (u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : '')

/** Management correction (ratings, comments, level) — logged; not allowed once released. */
export async function managementEdit(p: Payload, id: number, input: ReportInput & { level?: string }, by: number) {
  const r = await p.findByID({ collection: 'player-reports', id, ...q })
  if (!managementCanEdit(r.status)) throw new Error('This report has been released to the family and can’t be changed here.')
  const level = input.level && isLevel(input.level) ? input.level : r.level
  const note = level !== r.level ? `Level changed to ${level}` : undefined
  await p.update({ collection: 'player-reports', id, overrideAccess: true, data: { ...cleanEntry(input), level, history: log(r, 'Edited by Management', by, note) } })
}

/** Send back to the coach with a note (they're emailed); the report unlocks for them. */
export async function returnReport(p: Payload, id: number, note: string, by: number) {
  const r = await p.findByID({ collection: 'player-reports', id, ...q })
  if (!canReturn(r.status)) throw new Error('Only submitted or approved reports can be returned.')
  const clean = note.trim().slice(0, 1000)
  if (clean.length < 5) throw new Error('Tell the coach what to change.')
  await p.update({ collection: 'player-reports', id, overrideAccess: true, data: { status: 'returned', returnNote: clean, approvedAt: null, history: log(r, 'Returned to coach', by, clean) } })
  const coach = r.coach ? await p.findByID({ collection: 'users', id: idOf(r.coach)!, ...q, disableErrors: true }) : null
  if (coach?.email) {
    await sendEmail(p, {
      to: coach.email,
      subject: `Please update ${r.playerName}’s report`,
      sender: 'academy',
      userId: coach.id,
      html: emailLayout('academy', [{
        heading: 'A report needs a change',
        intro: `Hi ${esc(coach.firstName || 'coach')} — Management has sent <strong>${esc(r.playerName)}</strong>’s report back to you:<br><br><em>${esc(clean)}</em>`,
        cta: { label: 'Update the report', href: `${siteUrl()}/coach/reports/${r.id}` },
        after: 'Once you’ve made the change, submit it again.',
      }]),
    })
  }
}

/** Approve submitted reports (one or many). Returns how many were approved. */
export async function approveReports(p: Payload, ids: number[], by: number) {
  if (!ids.length) return 0
  const { docs } = await p.find({ pagination: false, collection: 'player-reports', where: { id: { in: ids } }, limit: ids.length, ...q })
  let n = 0
  for (const r of docs) {
    if (!canApprove(r.status)) continue
    await p.update({ collection: 'player-reports', id: r.id, overrideAccess: true, data: { status: 'approved', approvedAt: new Date().toISOString(), returnNote: null, history: log(r, 'Approved', by) } })
    n++
  }
  return n
}

/**
 * Release every approved report in a cycle: they appear on the player profiles, and each family gets ONE email and
 * ONE text listing all their children's reports. Returns counts (and anyone who couldn't be contacted).
 */
export async function releaseCycle(p: Payload, cycleId: number, by: number) {
  const { docs } = await p.find({ collection: 'player-reports', where: { cycle: { equals: cycleId }, status: { equals: 'approved' } }, limit: 10000, pagination: false, ...q })
  // Look up registrations once (fills in the family/player if they've since made an account)
  const regIds = [...new Set(docs.map((r) => idOf(r.registration)).filter((x): x is number => !!x))]
  const { docs: regs } = regIds.length ? await p.find({ collection: 'academy-registrations', where: { id: { in: regIds } }, limit: regIds.length, pagination: false, ...q }) : { docs: [] }
  const regById = new Map(regs.map((r) => [r.id, r]))
  const now = new Date().toISOString()
  for (const r of docs) {
    const reg = regById.get(idOf(r.registration) ?? -1)
    const account = idOf(r.account) ?? (reg ? idOf(reg.account) : null)
    const participant = idOf(r.participant) ?? (reg ? idOf(reg.participant) : null)
    await p.update({
      collection: 'player-reports', id: r.id, overrideAccess: true, depth: 0,
      data: { status: 'released', releasedAt: now, account: account ?? undefined, participant: participant ?? undefined, history: log(r, 'Released to family', by) },
    })
  }
  const n = await notifyReleased(p, cycleId)
  return { released: docs.length, ...n }
}

/**
 * Tell families about released reports they haven't been told about yet — one email + text per family.
 * Each report is marked as notified once its family's message has gone, so an interrupted run carries on
 * (from "Release" again or the daily job) without messaging anyone twice.
 */
export async function notifyReleased(p: Payload, cycleId: number | null, deadline = Date.now() + 240_000) {
  const { docs } = await p.find({
    collection: 'player-reports',
    where: { status: { equals: 'released' }, familyNotifiedAt: { exists: false }, ...(cycleId ? { cycle: { equals: cycleId } } : {}) },
    limit: 5000, pagination: false, ...q,
  })
  if (!docs.length) return { families: 0, emailed: 0, unreachable: 0, remaining: 0 }
  const regIds = [...new Set(docs.map((r) => idOf(r.registration)).filter((x): x is number => !!x))]
  const userIds = [...new Set(docs.map((r) => idOf(r.account)).filter((x): x is number => !!x))]
  const cycleIds = [...new Set(docs.map((r) => idOf(r.cycle)).filter((x): x is number => !!x))]
  const [{ docs: regs }, { docs: users }, { docs: cycles }] = await Promise.all([
    regIds.length ? p.find({ collection: 'academy-registrations', where: { id: { in: regIds } }, limit: regIds.length, pagination: false, ...q }) : Promise.resolve({ docs: [] as never[] }),
    userIds.length ? p.find({ collection: 'users', where: { id: { in: userIds } }, limit: userIds.length, pagination: false, ...q }) : Promise.resolve({ docs: [] as never[] }),
    p.find({ collection: 'report-cycles', where: { id: { in: cycleIds } }, limit: cycleIds.length, pagination: false, ...q }),
  ])
  const regById = new Map(regs.map((r) => [r.id, r]))
  const userById = new Map(users.map((u) => [u.id, u]))
  const cycleName = new Map(cycles.map((c) => [c.id, c.name]))
  const items: (ReleaseItem & { cycle: number })[] = docs.map((r) => {
    const reg = regById.get(idOf(r.registration) ?? -1)
    const account = idOf(r.account)
    const u = account ? userById.get(account) : undefined
    return { id: r.id, cycle: idOf(r.cycle)!, firstName: r.playerName.split(' ')[0], accountId: account, email: u?.email ?? reg?.contact?.email ?? null, phone: u?.phone || reg?.contact?.phone || null }
  })
  const { families, unreachable } = groupByFamily(items)
  let emailed = 0
  let done = 0
  const markNotified = (ids: number[]) => p.update({ collection: 'player-reports', where: { id: { in: ids } }, data: { familyNotifiedAt: new Date().toISOString() }, overrideAccess: true, depth: 0 })
  // Players with no contact at all are marked too — they'll see it when they log in
  if (unreachable.length) await markNotified(unreachable.map((u) => u.id))
  for (const f of families) {
    if (Date.now() > deadline) break
    const user = f.accountId ? userById.get(f.accountId) ?? null : null
    const names = namesList(f.items.map((i) => i.firstName))
    const many = f.items.length > 1
    const round = cycleName.get((f.items[0] as ReleaseItem & { cycle: number }).cycle) ?? 'player'
    const link = many || !f.accountId ? `${siteUrl()}/account` : `${siteUrl()}/account/reports/${f.items[0].id}`
    if (f.email) {
      const ok = await sendEmail(p, {
        to: f.email,
        subject: `${names}’s ${round} report${many ? 's are' : ' is'} ready`,
        sender: 'academy',
        userId: user?.id,
        html: emailLayout('academy', [{
          heading: `${round} report${many ? 's' : ''}`,
          intro: `Hi ${esc(user?.firstName || 'there')} — ${esc(names)}’s ${esc(round)} report${many ? 's are' : ' is'} ready. ${many ? 'They show' : 'It shows'} how ${many ? 'each player is' : `${esc(f.items[0].firstName)} is`} tracking against the Foundation Football Curriculum for their age, with comments from the coach.`,
          cta: { label: many ? 'See the reports' : 'See the report', href: link },
          after: user ? 'Reports stay on each player’s profile, so you can look back and see progress over time. You can print or save them as a PDF.' : `Log in or create your account with ${esc(f.email)} to see it.`,
        }]),
      })
      if (ok) emailed++
    }
    await sendSms(p, { to: f.phone, kind: 'service', optedOut: user?.smsOptOut, userId: user?.id, body: `${names}’s ${round} report${many ? 's are' : ' is'} ready: ${link} – Foundation Academy` })
    await markNotified(f.items.map((i) => i.id))
    done++
  }
  return { families: families.length, emailed, unreachable: unreachable.length, remaining: families.length - done }
}

/** Daily job: finish telling families about released reports (if a release ran out of time). */
export async function notifyReleasedJob(p: Payload) {
  return notifyReleased(p, null, Date.now() + 90_000)
}

export { userName }
