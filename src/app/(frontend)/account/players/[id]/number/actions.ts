'use server'

import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { confirmNumber, holdNumber, NumberError } from '@/numbers/service'

export type PickState = { error?: string; held?: number; until?: string; done?: number }

async function ownKid(id: number) {
  const user = await currentUser()
  if (!user) return null
  const p = await payload()
  const kid = await p.findByID({ collection: 'participants', id, depth: 0, overrideAccess: true, disableErrors: true })
  if (!kid || (typeof kid.account === 'object' ? kid.account?.id : kid.account) !== user.id) return null
  return { p, kid, user }
}

/** Tap a number → it's held for 10 minutes while they confirm. */
export async function holdAction(kidId: number, number: number): Promise<PickState> {
  const c = await ownKid(kidId)
  if (!c) return { error: 'Please log in again.' }
  try {
    const h = await holdNumber(c.p, c.kid, number)
    return { held: h.number, until: h.heldUntil ?? undefined }
  } catch (e) {
    return { error: e instanceof NumberError ? e.message : 'Something went wrong — please try again.' }
  }
}

/** Confirm: the held number (or, if they're keeping their old number, hold it and confirm in one go). */
export async function confirmAction(kidId: number, number: number): Promise<PickState> {
  const c = await ownKid(kidId)
  if (!c) return { error: 'Please log in again.' }
  try {
    const { docs } = await c.p.find({ collection: 'player-numbers', where: { participant: { equals: kidId }, status: { equals: 'held' }, heldUntil: { greater_than: new Date().toISOString() } }, limit: 1, depth: 0, overrideAccess: true })
    if (docs[0]?.number !== number) await holdNumber(c.p, c.kid, number)
    const doc = await confirmNumber(c.p, c.kid, c.user.id)
    return { done: doc.number }
  } catch (e) {
    return { error: e instanceof NumberError ? e.message : 'Something went wrong — please try again.' }
  }
}
