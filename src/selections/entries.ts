import type { Payload } from 'payload'
import type { Program, SelectionEntry, User } from '@/payload-types'
import { accountLink, ensureAccount, findOrCreateParticipant } from '../lib/accounts'
import { fullLabel, groupInfo, type AgeRules } from '../lib/age-groups'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { formatDate } from '../lib/format'

/** Give the family an account and a player record straight away, so the interest shows on their profile. */
export async function linkFamily(payload: Payload, entry: SelectionEntry, signedIn?: User | null) {
  const { user } = signedIn ? { user: signedIn } : await ensureAccount(payload, { email: entry.contact.email, firstName: entry.contact.firstName, lastName: entry.contact.lastName, phone: entry.contact.phone })
  const participant = await findOrCreateParticipant(payload, user.id, {
    firstName: entry.player.firstName,
    lastName: entry.player.lastName,
    dateOfBirth: entry.player.dateOfBirth,
    gender: entry.player.gender ?? undefined,
  })
  const updated = await payload.update({ collection: 'selection-entries', id: entry.id, data: { account: user.id, participant: participant.id }, overrideAccess: true, context: { skipOffer: true } })
  return { user, participant, entry: updated }
}

/** Flags for staff: outside MiniRoos (tournaments are MiniRoos only; Rowville flags players too young). */
export function entryFlags(birthYear: number, rules: AgeRules, kind: 'tournament' | 'rowville') {
  const g = groupInfo(birthYear, rules)
  const outside = kind === 'tournament' ? g.kind !== 'miniroos' : g.kind === 'too-young'
  return outside ? (['outside-miniroos'] as const) : ([] as const)
}

export async function emailTournamentInterest(payload: Payload, entry: SelectionEntry, program: Program, user: User, rules: AgeRules) {
  const link = await accountLink(payload, user)
  const g = groupInfo(entry.birthYear!, rules)
  const html = emailLayout(program.brand === 'academy' ? 'academy' : 'club', [
    {
      heading: 'Interest received',
      intro: `Thanks ${esc(entry.contact.firstName)} — we’ve registered ${esc(entry.player.firstName)}’s interest in <strong>${esc(program.title)}</strong>. Coaches select teams by age group; we’ll email you as soon as selections are made. There’s nothing to pay until ${esc(entry.player.firstName)} is selected.`,
      rows: [
        ['Player', `${entry.player.firstName} ${entry.player.lastName}`],
        ['Age group', g.kind === 'miniroos' ? fullLabel(g) : `${g.label} (outside MiniRoos — we’ll be in touch)`],
        ...(program.startDate ? ([['When', formatDate(program.startDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })]] as [string, string][]) : []),
        ...(program.location ? ([['Where', program.location]] as [string, string][]) : []),
        ['Reference', entry.reference ?? ''],
      ],
      cta: { label: user.activated ? 'See it in your account' : 'Create your free account', href: link.href },
      after: 'Your account shows the status of every selection — “Interest registered — awaiting selection” until teams are picked.',
    },
  ])
  await sendEmail(payload, { to: entry.contact.email, subject: `Interest received: ${program.title}`, html, sender: program.brand === 'academy' ? 'academy' : 'club', userId: user.id })
}

/** What families see on their profile for each status. */
export function entryStatusLabel(e: Pick<SelectionEntry, 'status' | 'kind'>): { label: string; tone: 'info' | 'action' | 'ok' | 'muted' } {
  switch (e.status) {
    case 'interested':
      return { label: e.kind === 'tournament' ? 'Interest registered — awaiting selection' : 'Interest registered — we’ll email trial dates', tone: 'info' }
    case 'trial-booked':
      return { label: 'Trial booked', tone: 'info' }
    case 'attended':
      return { label: 'Trial attended — awaiting outcome', tone: 'info' }
    case 'selected':
      return { label: 'Selected — complete registration', tone: 'action' }
    case 'offered':
      return { label: 'Successful — complete registration', tone: 'action' }
    case 'unsuccessful':
      return { label: 'Not selected this time', tone: 'muted' }
    case 'registered':
      return { label: 'Registered', tone: 'ok' }
    default:
      return { label: 'Closed', tone: 'muted' }
  }
}
