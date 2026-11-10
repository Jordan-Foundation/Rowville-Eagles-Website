'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { rateLimit } from '@/lib/form-guard'
import { payload } from '@/lib/payload'
import { rememberKid } from '@/lib/family-kids'
import { birthYearOf } from '@/lib/age-groups'
import { phoneOk } from '@/lib/validate'
import { FullYearError, checkoutFullYear } from '@/academy/terms/full-year'

export type YearState = { error?: string; values?: Record<string, string> }
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim().slice(0, 2000)

/** Full-year Academy registration: Term 1 training time(s) chosen, Terms 2–4 placed to match. Priced on the server. */
export async function bookFullYear(_prev: YearState, fd: FormData): Promise<YearState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v).slice(0, 2000)]))
  const fail = (error: string): YearState => ({ error, values })
  const p = await payload()
  const limited = await rateLimit(p, 'year-booking', { perIp: 20 })
  if (limited) return fail(limited)
  const year = (await p.find({ pagination: false, collection: 'programs', where: { slug: { equals: str(fd, 'program') }, type: { equals: 'academy-year' }, status: { equals: 'open' } }, limit: 1, depth: 0 })).docs[0]
  if (!year) return fail('The full year isn’t taking registrations right now.')
  const contact = { firstName: str(fd, 'contactFirstName'), lastName: str(fd, 'contactLastName'), email: str(fd, 'contactEmail').toLowerCase(), phone: str(fd, 'contactPhone') }
  if (!contact.firstName || !contact.lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return fail('Please complete your contact details.')
  if (!phoneOk(contact.phone)) return fail('Please enter an Australian phone number, e.g. 0412 345 678.')
  const player = { firstName: str(fd, 'playerFirstName'), lastName: str(fd, 'playerLastName'), dateOfBirth: str(fd, 'playerDob'), medical: str(fd, 'medical') || undefined, emergencyName: str(fd, 'emergencyName'), emergencyPhone: str(fd, 'emergencyPhone'), photoConsent: fd.get('photoConsent') === 'on' }
  if (!player.firstName || !player.lastName || Number.isNaN(Date.parse(player.dateOfBirth))) return fail('Please complete the player’s name and date of birth.')
  if (!player.emergencyName || !player.emergencyPhone) return fail('Please add an emergency contact.')
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')
  const slotIds = str(fd, 'option').split('+').map(Number).filter(Boolean)
  if (!slotIds.length) return fail('Please choose a Term 1 training time.')
  const { user } = await p.auth({ headers: await headers() })
  const accountId = user?.collection === 'users' ? user.id : undefined
  const kidId = accountId ? await rememberKid(p, accountId, { participantId: Number(str(fd, 'participant')) || null, firstName: player.firstName, lastName: player.lastName, dateOfBirth: player.dateOfBirth, medical: player.medical, emergencyName: player.emergencyName, emergencyPhone: player.emergencyPhone, photoConsent: player.photoConsent }) : null
  let url: string
  try {
    url = await checkoutFullYear(p, { year, slotIds, birthYear: birthYearOf(player.dateOfBirth)!, contact, player, accountId, participantId: kidId, cancelPath: `/programs/${year.slug}/book?cancelled=1` })
  } catch (e) {
    if (e instanceof FullYearError) return fail(e.message)
    p.logger.error(e)
    return fail('We couldn’t start the payment. Please try again, or contact us if this keeps happening.')
  }
  redirect(url)
}
