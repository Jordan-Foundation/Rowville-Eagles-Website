import type { Payload } from 'payload'
import { emailLayout } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { siteUrl } from '../lib/payments'
import { formatDate } from '../lib/format'
import { dueToOpen } from './release'

const q = { overrideAccess: true, depth: 0 } as const

/** Open every draft Academy term program whose opening time has come, and tell Management. */
export async function openDuePrograms(p: Payload, now = new Date()) {
  const { docs } = await p.find({ pagination: false, collection: 'programs', where: { type: { in: ['academy-term', 'toddler', 'academy-year'] }, status: { equals: 'draft' }, opensAt: { less_than_equal: now.toISOString() } }, limit: 50, ...q })
  const opened = docs.filter((x) => dueToOpen(x, now))
  for (const x of opened) await p.update({ collection: 'programs', id: x.id, data: { status: 'open' }, ...q })
  if (opened.length) {
    const { docs: people } = await p.find({ pagination: false, collection: 'users', where: { roles: { in: ['admin', 'committee'] } }, limit: 50, ...q })
    const html = emailLayout('academy', [{
      heading: opened.length === 1 ? `${opened[0].title} is open` : `${opened.length} Academy programs are open`,
      intro: `Registrations opened automatically: ${opened.map((x) => `${x.title}${x.startDate ? ` (starts ${formatDate(x.startDate, { day: 'numeric', month: 'short' })})` : ''}`).join(', ')}.`,
      cta: { label: 'Programs Overview', href: `${siteUrl()}/management/programs` },
    }])
    for (const u of people) await sendEmail(p, { to: u.email, subject: `Registrations open: ${opened.map((x) => x.title).join(', ')}`, html, sender: 'academy', userId: u.id })
  }
  return { opened: opened.length }
}

let last = 0
/**
 * Also checked when people view programs (the scheduled job only runs daily), at most every 5 minutes:
 * open what's due now; send due announcements after the page has gone out.
 */
export async function nudgeOpenPrograms(p: Payload) {
  if (Date.now() - last < 5 * 60_000) return
  last = Date.now()
  await openDuePrograms(p).catch((e) => p.logger.error({ err: e, msg: 'Opening Academy programs failed' }))
  try {
    const { after } = await import('next/server')
    after(async () => { await (await import('./announcements')).runAnnouncements(p).catch((e) => p.logger.error({ err: e, msg: 'Announcements failed' })) })
  } catch { /* not in a request */ }
}
