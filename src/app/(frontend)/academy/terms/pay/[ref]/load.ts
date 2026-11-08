import type { AcademyRegistration, AcademyTermSlot, Program } from '@/payload-types'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'

/** The registration behind a term pay link: the private link (token) or the family's own login. */
export async function loadTermRegistration(ref: string, token?: string | null) {
  const p = await payload()
  const reg = (await p.find({ pagination: false, collection: 'academy-registrations', where: { reference: { equals: ref } }, limit: 1, depth: 1, overrideAccess: true, showHiddenFields: true })).docs[0] as AcademyRegistration | undefined
  if (!reg) return null
  const user = await currentUser()
  const owner = user && (typeof reg.account === 'object' ? reg.account?.id : reg.account) === user.id
  if (!owner && !(token && reg.token && token === reg.token)) return null
  const program = reg.program as Program
  const slot = (reg.slot && typeof reg.slot === 'object' ? reg.slot : null) as AcademyTermSlot | null
  // 2 nights a week: the other night is paid together
  const pairId = reg.pairedWith ? (typeof reg.pairedWith === 'object' ? reg.pairedWith.id : reg.pairedWith) : null
  const pair = pairId ? ((await p.findByID({ collection: 'academy-registrations', id: pairId, depth: 1, overrideAccess: true, disableErrors: true })) as AcademyRegistration | null) : null
  const pairSlot = pair && pair.status !== 'cancelled' && pair.slot && typeof pair.slot === 'object' ? (pair.slot as AcademyTermSlot) : null
  return { p, reg, program, slot, pair: pairSlot ? pair : null, pairSlot }
}
