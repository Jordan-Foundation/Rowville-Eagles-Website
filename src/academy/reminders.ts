import type { Payload } from 'payload'
import type { AcademyTerm, User } from '@/payload-types'
import { localYmd } from '../lib/time'
import { formatDate } from '../lib/format'
import { emailLayout } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { siteUrl } from '../lib/payments'

export const REMINDER_KINDS = [
  { kind: '14d', days: 14, label: '2 weeks' },
  { kind: '7d', days: 7, label: '1 week' },
  { kind: '3d', days: 3, label: '3 days' },
  { kind: '1d', days: 1, label: '1 day' },
] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]['kind']

/** Whole calendar days (Sydney) from `now` until the deadline — 0 on the deadline day itself. */
export function daysUntil(deadline: Date, now: Date) {
  const a = new Date(`${localYmd(now)}T00:00:00Z`).getTime()
  const b = new Date(`${localYmd(deadline)}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

/**
 * The reminder due today, if any: the most urgent threshold already reached that hasn't been sent.
 * Missed earlier ones are not sent late (e.g. a term created 5 days out gets the 1-week reminder, not three at once).
 * Nothing is sent on or after the deadline day.
 */
export function dueReminder(days: number, alreadySent: ReadonlySet<string>): ReminderKind | null {
  if (days < 1) return null
  const reached = REMINDER_KINDS.filter((r) => days <= r.days)
  const mostUrgent = reached.at(-1)
  if (!mostUrgent || alreadySent.has(mostUrgent.kind)) return null
  return mostUrgent.kind
}

/** Daily job: remind every coach who hasn't submitted availability for a timeframe (term or holidays) collecting it. */
export async function sendAvailabilityReminders(payload: Payload, now = new Date()) {
  const result = { checked: 0, sent: 0 }
  const { docs: terms } = await payload.find({
    collection: 'academy-terms',
    where: { status: { in: ['availability', 'open'] }, availabilityDeadline: { greater_than: now.toISOString() } },
    depth: 0,
    limit: 20,
  })
  if (!terms.length) return result

  // Everyone with the coach role, including coaches who haven't opened the portal yet
  const { docs: coachUsers } = await payload.find({ pagination: false, collection: 'users', where: { roles: { contains: 'coach' } }, depth: 0, limit: 500, overrideAccess: true })
  // Everything needed, fetched once (not per coach × term)
  const termIds = terms.map((t) => t.id)
  const [{ docs: profiles }, { docs: avails }, { docs: logs }] = await Promise.all([
    payload.find({ pagination: false, collection: 'academy-coaches', where: { user: { in: coachUsers.map((u) => u.id) } }, limit: 1000, depth: 0, overrideAccess: true }),
    payload.find({ pagination: false, collection: 'academy-availability', where: { term: { in: termIds }, submittedAt: { exists: true } }, limit: 5000, depth: 0, overrideAccess: true, select: { coach: true, term: true } }),
    payload.find({ pagination: false, collection: 'academy-reminder-log', where: { term: { in: termIds } }, limit: 10000, depth: 0, overrideAccess: true, select: { coach: true, term: true, kind: true } }),
  ])
  const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
  const profileOf = new Map(profiles.map((c) => [idOf(c.user), c]))
  const submitted = new Set(avails.map((a) => `${idOf(a.coach)}:${idOf(a.term)}`))
  const sentKinds = new Map<string, Set<string>>()
  for (const l of logs) { const k = `${idOf(l.coach)}:${idOf(l.term)}`; sentKinds.set(k, (sentKinds.get(k) ?? new Set()).add(l.kind)) }
  for (const user of coachUsers) {
    const coach = profileOf.get(user.id) ?? (await ensureCoachProfile(payload, user))
    for (const term of terms) {
      result.checked++
      if (submitted.has(`${coach.id}:${term.id}`)) continue // stop once submitted
      const kind = dueReminder(daysUntil(new Date(term.availabilityDeadline), now), sentKinds.get(`${coach.id}:${term.id}`) ?? new Set())
      if (!kind) continue
      // Claim first: the unique index makes a second (concurrent) run fail here instead of emailing twice
      try {
        await payload.create({ collection: 'academy-reminder-log', overrideAccess: true, data: { coach: coach.id, term: term.id, kind, to: user.email } })
      } catch {
        continue
      }
      await sendEmail(payload, { to: user.email, subject: subjectFor(term, kind), html: reminderHtml(user, coach.displayName, term, kind), sender: 'academy', userId: user.id })
      result.sent++
    }
  }
  return result
}

async function ensureCoachProfile(payload: Payload, user: User) {
  const { docs } = await payload.find({ pagination: false, collection: 'academy-coaches', where: { user: { equals: user.id } }, limit: 1, depth: 0, overrideAccess: true })
  if (docs[0]) return docs[0]
  return payload.create({
    collection: 'academy-coaches',
    overrideAccess: true,
    data: { user: user.id, displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0], active: false },
  })
}

const due = (term: AcademyTerm) => formatDate(term.availabilityDeadline, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })

function subjectFor(term: AcademyTerm, kind: ReminderKind) {
  const label = REMINDER_KINDS.find((r) => r.kind === kind)!.label
  return kind === '1d' ? `Tomorrow: ${term.name} availability is due` : `Reminder: ${term.name} availability due in ${label}`
}

function reminderHtml(user: User, displayName: string, term: AcademyTerm, kind: ReminderKind) {
  return emailLayout('academy', [
    {
      heading: kind === '1d' ? 'Availability due tomorrow' : `${term.name} availability`,
      intro: `Hi ${user.firstName || displayName} — please set your recurring 1-on-1 and small group availability for ${term.name} (${formatDate(term.startDate)} – ${formatDate(term.endDate)}) so families can start booking with you. It only takes a couple of minutes, and you can add any dates you’ll be away.`,
      rows: [
        ['Due', due(term)],
        [term.category === 'school-holidays' ? 'Holidays' : 'Term', `${formatDate(term.startDate)} – ${formatDate(term.endDate)}`],
      ],
      cta: { label: 'Set my availability', href: `${siteUrl()}/coach/availability/${term.id}` },
      after: 'You’ll stop getting these reminders as soon as you submit.',
    },
  ])
}
