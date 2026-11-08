'use server'

import { rateLimit } from '@/lib/form-guard'
import { dobProblem, phoneOk } from '@/lib/validate'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { birthYearOf } from '@/lib/age-groups'
import { getAgeRules } from '@/lib/age-rules'
import { makeReference } from '@/lib/reference'
import { emailInterestConfirmation, emailTrialConfirmation, newToken, openTrialSessions } from '@/lib/trials'
import type { SelectionEntry } from '@/payload-types'
import { currentUser } from '@/lib/auth'
import { rowvilleRound } from '@/selections/rounds'
import { entryFlags, linkFamily } from '@/selections/entries'

export type JoinState = { error?: string; values?: Record<string, string> }

const GENDERS = ['female', 'male', 'non-binary', 'prefer-not-to-say'] as const

export async function joinUs(_prev: JoinState, fd: FormData): Promise<JoinState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v).slice(0, 2000)]))
  const fail = (error: string): JoinState => ({ error, values })
  const s = (k: string) => (values[k] ?? '').trim()

  const contact = { firstName: s('contactFirstName'), lastName: s('contactLastName'), email: s('contactEmail').toLowerCase(), phone: s('contactPhone') }
  const genderRaw = s('gender')
  const player = {
    firstName: s('playerFirstName'),
    lastName: s('playerLastName'),
    dateOfBirth: s('playerDob'),
    gender: (GENDERS as readonly string[]).includes(genderRaw) ? (genderRaw as (typeof GENDERS)[number]) : undefined,
    previousClub: s('previousClub') || undefined,
    notes: s('notes') || undefined,
  }
  if (!player.firstName || !player.lastName || !player.dateOfBirth) return fail('Please complete the player’s name and date of birth.')
  if (!contact.firstName || !contact.lastName || !contact.phone) return fail('Please complete your contact details.')
  if (dobProblem(player.dateOfBirth)) return fail(dobProblem(player.dateOfBirth)!)
  if (!phoneOk(contact.phone)) return fail('Please enter an Australian phone number, e.g. 0412 345 678.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return fail('Please enter a valid email address.')
  if (fd.get('consent') !== 'on') return fail('Please agree to be contacted about trials.')

  const p = await payload()
  const limited = await rateLimit(p, 'join', { email: contact.email })
  if (limited) return fail(limited)
  const rules = await getAgeRules(p)
  const season = rules.season
  const birthYear = birthYearOf(player.dateOfBirth)
  if (!birthYear || birthYear > season || birthYear < season - 80) return fail('Please check the date of birth.')

  // Trial choice (required when trials are open for this age group)
  const sessions = await openTrialSessions(p, birthYear)
  const available = sessions.filter((x) => x.remaining > 0)
  let trialSessionId: number | undefined
  if (available.length) {
    const chosen = available.find((x) => String(x.session.id) === s('trialSession'))
    if (!chosen) return fail('Please choose a trial night.')
    trialSessionId = chosen.session.id
  }

  // One registration per player per season (Rowville trials round)
  const round = await rowvilleRound(p, season)
  const existing = await p.find({
    collection: 'selection-entries',
    where: { round: { equals: round.id }, 'contact.email': { equals: contact.email }, 'player.firstName': { like: player.firstName }, 'player.lastName': { like: player.lastName } },
    limit: 1,
    overrideAccess: true,
  })
  let reg: SelectionEntry
  if (existing.docs[0]) {
    const prev = existing.docs[0]
    if (prev.status !== 'interested' || !trialSessionId) {
      return fail(`${player.firstName} is already registered for ${season} (reference ${prev.reference}). Check your email, or contact the club to make changes.`)
    }
    reg = await p.update({ collection: 'selection-entries', id: prev.id, data: { status: 'trial-booked', trialSession: trialSessionId }, overrideAccess: true, context: { skipOffer: true } })
  } else {
    reg = await p.create({
      collection: 'selection-entries',
      overrideAccess: true,
      data: {
        reference: makeReference('TRY'),
        round: round.id,
        kind: 'rowville',
        flags: [...entryFlags(birthYear, rules, 'rowville')],
        status: trialSessionId ? 'trial-booked' : 'interested',
        season,
        birthYear,
        trialSession: trialSessionId,
        contact,
        player,
        token: newToken(),
      },
    })
  }

  try {
    reg = (await linkFamily(p, reg, await currentUser())).entry
  } catch (e) {
    p.logger.error({ err: e, msg: `Linking account for ${reg.reference} failed` })
  }
  try {
    if (trialSessionId) {
      const session = sessions.find((x) => x.session.id === trialSessionId)!.session
      await emailTrialConfirmation(p, reg, session)
    } else {
      await emailInterestConfirmation(p, reg)
    }
  } catch (e) {
    p.logger.error(e)
  }
  redirect(`/join/thanks?ref=${reg.reference}`)
}

/** From the "trial dates announced" email: pick a night without re-entering details. */
export async function chooseTrial(_prev: JoinState, fd: FormData): Promise<JoinState> {
  const ref = String(fd.get('ref') ?? '')
  const token = String(fd.get('token') ?? '')
  const p = await payload()
  const limited = await rateLimit(p, 'join-choose', { perIp: 20 })
  if (limited) return { error: limited }
  const { docs } = await p.find({ collection: 'selection-entries', where: { reference: { equals: ref } }, limit: 1, overrideAccess: true, showHiddenFields: true })
  const reg = docs[0]
  if (!reg || !token || reg.token !== token) return { error: 'This link is no longer valid. Please contact the club.' }
  if (reg.status !== 'interested') return { error: 'A trial is already booked for this player — check your email for the details.' }
  const sessions = reg.birthYear ? await openTrialSessions(p, reg.birthYear) : []
  const chosen = sessions.find((x) => String(x.session.id) === String(fd.get('trialSession')) && x.remaining > 0)
  if (!chosen) return { error: 'Please choose a trial night with places available.' }
  const updated = await p.update({
    collection: 'selection-entries',
    id: reg.id,
    data: { status: 'trial-booked', trialSession: chosen.session.id },
    overrideAccess: true,
    context: { skipOffer: true },
  })
  await emailTrialConfirmation(p, updated, chosen.session)
  redirect(`/join/thanks?ref=${reg.reference}`)
}
