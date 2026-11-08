'use server'

import { rateLimit } from '@/lib/form-guard'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { birthYearOf } from '@/lib/age-groups'
import { getAgeRules } from '@/lib/age-rules'
import { tournamentRound } from '@/selections/rounds'
import { emailTournamentInterest, entryFlags, linkFamily } from '@/selections/entries'

export type InterestState = { error?: string; values?: Record<string, string> }

const GENDERS = ['female', 'male', 'non-binary', 'prefer-not-to-say'] as const
const PHONE = /^(\+?61|0)[2-478]\d{8}$/

/** Tournament expression of interest — no payment; the year of birth decides the age group. */
export async function registerTournamentInterest(_prev: InterestState, fd: FormData): Promise<InterestState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v).slice(0, 2000)]))
  const fail = (error: string): InterestState => ({ error, values })
  const s = (k: string) => (values[k] ?? '').trim()

  const p = await payload()
  const limited = await rateLimit(p, 'interest', { perIp: 20 })
  if (limited) return fail(limited)
  const program = (await p.find({ pagination: false, collection: 'programs', where: { slug: { equals: s('slug') }, type: { equals: 'tournament' } }, limit: 1, depth: 0 })).docs[0]
  if (!program || program.status !== 'open') return fail('Registrations of interest for this tournament are closed.')
  const user = await currentUser()

  // Player: one already on the account, or new details
  let player = { firstName: s('playerFirstName'), lastName: s('playerLastName'), dateOfBirth: s('playerDob'), gender: undefined as (typeof GENDERS)[number] | undefined }
  if (user && s('participant') && s('participant') !== 'new') {
    const kid = await p.findByID({ collection: 'participants', id: Number(s('participant')), depth: 0, overrideAccess: true, disableErrors: true })
    if (!kid || (typeof kid.account === 'object' ? kid.account.id : kid.account) !== user.id) return fail('Please choose a player on your account.')
    player = { firstName: kid.firstName, lastName: kid.lastName, dateOfBirth: kid.dateOfBirth, gender: kid.gender ?? undefined }
  } else {
    const g = s('gender')
    player.gender = (GENDERS as readonly string[]).includes(g) ? (g as (typeof GENDERS)[number]) : undefined
  }
  const contact = user
    ? { firstName: user.firstName || s('contactFirstName'), lastName: user.lastName || s('contactLastName'), email: user.email, phone: (user.phone || s('contactPhone')).replace(/\s+/g, '') }
    : { firstName: s('contactFirstName'), lastName: s('contactLastName'), email: s('contactEmail').toLowerCase(), phone: s('contactPhone').replace(/\s+/g, '') }

  if (!player.firstName || !player.lastName || !player.dateOfBirth) return fail('Please complete the player’s name and date of birth.')
  if (!contact.firstName || !contact.lastName) return fail('Please enter the parent or guardian’s name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return fail('Please enter a valid email address.')
  if (!PHONE.test(contact.phone)) return fail('Please enter an Australian phone number, e.g. 0412 345 678.')
  if (fd.get('consent') !== 'on') return fail('Please agree to be contacted about this tournament.')

  const rules = await getAgeRules(p)
  const birthYear = birthYearOf(player.dateOfBirth)
  if (!birthYear || birthYear > rules.season || birthYear < rules.season - 25) return fail('Please check the date of birth.')

  const round = await tournamentRound(p, program, rules.season)
  if (round.status !== 'open') return fail('Selections for this tournament have started — registrations of interest are closed.')

  const existing = await p.find({
    collection: 'selection-entries',
    where: { round: { equals: round.id }, 'player.firstName': { like: player.firstName }, 'player.lastName': { like: player.lastName }, 'player.dateOfBirth': { equals: new Date(player.dateOfBirth).toISOString() } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs[0]) return fail(`${player.firstName} has already registered interest (reference ${existing.docs[0].reference}).`)

  const created = await p.create({
    collection: 'selection-entries',
    overrideAccess: true,
    data: {
      round: round.id,
      kind: 'tournament',
      status: 'interested',
      season: rules.season,
      birthYear,
      flags: [...entryFlags(birthYear, rules, 'tournament')],
      contact,
      player: { ...player, previousClub: s('club') || undefined, notes: s('notes') || undefined },
    },
  })
  const { user: family, entry } = await linkFamily(p, created, user)
  try {
    await emailTournamentInterest(p, entry, program, family, rules)
  } catch (e) {
    p.logger.error({ err: e, msg: `Interest email failed for ${entry.reference}` })
  }
  redirect(`/programs/${program.slug}/interest/thanks?ref=${entry.reference}`)
}
