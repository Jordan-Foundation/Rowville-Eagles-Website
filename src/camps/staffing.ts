import type { Payload } from 'payload'
import type { AcademyCoach, CampCoach, Program, User } from '../payload-types'
import { campDayLabel, campDayList, campHoursLabel } from '../lib/camps'
import { STAFFING_DEFAULTS, campDayRanges, coachesNeeded, escalationDue, overlaps, reminderDue, staffingGap } from '../lib/camp-staffing'
import { coachClashes, type Busy } from '../academy/terms/clashes'
import { slotLabel, slotSessions } from '../academy/terms/slots'
import { emailLayout } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { sendSms } from '../lib/sms'
import { siteUrl } from '../lib/payments'
import { hashShareToken, newShareToken } from '../academy/share-rules'
import { loadCampGroups } from './groups'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))
export class StaffingError extends Error {}

export async function staffingSettings(p: Payload) {
  const s = (await p.findGlobal({ slug: 'academy-settings', ...q }).catch(() => null))?.camps
  return {
    coachesPerGroup: s?.coachesPerGroup ?? STAFFING_DEFAULTS.coachesPerGroup,
    extraCoaches: s?.extraCoaches ?? STAFFING_DEFAULTS.extraCoaches,
    confirmReminderHours: s?.confirmReminderHours ?? STAFFING_DEFAULTS.confirmReminderHours,
    escalateHours: s?.escalateHours ?? STAFFING_DEFAULTS.escalateHours,
  }
}

const respondUrl = (token: string) => `${siteUrl()}/camp-coach/${token}`
const campDates = (program: Program) => {
  const days = campDayList(program)
  return days.length ? `${campDayLabel(days[0].date)} – ${campDayLabel(days.at(-1)!.date)} (${days.length} day${days.length === 1 ? '' : 's'}, ${campHoursLabel(days[0])})` : 'dates to be confirmed'
}

/** Coaches needed vs lined up for one camp. */
export async function campStaffing(p: Payload, program: Program) {
  const [settings, groups, { docs: coaches }] = await Promise.all([
    staffingSettings(p),
    loadCampGroups(p, program),
    p.find({ pagination: false, collection: 'camp-coaches', where: { program: { equals: program.id }, status: { not_equals: 'removed' } }, limit: 100, sort: 'invitedAt', overrideAccess: true, depth: 1 }),
  ])
  const maxGroups = Math.max(0, ...groups.perDay.map((d) => d.groups.length))
  const extra = program.extraCoaches ?? settings.extraCoaches
  const needed = coachesNeeded({ maxGroups, perGroup: settings.coachesPerGroup, extra })
  const confirmed = coaches.filter((c) => c.status === 'confirmed')
  const invited = coaches.filter((c) => c.status === 'invited')
  const declined = coaches.filter((c) => c.status === 'declined')
  return { settings, maxGroups, extra, needed, coaches, confirmed, invited, declined, gap: staffingGap({ needed, confirmed: confirmed.length, invited: invited.length }), groups }
}

/** Every active coach, and anything that clashes with this camp's days for them. */
export async function coachChoices(p: Payload, program: Program) {
  const days = campDayRanges(campDayList(program))
  if (!days.length) return []
  const from = days[0].from
  const to = days.at(-1)!.to
  const [{ docs: coaches }, { docs: sessions }, { docs: slots }, { docs: blocks }, { docs: otherInvites }, { docs: avail }, { docs: mine }] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-coaches', where: { active: { equals: true } }, sort: 'displayName', limit: 200, ...q }),
    p.find({ pagination: false, collection: 'academy-sessions', where: { status: { in: ['held', 'scheduled'] }, kind: { not_equals: 'group-player' }, startsAt: { greater_than_equal: from, less_than_equal: to } }, limit: 5000, ...q, select: { coach: true, startsAt: true, kind: true } }),
    p.find({ pagination: false, collection: 'academy-term-slots', where: { active: { not_equals: false } }, limit: 500, overrideAccess: true, depth: 1 }),
    p.find({ pagination: false, collection: 'coach-blocks', where: { from: { less_than: to }, to: { greater_than: from }, program: { not_equals: program.id } }, limit: 1000, ...q }),
    p.find({ pagination: false, collection: 'camp-coaches', where: { status: { equals: 'invited' }, program: { not_equals: program.id } }, limit: 500, overrideAccess: true, depth: 1 }),
    p.find({ pagination: false, collection: 'academy-availability', limit: 1000, ...q, select: { coach: true, awayPeriods: true } }),
    p.find({ pagination: false, collection: 'camp-coaches', where: { program: { equals: program.id }, status: { in: ['invited', 'confirmed'] } }, limit: 100, ...q }),
  ])
  const onCamp = new Set(mine.map((m) => idOf(m.coach)))
  const sessionsAsGroup = days.map((d) => ({ date: d.date, startsAt: d.from, endsAt: d.to, cancelled: false, moved: false }))
  return coaches.map((c) => {
    const busy: Busy[] = []
    for (const s of sessions) if (idOf(s.coach) === c.id) busy.push({ label: s.kind === 'group-slot' ? 'a small group' : 'a 1-on-1', startsAt: s.startsAt, endsAt: new Date(new Date(s.startsAt).getTime() + 3_600_000).toISOString() })
    for (const slot of slots) {
      const coachesHere = [...(slot.coaches ?? []), ...(slot.groups ?? []).flatMap((g) => g.coaches ?? [])].map(idOf)
      if (!coachesHere.includes(c.id) || typeof slot.program !== 'object' || !slot.program) continue
      for (const s of slotSessions(slot, slot.program)) if (!s.cancelled) busy.push({ label: `Academy training (${slotLabel(slot)})`, startsAt: s.startsAt, endsAt: s.endsAt })
    }
    for (const b of blocks) if (idOf(b.coach) === c.id) busy.push({ label: b.reason, startsAt: b.from, endsAt: b.to })
    for (const inv of otherInvites) {
      if (idOf(inv.coach) !== c.id || typeof inv.program !== 'object' || !inv.program) continue
      for (const r of campDayRanges(campDayList(inv.program))) busy.push({ label: `${inv.program.title} (not answered yet)`, startsAt: r.from, endsAt: r.to })
    }
    const away = avail.filter((a) => idOf(a.coach) === c.id).flatMap((a) => a.awayPeriods ?? [])
    const clashes = coachClashes({ coach: c.displayName, sessions: sessionsAsGroup, busy, away, now: new Date(0) }).map((w) => w.replace(`${c.displayName} `, ''))
    return { id: c.id, name: c.displayName, onCamp: onCamp.has(c.id), clashes }
  })
}

async function coachUser(p: Payload, coach: AcademyCoach | number) {
  const c = typeof coach === 'object' ? coach : await p.findByID({ collection: 'academy-coaches', id: coach, ...q })
  const userId = idOf(c.user)
  const user = userId ? await p.findByID({ collection: 'users', id: userId, ...q, disableErrors: true }) : null
  return { coach: c, user }
}

async function sendInvite(p: Payload, o: { program: Program; coach: AcademyCoach; user: User | null; token: string; reminder?: boolean }) {
  if (!o.user) return
  const url = respondUrl(o.token)
  const days = campDayList(o.program)
  const html = emailLayout('academy', [
    {
      heading: o.reminder ? `Reminder: can you coach ${o.program.title}?` : `Can you coach ${o.program.title}?`,
      intro: `Hi ${o.user.firstName || o.coach.displayName} — we’d like you to coach at ${o.program.title}. Please confirm or decline${o.reminder ? ' — we’re still waiting on your answer' : ''}.`,
      rows: [
        ['Camp', o.program.title],
        ['Days', days.map((d) => `${campDayLabel(d.date)} · ${campHoursLabel(d)}`).join('<br>')],
        ['Where', o.program.location || 'See the camp details'],
      ],
      cta: { label: 'Confirm or decline', href: url },
      after: 'Once you confirm, these days are blocked out of your 1-on-1 availability so families can’t book you then. You’ll also see this in the coach portal under Camps.',
    },
  ])
  await sendEmail(p, { to: o.user.email, subject: `${o.reminder ? 'Reminder: ' : ''}Coach ${o.program.title}? Please confirm`, html, sender: 'academy', userId: o.user.id })
  await sendSms(p, { to: o.user.phone, kind: 'coach_alert', optedOut: o.user.smsOptOut, userId: o.user.id, body: `Foundation Academy: ${o.reminder ? 'Reminder — ' : ''}can you coach ${o.program.title}, ${campDates(o.program)}? Confirm or decline: ${url}` })
}

/** Management asks a coach to work a camp: email + text with confirm/decline, and it shows in their portal. */
export async function inviteCampCoach(p: Payload, o: { programId: number; coachId: number; actorId?: number | null }) {
  const program = await p.findByID({ collection: 'programs', id: o.programId, ...q })
  if (program.type !== 'holiday-camp') throw new StaffingError('That isn’t a holiday camp.')
  const { docs: existing } = await p.find({ pagination: false, collection: 'camp-coaches', where: { program: { equals: program.id }, coach: { equals: o.coachId }, status: { in: ['invited', 'confirmed'] } }, limit: 1, ...q })
  if (existing.length) throw new StaffingError('That coach is already on this camp.')
  const { coach, user } = await coachUser(p, o.coachId)
  const token = newShareToken()
  const row = await p.create({ collection: 'camp-coaches', data: { program: program.id, coach: coach.id, status: 'invited', tokenHash: hashShareToken(token), invitedAt: new Date().toISOString(), invitedBy: o.actorId ?? undefined }, ...q })
  await sendInvite(p, { program, coach, user, token })
  return row
}

export async function findCampCoachByToken(p: Payload, token: string) {
  if (!token || token.length < 20) return null
  const h = hashShareToken(token)
  const { docs } = await p.find({ pagination: false, collection: 'camp-coaches', where: { or: [{ tokenHash: { equals: h } }, { altTokenHash: { equals: h } }] }, limit: 1, overrideAccess: true, depth: 1 })
  return docs[0] ?? null
}

async function blockDays(p: Payload, cc: CampCoach, program: Program) {
  await p.delete({ collection: 'coach-blocks', where: { campCoach: { equals: cc.id } }, ...q })
  for (const d of campDayRanges(campDayList(program))) {
    await p.create({ collection: 'coach-blocks', data: { coach: idOf(cc.coach)!, from: d.from, to: d.to, reason: program.title, program: program.id, campCoach: cc.id }, ...q })
  }
}

async function tellManagement(p: Payload, subject: string, heading: string, intro: string, program: Program) {
  const { docs: people } = await p.find({ pagination: false, collection: 'users', where: { roles: { in: ['admin', 'committee'] } }, limit: 50, ...q })
  const html = emailLayout('academy', [{ heading, intro, rows: [['Camp', program.title], ['Days', campDates(program)]], cta: { label: 'Open the camp', href: `${siteUrl()}/management/camps/${program.id}` } }])
  for (const u of people) await sendEmail(p, { to: u.email, subject, html, sender: 'academy', userId: u.id })
}

/** The coach answers. Confirm → camp days blocked out; decline → Management told. */
export async function answerCampInvite(p: Payload, o: { campCoachId: number; answer: 'confirm' | 'decline'; reason?: string; coachId?: number }) {
  const cc = await p.findByID({ collection: 'camp-coaches', id: o.campCoachId, ...q })
  if (o.coachId && idOf(cc.coach) !== o.coachId) throw new StaffingError('This camp invite isn’t yours.')
  if (cc.status === 'removed') throw new StaffingError('You’re no longer needed for this camp — thanks anyway.')
  const program = await p.findByID({ collection: 'programs', id: idOf(cc.program)!, ...q })
  const now = new Date().toISOString()
  if (o.answer === 'confirm') {
    if (cc.status === 'confirmed') return { status: 'confirmed' as const, program }
    const updated = await p.update({ collection: 'camp-coaches', id: cc.id, data: { status: 'confirmed', respondedAt: now }, ...q })
    await blockDays(p, updated, program)
    return { status: 'confirmed' as const, program }
  }
  if (cc.status === 'declined') return { status: 'declined' as const, program }
  await p.update({ collection: 'camp-coaches', id: cc.id, data: { status: 'declined', respondedAt: now, declineReason: o.reason?.slice(0, 500) || undefined, declineSeen: false }, ...q })
  await p.delete({ collection: 'coach-blocks', where: { campCoach: { equals: cc.id } }, ...q })
  const { coach } = await coachUser(p, idOf(cc.coach)!)
  await tellManagement(p, `${coach.displayName} can’t coach ${program.title}`, 'A coach declined a camp', `${coach.displayName} declined ${program.title}${o.reason ? ` — “${o.reason}”` : ''}. Ask another coach.`, program)
  return { status: 'declined' as const, program }
}

/** Management takes a coach off a camp: the blocks go and the coach is told. */
export async function removeCampCoach(p: Payload, campCoachId: number) {
  const cc = await p.update({ collection: 'camp-coaches', id: campCoachId, data: { status: 'removed' }, ...q })
  await p.delete({ collection: 'coach-blocks', where: { campCoach: { equals: cc.id } }, ...q })
  const program = await p.findByID({ collection: 'programs', id: idOf(cc.program)!, ...q })
  const { coach, user } = await coachUser(p, idOf(cc.coach)!)
  if (user) await sendEmail(p, { to: user.email, subject: `${program.title}: you’re no longer needed`, sender: 'academy', userId: user.id, html: emailLayout('academy', [{ heading: 'Camp update', intro: `Hi ${user.firstName || coach.displayName} — you’re no longer needed to coach ${program.title}. Those days are free in your availability again. Thanks!` }]) })
}

/** Management has looked at a decline (clears it from the badge). */
export async function markDeclineSeen(p: Payload, campCoachId: number) {
  await p.update({ collection: 'camp-coaches', id: campCoachId, data: { declineSeen: true }, ...q })
}

/** Scheduled + on page views: remind coaches who haven't answered, then tell Management. */
export async function sweepCampCoaches(p: Payload, now = new Date()) {
  const settings = await staffingSettings(p)
  const { docs } = await p.find({ pagination: false, collection: 'camp-coaches', where: { status: { equals: 'invited' } }, limit: 500, overrideAccess: true, depth: 1 })
  let reminded = 0
  let escalated = 0
  for (const cc of docs) {
    const program = cc.program as Program
    if (!program || typeof program !== 'object') continue
    if (reminderDue({ invitedAt: cc.invitedAt, remindedAt: cc.remindedAt, now, hours: settings.confirmReminderHours })) {
      // A fresh link for the reminder; the first one keeps working too
      const token = newShareToken()
      await p.update({ collection: 'camp-coaches', id: cc.id, data: { remindedAt: now.toISOString(), tokenHash: hashShareToken(token), altTokenHash: cc.tokenHash }, ...q })
      const { coach, user } = await coachUser(p, idOf(cc.coach)!)
      await sendInvite(p, { program, coach, user, token, reminder: true })
      reminded++
    }
    if (escalationDue({ invitedAt: cc.invitedAt, escalatedAt: cc.escalatedAt, now, hours: settings.escalateHours })) {
      await p.update({ collection: 'camp-coaches', id: cc.id, data: { escalatedAt: now.toISOString() }, ...q })
      const { coach } = await coachUser(p, idOf(cc.coach)!)
      await tellManagement(p, `${coach.displayName} hasn’t answered about ${program.title}`, 'No answer from a camp coach', `${coach.displayName} hasn’t confirmed ${program.title} after ${settings.escalateHours} hours. Give them a call, or ask another coach.`, program)
      escalated++
    }
  }
  return { reminded, escalated }
}

let lastSweep = 0
/** Run the sweep at most every 5 minutes when someone opens a camps page (cron is only daily). */
export async function nudgeCampCoaches(p: Payload) {
  if (Date.now() - lastSweep < 5 * 60_000) return
  lastSweep = Date.now()
  await sweepCampCoaches(p).catch((e) => p.logger.error({ err: e, msg: 'Camp coach sweep failed' }))
}

/** Camps a coach has been asked to, or is confirmed for (upcoming first). */
export async function coachCamps(p: Payload, coachId: number) {
  const { docs } = await p.find({ pagination: false, collection: 'camp-coaches', where: { coach: { equals: coachId }, status: { in: ['invited', 'confirmed', 'declined'] } }, sort: '-invitedAt', limit: 50, overrideAccess: true, depth: 1 })
  const today = new Date().toISOString().slice(0, 10)
  return docs
    .filter((d) => typeof d.program === 'object' && d.program && (campDayList(d.program).at(-1)?.date ?? '9999') >= today)
    .map((d) => ({ cc: d, program: d.program as Program, days: campDayList(d.program as Program) }))
}

/** Management badge: camps short of coaches, over-staffed, declines not yet seen and no-replies. */
export async function campsAttention(p: Payload) {
  const today = new Date().toISOString().slice(0, 10)
  const { docs: camps } = await p.find({ pagination: false, collection: 'programs', where: { type: { equals: 'holiday-camp' }, status: { in: ['open', 'full'] } }, limit: 50, ...q })
  const items: { campId: number; text: string }[] = []
  for (const camp of camps) {
    if ((campDayList(camp).at(-1)?.date ?? '0000') < today) continue
    const s = await campStaffing(p, camp)
    if (s.gap.short) items.push({ campId: camp.id, text: `${camp.title} needs ${s.gap.short} more coach${s.gap.short === 1 ? '' : 'es'}` })
    if (s.gap.over) items.push({ campId: camp.id, text: `${camp.title}: ${s.gap.over} coach${s.gap.over === 1 ? '' : 'es'} no longer needed` })
    for (const d of s.declined.filter((x) => !x.declineSeen)) items.push({ campId: camp.id, text: `${(d.coach as AcademyCoach).displayName} declined ${camp.title}` })
    for (const i of s.invited.filter((x) => x.escalatedAt)) items.push({ campId: camp.id, text: `${(i.coach as AcademyCoach).displayName} hasn’t answered about ${camp.title}` })
  }
  return items
}

/** Coach-blocks overlapping a time (for the small group clash check). */
export async function blockedAt(p: Payload, coachId: number, times: string[], minutes = 60) {
  if (!times.length) return []
  const sorted = [...times].sort()
  const { docs } = await p.find({ pagination: false, collection: 'coach-blocks', where: { coach: { equals: coachId }, from: { less_than: new Date(new Date(sorted.at(-1)!).getTime() + minutes * 60_000).toISOString() }, to: { greater_than: sorted[0] } }, limit: 500, ...q })
  return times.filter((t) => docs.some((b) => overlaps({ from: t, to: new Date(new Date(t).getTime() + minutes * 60_000).toISOString() }, b)))
}
