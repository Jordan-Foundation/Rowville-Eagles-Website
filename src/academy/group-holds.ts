import type { Payload, PayloadRequest } from 'payload'
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'
import type { AcademyGroup } from '@/payload-types'
import { makeReference } from '../lib/reference'

const id = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? undefined))

/** A database refusal because the coach already has something at that time (Postgres unique index). */
export const isSlotClash = (e: unknown) => {
  const msg = String((e as Error)?.message ?? e) + String((e as { cause?: unknown })?.cause ?? '')
  return /coach_id|starts_at|unique|duplicate|23505/i.test(msg)
}

/**
 * Which of these times the coach already has a live 1-on-1 or group at. The database index is the real
 * guarantee (two people saving at the same instant); this check gives a clear answer first, and is the
 * only guard on the local SQLite database, which has no such index.
 */
export async function coachClashes(payload: Payload, coachId: number, times: string[], req?: PayloadRequest): Promise<string[]> {
  if (!times.length) return []
  const { docs } = await payload.find({
    collection: 'academy-sessions',
    where: { coach: { equals: coachId }, status: { not_equals: 'cancelled' }, kind: { not_equals: 'group-player' }, startsAt: { in: times } },
    limit: times.length + 10,
    depth: 0,
    overrideAccess: true,
    req,
    select: { startsAt: true },
  })
  const taken = new Set(docs.map((d) => new Date(d.startsAt).getTime()))
  return times.filter((t) => taken.has(new Date(t).getTime()))
}

export type GroupHoldInput = {
  coach: number
  term: number
  type: 'casual' | 'term'
  dates: string[]
  weekday?: AcademyGroup['weekday']
  startTime?: string | null
  plannedSize: number
  pricingSize: number
  ratePerPlayer: number
  paymentDeadline: string
  createdBy?: number | null
}

/**
 * Create a forming group and hold its time: one `group-slot` session row per date, in one transaction.
 * If the coach already has anything at any of those times nothing is saved.
 */
export async function createGroupHold(payload: Payload, input: GroupHoldInput): Promise<{ ok: true; group: AcademyGroup } | { ok: false; clashes: string[] }> {
  const dates = [...new Set(input.dates.map((d) => new Date(d).toISOString()))].sort()
  if (!dates.length) throw new Error('A group needs at least one session')
  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    const clashes = await coachClashes(payload, input.coach, dates, req)
    if (clashes.length) {
      await killTransaction(req)
      return { ok: false, clashes }
    }
    const group = await payload.create({
      collection: 'academy-groups',
      overrideAccess: true,
      req,
      data: {
        reference: makeReference('RFG'),
        status: 'forming',
        type: input.type,
        coach: input.coach,
        term: input.term,
        weekday: input.weekday ?? undefined,
        startTime: input.startTime ?? undefined,
        firstSessionAt: dates[0],
        plannedSize: input.plannedSize,
        pricingSize: input.pricingSize,
        ratePerPlayer: input.ratePerPlayer,
        sessionsTotal: dates.length,
        paymentDeadline: input.paymentDeadline,
        createdBy: input.createdBy ?? undefined,
        history: [{ at: new Date().toISOString(), by: input.createdBy ?? undefined, action: 'Group set up' }],
      },
    })
    for (const startsAt of dates) {
      await payload.create({
        collection: 'academy-sessions',
        overrideAccess: true,
        req,
        data: { kind: 'group-slot', group: group.id, coach: input.coach, startsAt, status: 'held' },
      })
    }
    await commitTransaction(req)
    return { ok: true, group }
  } catch (e) {
    await killTransaction(req)
    if (isSlotClash(e)) return { ok: false, clashes: dates }
    throw e
  }
}

/** The time a group holds (its `group-slot` rows), soonest first. */
export async function groupSlots(payload: Payload, groupId: number, req?: PayloadRequest) {
  const { docs } = await payload.find({
    collection: 'academy-sessions',
    where: { group: { equals: groupId }, kind: { equals: 'group-slot' }, status: { not_equals: 'cancelled' } },
    sort: 'startsAt',
    limit: 100,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return docs
}

/** The group is going ahead: its held time becomes scheduled. */
export async function scheduleGroupSlots(payload: Payload, groupId: number, req?: PayloadRequest) {
  await payload.update({ collection: 'academy-sessions', where: { group: { equals: groupId }, kind: { equals: 'group-slot' }, status: { equals: 'held' } }, data: { status: 'scheduled' }, overrideAccess: true, req })
}

/**
 * Let go of a group's time (cancelled, or never got going): its slot rows are cancelled so the coach is
 * free again. Player bookings are handled separately (refunds/credits follow the normal policy).
 */
export async function releaseGroup(payload: Payload, groupId: number, o: { by?: number | null; note?: string } = {}, req?: PayloadRequest) {
  const group = await payload.findByID({ collection: 'academy-groups', id: groupId, depth: 0, overrideAccess: true, req })
  await payload.update({ collection: 'academy-sessions', where: { group: { equals: groupId }, kind: { equals: 'group-slot' }, status: { not_equals: 'cancelled' } }, data: { status: 'cancelled' }, overrideAccess: true, req })
  return payload.update({
    collection: 'academy-groups',
    id: groupId,
    overrideAccess: true,
    req,
    data: { status: 'cancelled', history: [...(group.history ?? []), { at: new Date().toISOString(), by: id(o.by ?? undefined), action: 'Group cancelled', note: o.note }] },
  })
}
