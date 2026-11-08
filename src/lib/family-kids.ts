import type { Payload } from 'payload'
import { findOrCreateParticipant } from './accounts'

/** What a booking form needs to know about each child on the account (to prefill and reuse). */
export type KidOption = { id: number; firstName: string; lastName: string; dob: string; medical: string; emergencyName: string; emergencyPhone: string; photoConsent: boolean }

export async function familyKids(p: Payload, accountId: number | null | undefined): Promise<KidOption[]> {
  if (!accountId) return []
  const { docs } = await p.find({ pagination: false, collection: 'participants', where: { account: { equals: accountId } }, sort: 'firstName', limit: 20, depth: 0, overrideAccess: true })
  return docs.map((k) => ({
    id: k.id,
    firstName: k.firstName,
    lastName: k.lastName,
    dob: (k.dateOfBirth ?? '').slice(0, 10),
    medical: k.medical?.conditions ?? '',
    emergencyName: k.medical?.emergencyContact ?? '',
    emergencyPhone: k.medical?.emergencyPhone ?? '',
    photoConsent: !!k.photoConsent,
  }))
}

/** The parent's details for prefilling contact fields. */
export const contactPrefill = (u: { firstName?: string | null; lastName?: string | null; email: string; phone?: string | null } | null) =>
  u ? { contactFirstName: u.firstName ?? '', contactLastName: u.lastName ?? '', contactEmail: u.email, contactPhone: u.phone ?? '' } : undefined

/**
 * After a booking by a logged-in parent: make sure the child is on their account and keep the latest medical notes,
 * emergency contact and photo consent, so next time they're filled in. Returns the child's id.
 */
export async function rememberKid(
  p: Payload,
  accountId: number,
  kid: { participantId?: number | null; firstName: string; lastName: string; dateOfBirth: string; medical?: string; emergencyName?: string; emergencyPhone?: string; photoConsent?: boolean },
) {
  try {
    let id = kid.participantId ?? null
    if (id) {
      const existing = await p.findByID({ collection: 'participants', id, depth: 0, overrideAccess: true, disableErrors: true })
      const owner = existing && (typeof existing.account === 'object' ? existing.account.id : existing.account)
      if (owner !== accountId) id = null
    }
    if (!id) id = (await findOrCreateParticipant(p, accountId, { firstName: kid.firstName, lastName: kid.lastName, dateOfBirth: kid.dateOfBirth })).id
    await p.update({
      collection: 'participants',
      id,
      overrideAccess: true,
      depth: 0,
      data: {
        medical: { conditions: kid.medical || undefined, emergencyContact: kid.emergencyName || undefined, emergencyPhone: kid.emergencyPhone || undefined },
        ...(kid.photoConsent !== undefined ? { photoConsent: kid.photoConsent } : {}),
      },
    })
    return id
  } catch (e) {
    p.logger.error({ err: e, msg: 'Could not save the child’s details for next time' })
    return kid.participantId ?? null
  }
}
