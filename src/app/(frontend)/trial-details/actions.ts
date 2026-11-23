'use server'

import { payload } from '@/lib/payload'
import { readFollowToken } from '@/lib/follow-up-token'
import { rememberKid } from '@/lib/family-kids'

export type TrialDetailsState = { error?: string; done?: boolean; values?: Record<string, string> }

/** After a free trial booking: the emergency contact, medical answer and photo consent (from a signed link). */
export async function saveTrialDetails(_prev: TrialDetailsState, fd: FormData): Promise<TrialDetailsState> {
  const values = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).slice(0, 2000)]))
  const s = (k: string) => (values[k] ?? '').trim()
  const fail = (error: string): TrialDetailsState => ({ error, values })
  const ref = readFollowToken(s('token'))
  if (!ref) return fail('This link isn’t valid. Please use the link in your email, or call the club.')
  if (!s('emergencyName') || !s('emergencyPhone')) return fail('Please add an emergency contact name and phone number.')
  if (!/^[+\d][\d\s()-]{7,}$/.test(s('emergencyPhone'))) return fail('Please check the emergency contact’s phone number.')
  if (!['none', 'yes'].includes(s('medicalAnswer'))) return fail('Please answer the medical question.')
  if (s('medicalAnswer') === 'yes' && !s('medical')) return fail('Please describe the medical condition, allergy or injury.')
  const p = await payload()
  const { docs } = await p.find({ collection: 'bookings', where: { reference: { equals: ref }, bookingType: { equals: 'trial' } }, limit: 1, depth: 0, overrideAccess: true })
  const b = docs[0]
  if (!b) return fail('We couldn’t find that trial booking. Please call the club.')
  const medical = s('medicalAnswer') === 'none' ? 'None' : s('medical')
  const player = { ...b.player, emergencyName: s('emergencyName'), emergencyRelationship: s('emergencyRelationship') || undefined, emergencyPhone: s('emergencyPhone'), medical, photoConsent: values.photoConsent === 'on' }
  await p.update({ collection: 'bookings', id: b.id, data: { player, followUps: { ...b.followUps, detailsAt: new Date().toISOString() } }, depth: 0, overrideAccess: true })
  const account = typeof b.account === 'object' ? b.account?.id : b.account
  if (account && player.firstName && player.lastName && player.dateOfBirth) {
    await rememberKid(p, account, { participantId: typeof b.participant === 'object' ? b.participant?.id : b.participant, firstName: player.firstName, lastName: player.lastName, dateOfBirth: player.dateOfBirth, medical, emergencyName: player.emergencyName, emergencyRelationship: player.emergencyRelationship, emergencyPhone: player.emergencyPhone, photoConsent: player.photoConsent })
  }
  return { done: true }
}
