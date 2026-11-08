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
  const { docs } = await p.find({ collection: 'player-reports', where: { id: { in: ids } }, limit: ids.length, ...q })
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
  const cycle = await p.findByID({ collection: 'report-cycles', id: cycleId, ...q })
  const { docs } = await p.find({ collection: 'player-reports', where: { cycle: { equals: cycleId }, status: { equals: 'approved' } }, limit: 10000, ...q })
  const items: ReleaseItem[] = []
  const now = new Date().toISOString()
  for (const r of docs) {
    // Fill in the family/player from the registration if they've since made an account
    let account = idOf(r.account)
    let participant = idOf(r.participant)
    let email: string | null = null
    let phone: string | null = null
    const reg = r.registration ? await p.findByID({ collection: 'academy-registrations', id: idOf(r.registration)!, ...q, disableErrors: true }) : null
    if (reg) { account ??= idOf(reg.account); participant ??= idOf(reg.participant); email = reg.contact?.email ?? null; phone = reg.contact?.phone ?? null }
    if (account) {
      const u = await p.findByID({ collection: 'users', id: account, ...q, disableErrors: true })
      if (u) { email = u.email; phone = u.phone || phone }
    }
    await p.update({
      collection: 'player-reports', id: r.id, overrideAccess: true,
      data: { status: 'released', releasedAt: now, account: account ?? undefined, participant: participant ?? undefined, history: log(r, 'Released to family', by) },
    })
    items.push({ id: r.id, firstName: r.playerName.split(' ')[0], accountId: account, email, phone })
  }
  const { families, unreachable } = groupByFamily(items)
  let emailed = 0
  for (const f of families) {
    const user = f.accountId ? await p.findByID({ collection: 'users', id: f.accountId, ...q, disableErrors: true }) : null
    const names = namesList(f.items.map((i) => i.firstName))
    const many = f.items.length > 1
    const link = many || !f.accountId ? `${siteUrl()}/account` : `${siteUrl()}/account/reports/${f.items[0].id}`
    if (f.email) {
      await sendEmail(p, {
        to: f.email,
        subject: `${names}’s ${cycle.name} report${many ? 's are' : ' is'} ready`,
        sender: 'academy',
        userId: user?.id,
        html: emailLayout('academy', [{
          heading: `${cycle.name} report${many ? 's' : ''}`,
          intro: `Hi ${esc(user?.firstName || 'there')} — ${esc(names)}’s ${esc(cycle.name)} report${many ? 's are' : ' is'} ready. ${many ? 'They show' : 'It shows'} how ${many ? 'each player is' : `${esc(f.items[0].firstName)} is`} tracking against the Foundation Football Curriculum for their age, with comments from the coach.`,
          cta: { label: many ? 'See the reports' : 'See the report', href: link },
          after: user ? 'Reports stay on each player’s profile, so you can look back and see progress over time. You can print or save them as a PDF.' : `Log in or create your account with ${esc(f.email)} to see it.`,
        }]),
      })
      emailed++
    }
    await sendSms(p, { to: f.phone, kind: 'service', optedOut: user?.smsOptOut, userId: user?.id, body: `${names}’s ${cycle.name} report${many ? 's are' : ' is'} ready: ${link} – Foundation Academy` })
  }
  return { released: items.length, families: families.length, emailed, unreachable: unreachable.length }
}

export { userName }
