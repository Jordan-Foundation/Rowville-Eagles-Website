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
    where: { trialSession: { equals: sessionId }, birthYear: { equals: birthYear }, status: { in: ['trial-booked', 'attended', 'offered', 'registered'] } },
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

export async function emailTrialConfirmation(payload: Payload, reg: SelectionEntry, session: TrialSession) {
  const html = emailLayout('club', [
    {
      heading: `${reg.player.firstName} is booked in for trials`,
      intro: `Thanks ${esc(reg.contact.firstName)} — we can’t wait to meet ${esc(reg.player.firstName)} at the Rowville Eagles ${reg.season} trials.`,
      rows: [
        ['When', when(session.start)],
        ['Where', session.location || '208 Dandelion Drive, Rowville'],
        ['Age group', grp(reg.birthYear)],
        ['Reference', reg.reference ?? ''],
      ],
      after: session.whatToBring ? `<strong>What to bring:</strong> ${esc(session.whatToBring)}` : undefined,
    },
    rfaPromoBlock(),
  ])
  await sendEmail(payload, { to: reg.contact.email, subject: `Trial booked: ${session.title}`, html, sender: 'club', replyTo: await replyTo(payload) })
}

export async function emailInterestConfirmation(payload: Payload, reg: SelectionEntry) {
  const html = emailLayout('club', [
    {
      heading: 'You’re on the list!',
      intro: `Thanks ${esc(reg.contact.firstName)} — we’ve registered ${esc(reg.player.firstName)}’s interest in playing for Rowville Eagles in ${reg.season}. Trial dates for ${esc(grp(reg.birthYear))} haven’t been set yet — we’ll email you the moment they are, with a link to choose a night.`,
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

/** Called when a club trial session is published: email everyone waiting in a matching age group. */
export async function notifyInterestsOfTrial(payload: Payload, session: TrialSession, req?: PayloadRequest) {
  if (new Date(session.start) < new Date()) return
  const { docs } = await payload.find({
    collection: 'selection-entries',
    where: { status: { equals: 'interested' }, birthYear: { in: session.birthYears } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const reg of docs) {
    const notified = (reg.notifiedSessions ?? []).map((s) => (typeof s === 'object' ? s.id : s))
    if (notified.includes(session.id)) continue
    const { token } = await payload.findByID({ collection: 'selection-entries', id: reg.id, depth: 0, overrideAccess: true, showHiddenFields: true, req })
    const html = emailLayout('club', [
      {
        heading: `Trial dates are here for ${grp(reg.birthYear)}`,
        intro: `Good news ${esc(reg.contact.firstName)} — ${grp(reg.birthYear)} trials have been scheduled. Choose a night for ${esc(reg.player.firstName)} using the button below.`,
        rows: [
          ['First date', when(session.start)],
          ['Where', session.location || '208 Dandelion Drive, Rowville'],
        ],
        cta: { label: 'Choose a trial night', href: `${siteUrl()}/join/choose?ref=${reg.reference}&token=${token}` },
      },
      rfaPromoBlock(),
    ])
    await sendEmail(payload, { to: reg.contact.email, subject: `${grp(reg.birthYear)} trial dates announced — Rowville Eagles`, html, sender: 'club', replyTo: await replyTo(payload, req), req })
    await payload.update({
      collection: 'selection-entries',
      id: reg.id,
      data: { notifiedSessions: [...notified, session.id] },
      overrideAccess: true,
      req,
      context: { skipOffer: true },
    })
  }
}

/** Committee marked a registrant "Offer a place": create account + player, unlock registration, email the family. */
export async function sendOffer(
  payload: Payload,
  reg: SelectionEntry,
  req?: PayloadRequest,
  /** From the selection dashboard: the reviewed template message (heading + paragraphs) instead of the default text */
  custom?: { subject: string; heading: string; bodyHtml: string },
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
        ['Club registration', formatAUD(program.price)],
      ],
      cta: link,
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
