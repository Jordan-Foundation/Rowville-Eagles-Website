'use server'

import { rateLimit } from '@/lib/form-guard'
import { checkoutReferralCode } from '@/referrals/capture'
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
  const ref = await checkoutReferralCode(p, fd)
  if (ref.error) return fail(ref.error)
  const rules = await getAgeRules(p)
  const season = rules.season
  const birthYear = birthYearOf(player.dateOfBirth)
  if (!birthYear || birthYear > season || birthYear < season - 80) return fail('Please check the date of birth.')

  // Trial choice (required when trials are open for this age group)
  const sessions = await openTrialSessions(p, birthYear)
  const available = sessions.filter((x) => x.remaining > 0)
  // One or two trial nights
  const picked = [...new Set(fd.getAll('trialSession').map(String))]
  if (picked.length > 2) return fail('Choose up to two trial nights.')
  const chosenNights = picked.map((id) => available.find((x) => String(x.session.id) === id)).filter((x): x is (typeof available)[number] => !!x)
  if (available.length && (!chosenNights.length || chosenNights.length !== picked.length)) return fail(picked.length ? 'One of those trial nights has just filled up — please choose again.' : 'Please choose a trial night.')
  const trialSessionId: number | undefined = chosenNights[0]?.session.id
  const trialSession2Id: number | undefined = chosenNights[1]?.session.id

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
    reg = await p.update({ collection: 'selection-entries', id: prev.id, data: { status: 'trial-booked', trialSession: trialSessionId, trialSession2: trialSession2Id ?? null }, overrideAccess: true, context: { skipOffer: true } })
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
        trialSession2: trialSession2Id,
        referralCode: ref.code ?? undefined,
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
  // Refer a Friend: keep the code on the family's account (registration may be paid weeks later) and update the invite
  try {
    const { saveCodeOnAccount, advanceInvites } = await import('@/referrals/service')
    const { inviteTokenFromCookie } = await import('@/referrals/capture')
    const acc = typeof reg.account === 'object' ? reg.account?.id : reg.account
    if (ref.code) await saveCodeOnAccount(p, acc, ref.code)
    await advanceInvites(p, { email: contact.email, phone: contact.phone, token: await inviteTokenFromCookie(), status: 'trial_registered', account: acc })
  } catch (e) {
    p.logger.error({ err: e, msg: 'Referral capture at trial registration failed' })
  }
  try {
    if (trialSessionId) {
      await emailTrialConfirmation(p, reg, chosenNights.map((x) => x.session))
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
  const { docs } = await p.find({ pagination: false, collection: 'selection-entries', where: { reference: { equals: ref } }, limit: 1, overrideAccess: true, showHiddenFields: true })
  const reg = docs[0]
  if (!reg || !token || reg.token !== token) return { error: 'This link is no longer valid. Please contact the club.' }
  if (reg.status !== 'interested') return { error: 'A trial is already booked for this player — check your email for the details.' }
  const sessions = reg.birthYear ? await openTrialSessions(p, reg.birthYear) : []
  const picked = [...new Set(fd.getAll('trialSession').map(String))]
  if (picked.length > 2) return { error: 'Choose up to two trial nights.' }
  const chosen = picked.map((id) => sessions.find((x) => String(x.session.id) === id && x.remaining > 0)).filter((x): x is (typeof sessions)[number] => !!x)
  if (!chosen.length || chosen.length !== picked.length) return { error: 'Please choose one or two trial nights with places available.' }
  const updated = await p.update({
    collection: 'selection-entries',
    id: reg.id,
    data: { status: 'trial-booked', trialSession: chosen[0].session.id, trialSession2: chosen[1]?.session.id ?? null },
    overrideAccess: true,
    context: { skipOffer: true },
  })
  await emailTrialConfirmation(p, updated, chosen.map((x) => x.session))
  redirect(`/join/thanks?ref=${reg.reference}`)
}
