import { randomBytes } from 'crypto'
import type { Payload, PayloadRequest } from 'payload'
import type { Program, Team, SelectionEntry, TrialSession } from '@/payload-types'
import { accountLink, ensureAccount, findOrCreateParticipant } from './accounts'
import { sendEmail } from './email'
import { emailLayout, esc, rfaPromoBlock } from './email-templates'
import { formatAUD, formatDate } from './format'
import { siteUrl } from './payments'
import { groupLabel } from './age-groups'

const grp = (by?: number | null) => (by ? groupLabel(by) : 'their age group')

export const newToken = () => randomBytes(18).toString('base64url')

const when = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })

/** Places used in a club trial session for one age group (year of birth). */
export async function trialPlacesTaken(payload: Payload, sessionId: number, birthYear: number) {
  const { totalDocs } = await payload.count({
    collection: 'selection-entries',
    where: { or: [{ trialSession: { equals: sessionId } }, { trialSession2: { equals: sessionId } }], birthYear: { equals: birthYear }, status: { in: ['trial-booked', 'attended', 'offered', 'registered'] } },
    overrideAccess: true,
  })
  return totalDocs
}

/** Upcoming published club trial sessions for an age group, with places left. */
export async function openTrialSessions(payload: Payload, birthYear: number) {
  const { docs } = await payload.find({
    collection: 'trial-sessions',
    where: { status: { equals: 'published' }, start: { greater_than: new Date().toISOString() }, birthYears: { in: [birthYear] } },
    sort: 'start',
    limit: 20,
    depth: 0,
  })
  return Promise.all(docs.map(async (s) => ({ session: s, remaining: Math.max(0, (s.capacityPerAgeGroup ?? 20) - (await trialPlacesTaken(payload, s.id, birthYear))) })))
}

/** A registration's booked trial nights (one or two), earliest first. */
export const trialNightsOf = (e: Pick<SelectionEntry, 'trialSession' | 'trialSession2'>) =>
  [e.trialSession, e.trialSession2].filter((x): x is TrialSession => !!x && typeof x === 'object').sort((a, b) => a.start.localeCompare(b.start))

export async function emailTrialConfirmation(payload: Payload, reg: SelectionEntry, sessionOrNights: TrialSession | TrialSession[]) {
  const nights = (Array.isArray(sessionOrNights) ? sessionOrNights : [sessionOrNights]).sort((a, b) => a.start.localeCompare(b.start))
  const session = nights[0]
  const bring = [...new Set(nights.map((n) => n.whatToBring).filter(Boolean))].join(' ')
  const html = emailLayout('club', [
    {
      heading: `${reg.player.firstName} is booked in for trials`,
      intro: `Thanks ${esc(reg.contact.firstName)} — we can’t wait to meet ${esc(reg.player.firstName)} at the Rowville Eagles ${reg.season} trials.`,
      rows: [
        ...nights.map((n, i) => [nights.length > 1 ? `Trial night ${i + 1}` : 'When', when(n.start)] as [string, string]),
        ['Where', [...new Set(nights.map((n) => n.location || '208 Dandelion Drive, Rowville'))].join(' / ')],
        ['Age group', grp(reg.birthYear)],
        ['Reference', reg.reference ?? ''],
      ],
      after: bring ? `<strong>What to bring:</strong> ${esc(bring)}` : undefined,
    },
    rfaPromoBlock(),
  ])
  await sendEmail(payload, { to: reg.contact.email, subject: nights.length > 1 ? `Trials booked: ${session.title} + 1 more night` : `Trial booked: ${session.title}`, html, sender: 'club', replyTo: await replyTo(payload) })
}

export async function emailInterestConfirmation(payload: Payload, reg: SelectionEntry) {
  const html = emailLayout('club', [
    {
      heading: 'You’re on the list!',
      intro: `Thanks ${esc(reg.contact.firstName)} — we’ve registered ${esc(reg.player.firstName)}’s interest in playing for Rowville Eagles in ${reg.season}. Trial dates for ${esc(grp(reg.birthYear))} haven’t been set yet — we’ll email and text you the moment they are, and you can confirm a spot with one tap.`,
      rows: [
        ['Player', `${reg.player.firstName} ${reg.player.lastName}`],
        ['Age group', grp(reg.birthYear)],
        ['Reference', reg.reference ?? ''],
      ],
    },
    rfaPromoBlock(),
  ])
  await sendEmail(payload, { to: reg.contact.email, subject: `Expression of interest received — Rowville Eagles ${reg.season}`, html, sender: 'club', replyTo: await replyTo(payload) })
}

/** Trial-dates email + text for one waiting family, with a one-tap link to confirm their spot. */
async function inviteToTrial(payload: Payload, reg: SelectionEntry, session: TrialSession, o: { reminder?: boolean; req?: PayloadRequest } = {}) {
  const { token } = await payload.findByID({ collection: 'selection-entries', id: reg.id, depth: 0, overrideAccess: true, showHiddenFields: true, req: o.req })
  const link = `${siteUrl()}/join/choose?ref=${reg.reference}&token=${token}`
  const html = emailLayout('club', [
    {
      heading: o.reminder ? `Don’t miss ${grp(reg.birthYear)} trials` : `Trial dates are here for ${grp(reg.birthYear)}`,
      intro: o.reminder
        ? `Hi ${esc(reg.contact.firstName)} — ${esc(reg.player.firstName)}’s trial spot isn’t confirmed yet and places are limited. It takes one tap.`
        : `Good news ${esc(reg.contact.firstName)} — ${grp(reg.birthYear)} trials have been scheduled. Confirm ${esc(reg.player.firstName)}’s spot with one tap (you can change the night if you need to).`,
      rows: [
        ['First date', when(session.start)],
        ['Where', session.location || '208 Dandelion Drive, Rowville'],
      ],
      cta: { label: 'Confirm my trial spot', href: link },
    },
    rfaPromoBlock(),
  ])
  await sendEmail(payload, { to: reg.contact.email, subject: o.reminder ? `Reminder: confirm ${reg.player.firstName}’s trial spot — Rowville Eagles` : `${grp(reg.birthYear)} trial dates announced — Rowville Eagles`, html, sender: 'club', replyTo: await replyTo(payload, o.req), req: o.req })
  try {
    const { sendSms } = await import('./sms')
    const acct = reg.account ? (typeof reg.account === 'object' ? reg.account : await payload.findByID({ collection: 'users', id: reg.account, depth: 0, overrideAccess: true }).catch(() => null)) : null
    await sendSms(payload, {
      to: reg.contact.phone,
      kind: 'service',
      userId: acct?.id ?? null,
      optedOut: Boolean(acct?.smsOptOut),
      body: o.reminder
        ? `Rowville Eagles: ${reg.player.firstName}’s ${grp(reg.birthYear)} trial spot isn’t confirmed yet — places are limited. Confirm in one tap: ${link}`
        : `Rowville Eagles: ${grp(reg.birthYear)} trial dates are set! First night ${when(session.start)}. Confirm ${reg.player.firstName}’s spot in one tap: ${link}`,
    })
  } catch (e) {
    payload.logger.error({ err: e, msg: `Trial text for ${reg.reference} failed` })
  }
}

/** This season's Eagles registrations still waiting for a trial night. */
async function waitingEntries(payload: Payload, where: Record<string, unknown> = {}, req?: PayloadRequest) {
  const { getAgeRules } = await import('./age-rules')
  const season = (await getAgeRules(payload)).season
  const { docs } = await payload.find({ collection: 'selection-entries', where: { kind: { equals: 'rowville' }, status: { equals: 'interested' }, season: { equals: season }, ...where }, limit: 5000, pagination: false, depth: 0, overrideAccess: true, req })
  return docs
}

/** Called when a club trial session is published: email + text everyone waiting in a matching age group (not imported ones — they're sent from Management after a preview). */
export async function notifyInterestsOfTrial(payload: Payload, session: TrialSession, req?: PayloadRequest) {
  if (new Date(session.start) < new Date()) return
  const docs = await waitingEntries(payload, { birthYear: { in: session.birthYears }, source: { not_equals: 'import' } }, req)
  for (const reg of docs) {
    const notified = (reg.notifiedSessions ?? []).map((s) => (typeof s === 'object' ? s.id : s))
    if (notified.includes(session.id)) continue
    await inviteToTrial(payload, reg, session, { req })
    await payload.update({ collection: 'selection-entries', id: reg.id, data: { notifiedSessions: [...notified, session.id], trialInvitedAt: reg.trialInvitedAt ?? new Date().toISOString() }, overrideAccess: true, req, context: { skipOffer: true } })
  }
}

/** Waiting families whose age group has open trial nights but who haven't been told yet (e.g. imported EOIs). */
export async function trialInvitesDue(payload: Payload) {
  const docs = await waitingEntries(payload, { trialInvitedAt: { exists: false } })
  const byYear = new Map<number, Awaited<ReturnType<typeof openTrialSessions>>>()
  const due: { reg: SelectionEntry; session: TrialSession }[] = []
  for (const reg of docs) {
    if (!reg.birthYear || (reg.notifiedSessions ?? []).length) continue // already told under the earlier flow
    if (!byYear.has(reg.birthYear)) byYear.set(reg.birthYear, await openTrialSessions(payload, reg.birthYear))
    const first = byYear.get(reg.birthYear)!.find((x) => x.remaining > 0)
    if (first) due.push({ reg, session: first.session })
  }
  return due
}

/** Management pressed Send on the preview: invite everyone due (at most `max` per run). */
export async function sendTrialInvites(payload: Payload, o: { ids?: number[]; max?: number } = {}) {
  const due = (await trialInvitesDue(payload)).filter((d) => !o.ids || o.ids.includes(d.reg.id)).slice(0, o.max ?? 300)
  for (const { reg, session } of due) {
    await inviteToTrial(payload, reg, session)
    const notified = (reg.notifiedSessions ?? []).map((s) => (typeof s === 'object' ? s.id : s))
    await payload.update({ collection: 'selection-entries', id: reg.id, data: { notifiedSessions: [...new Set([...notified, session.id])], trialInvitedAt: new Date().toISOString() }, overrideAccess: true, context: { skipOffer: true } })
  }
  return { sent: due.length }
}

/** Daily: one reminder 3 days after the trial-dates message to families who still haven't confirmed (while places remain). */
export async function sendTrialReminders(payload: Payload, now = new Date()) {
  const docs = await waitingEntries(payload, { trialInvitedAt: { less_than: new Date(now.getTime() - 3 * 86_400_000).toISOString() }, trialReminderAt: { exists: false } })
  let sent = 0
  for (const reg of docs) {
    const open = reg.birthYear ? (await openTrialSessions(payload, reg.birthYear)).find((x) => x.remaining > 0) : null
    if (!open) continue
    await inviteToTrial(payload, reg, open.session, { reminder: true })
    await payload.update({ collection: 'selection-entries', id: reg.id, data: { trialReminderAt: now.toISOString() }, overrideAccess: true, context: { skipOffer: true } })
    sent++
  }
  return { sent }
}

/** Committee marked a registrant "Offer a place": create account + player, unlock registration, email the family. */
export async function sendOffer(
  payload: Payload,
  reg: SelectionEntry,
  req?: PayloadRequest,
  /** From the selection dashboard: the reviewed template message (heading + paragraphs) instead of the default text */
  custom?: { subject: string; heading: string; bodyHtml: string; cta?: { label: string; href: string } },
) {
  const programId = typeof reg.registrationProgram === 'object' ? reg.registrationProgram?.id : reg.registrationProgram
  const teamId = typeof reg.offeredTeam === 'object' ? reg.offeredTeam?.id : reg.offeredTeam
  if (!programId || !teamId) return null
  const [program, team] = (await Promise.all([
    payload.findByID({ collection: 'programs', id: programId, depth: 0, req }),
    payload.findByID({ collection: 'teams', id: teamId, depth: 0, req }),
  ])) as [Program, Team]

  const { user } = await ensureAccount(payload, reg.contact, req)
  const participant = await findOrCreateParticipant(payload, user.id, { ...reg.player, gender: reg.player.gender ?? undefined }, req)
  await payload.update({
    collection: 'participants',
    id: participant.id,
    data: { team: team.id, registrationOffer: { program: program.id, status: 'offered' } },
    overrideAccess: true,
    req,
  })
  await payload.update({
    collection: 'selection-entries',
    id: reg.id,
    data: { account: user.id, participant: participant.id, offerSentAt: new Date().toISOString() },
    overrideAccess: true,
    req,
    context: { skipOffer: true },
  })

  const link = await accountLink(payload, user, req)
  const html = emailLayout('club', [
    {
      heading: custom?.heading ?? `Welcome to the Eagles, ${reg.player.firstName}!`,
      intro: custom ? custom.bodyHtml : `Congratulations ${esc(reg.contact.firstName)} — after trials we’d love ${esc(reg.player.firstName)} to join <strong>${esc(team.name)}</strong> for the ${reg.season} season. ${user.activated ? 'Log in' : 'Create your account'} to accept the place and pay the club registration fee.`,
      rows: [
        ['Player', `${reg.player.firstName} ${reg.player.lastName}`],
        ['Team', team.name],
        ['Club registration', formatAUD(program.price ?? 0)],
      ],
      cta: custom?.cta ?? link,
      after:
        'After paying the club fee you’ll complete the Football Victoria section in PlayFootball. This link is personal — please don’t forward it.',
    },
  ])
  await sendEmail(payload, { to: reg.contact.email, subject: custom?.subject ?? `Your place in ${team.name} — Rowville Eagles ${reg.season}`, html, sender: 'club', replyTo: await replyTo(payload, req), userId: user.id, req })
  return { user, link }
}

async function replyTo(payload: Payload, req?: PayloadRequest) {
  const s = await payload.findGlobal({ slug: 'site-settings', depth: 0, req })
  return s.email || undefined
}
