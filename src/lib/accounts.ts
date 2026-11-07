import { randomBytes } from 'crypto'
import type { Payload, PayloadRequest } from 'payload'
import type { Participant, User } from '@/payload-types'
import { siteUrl } from './payments'
import { createInvite } from './invites'

export type Membership = 'rowville' | 'rfa'

/** Find the account for an email, or create one (random password — the family sets their own via the invite link). */
export async function ensureAccount(
  payload: Payload,
  contact: { email: string; firstName?: string | null; lastName?: string | null; phone?: string | null },
  req?: PayloadRequest,
): Promise<{ user: User; created: boolean }> {
  const email = contact.email.trim().toLowerCase()
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true, req })
  if (docs[0]) return { user: docs[0], created: false }
  const user = await payload.create({
    collection: 'users',
    overrideAccess: true,
    req,
    data: {
      email,
      password: randomBytes(24).toString('base64url'),
      firstName: contact.firstName || undefined,
      lastName: contact.lastName || undefined,
      phone: contact.phone || undefined,
      roles: ['parent'],
    },
  })
  return { user, created: true }
}

/** Link for the email: create an account (single-use, expires after INVITE_TTL_DAYS) or log in (already activated). */
export async function accountLink(payload: Payload, user: User, req?: PayloadRequest): Promise<{ label: string; href: string }> {
  if (user.activated) return { label: 'Log in to your account', href: `${siteUrl()}/login` }
  const token = await createInvite(payload, { userId: user.id, email: user.email, purpose: 'create-account', req })
  return { label: 'Create your account', href: `${siteUrl()}/account/activate?invite=${token}` }
}

/** Find a player under this account by name + date of birth, or create them. */
export async function findOrCreateParticipant(
  payload: Payload,
  accountId: number,
  p: { firstName: string; lastName: string; dateOfBirth: string; gender?: Participant['gender'] },
  req?: PayloadRequest,
): Promise<Participant> {
  const { docs } = await payload.find({ collection: 'participants', where: { account: { equals: accountId } }, limit: 50, depth: 0, overrideAccess: true, req })
  const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
  const day = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')
  const match = docs.find((d) => same(d.firstName, p.firstName) && same(d.lastName, p.lastName) && day(d.dateOfBirth) === day(p.dateOfBirth))
  if (match) return match
  return payload.create({
    collection: 'participants',
    overrideAccess: true,
    req,
    data: { firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth, gender: p.gender, account: accountId },
  })
}

export async function addMembership(payload: Payload, participant: Participant, tag: Membership, extra: Partial<Participant> = {}, req?: PayloadRequest) {
  const memberships = Array.from(new Set([...(participant.memberships ?? []), tag]))
  return payload.update({ collection: 'participants', id: participant.id, overrideAccess: true, req, data: { memberships, ...extra } })
}

/** Combined membership tags of everyone on the account — used to decide what the shop shows. */
export async function accountMemberships(payload: Payload, userId?: number | null): Promise<Set<Membership>> {
  if (!userId) return new Set()
  const { docs } = await payload.find({ collection: 'participants', where: { account: { equals: userId } }, limit: 50, depth: 0, overrideAccess: true })
  return new Set(docs.flatMap((d) => (d.memberships ?? []) as Membership[]))
}

/**
 * Attach anything this family did as a guest (same email, no account yet) to their account:
 * 1-on-1 bookings and their sessions, club/camp bookings and shop orders.
 * Runs when an account is created or someone logs in; safe to run any number of times.
 */
export async function linkGuestRecords(payload: Payload, user: Pick<User, 'id' | 'email'>, req?: PayloadRequest) {
  const email = user.email.trim().toLowerCase()
  const unlinked = { 'contact.email': { equals: email }, account: { exists: false } }
  const linked = { academy: 0, bookings: 0, orders: 0, 'academy-registrations': 0 }

  const { docs: academy } = await payload.find({ collection: 'academy-bookings', where: unlinked, limit: 200, depth: 0, overrideAccess: true, req })
  for (const b of academy) {
    await payload.update({ collection: 'academy-bookings', id: b.id, data: { account: user.id }, overrideAccess: true, req })
    await payload.update({ collection: 'academy-sessions', where: { booking: { equals: b.id } }, data: { account: user.id }, overrideAccess: true, req })
    linked.academy++
  }
  for (const collection of ['bookings', 'orders', 'academy-registrations'] as const) {
    const { docs } = await payload.find({ collection, where: unlinked, limit: 200, depth: 0, overrideAccess: true, req })
    for (const d of docs) await payload.update({ collection, id: d.id, data: { account: user.id }, overrideAccess: true, req })
    linked[collection] = docs.length
  }
  return linked
}
