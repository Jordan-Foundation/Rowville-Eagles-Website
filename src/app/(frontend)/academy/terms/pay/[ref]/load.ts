import type { AcademyRegistration, AcademyTermSlot, Program } from '@/payload-types'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'

/** The registration behind a term pay link: the private link (token) or the family's own login. */
export async function loadTermRegistration(ref: string, token?: string | null) {
  const p = await payload()
  const reg = (await p.find({ collection: 'academy-registrations', where: { reference: { equals: ref } }, limit: 1, depth: 1, overrideAccess: true, showHiddenFields: true })).docs[0] as AcademyRegistration | undefined
  if (!reg) return null
  const user = await currentUser()
  const owner = user && (typeof reg.account === 'object' ? reg.account?.id : reg.account) === user.id
  if (!owner && !(token && reg.token && token === reg.token)) return null
  const program = reg.program as Program
  const slot = (reg.slot && typeof reg.slot === 'object' ? reg.slot : null) as AcademyTermSlot | null
  return { p, reg, program, slot }
}
