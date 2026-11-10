import type { Payload } from 'payload'
import { managementThisWeek } from './this-week'
import { managementAttention } from './attention'
import { BADGE_UNITS } from '@/components/dashboard/badge'
import { emailLayout, esc } from './email-templates'
import { sendEmail } from './email'
import { siteUrl } from './payments'
import { localYmd } from './time'

const LABELS: Record<string, string> = { bookings: 'Bookings & cancellations', payments: 'Weekly payments', cover: 'Cover', availability: 'Coach availability', terms: 'Academy terms', selections: 'Selections', messages: 'Messages', store: 'Store', foundation: 'Foundation+', consent: 'Consent review', reports: 'Player reports', dates: 'Set dates', promotions: 'Promotions', camps: 'Holiday camps' }

/** Is it Monday in Melbourne? */
export const isMonday = (now = new Date()) => new Date(`${localYmd(now)}T00:00:00Z`).getUTCDay() === 1

/**
 * Monday morning: one email to each committee member and admin with the week ahead and what needs doing.
 * At most once a week per person (seen marker "weekly-summary"); force=true for testing.
 */
export async function sendWeeklySummary(p: Payload, o: { now?: Date; force?: boolean; only?: number } = {}) {
  const now = o.now ?? new Date()
  if (!o.force && !isMonday(now)) return { skipped: 'not Monday' }
  const { docs: people } = await p.find({ pagination: false, collection: 'users', where: { roles: { in: ['admin', 'committee'] }, ...(o.only ? { id: { equals: o.only } } : {}) }, limit: 50, depth: 0, overrideAccess: true })
  let sent = 0
  for (const u of people) {
    const { docs: seen } = await p.find({ pagination: false, collection: 'seen-markers', where: { user: { equals: u.id }, key: { equals: 'weekly-summary' } }, limit: 1, depth: 0, overrideAccess: true })
    if (!o.force && seen[0] && now.getTime() - Date.parse(seen[0].at) < 6 * 86_400_000) continue
    const [week, counts] = await Promise.all([managementThisWeek(p, now), managementAttention(p, u)])
    const todo = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => [LABELS[k] ?? k, `${n} ${BADGE_UNITS[k] ?? 'need attention'}`] as [string, string])
    const html = emailLayout('club', [
      { heading: 'This week', intro: `Hi ${esc(u.firstName || 'there')}, here’s the week ahead for Rowville Eagles and the Foundation Academy.`, rows: week.lines.map((l) => [l.label, l.value] as [string, string]) },
      { heading: todo.length ? 'Needs doing' : 'Nothing waiting', intro: todo.length ? 'From the Management dashboard:' : 'Nothing is waiting on Management right now.', rows: todo, cta: { label: 'Open Management', href: `${siteUrl()}/management` } },
    ])
    await sendEmail(p, { to: u.email, subject: `This week at Rowville Eagles — ${todo.length ? `${todo.length} thing${todo.length === 1 ? '' : 's'} to do` : 'all clear'}`, html, sender: 'club', userId: u.id })
    if (seen[0]) await p.update({ collection: 'seen-markers', id: seen[0].id, data: { at: now.toISOString() }, overrideAccess: true })
    else await p.create({ collection: 'seen-markers', data: { user: u.id, key: 'weekly-summary', at: now.toISOString() }, overrideAccess: true })
    sent++
  }
  return { sent }
}
