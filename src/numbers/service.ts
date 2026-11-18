import type { Payload, PayloadRequest } from 'payload'
import type { Participant, PlayerNumber } from '@/payload-types'
import { getAgeRules } from '../lib/age-rules'
import { birthYearOf } from '../lib/age-groups'
import { freeNumbers, HOLD_MINUTES, picksNumber, rangeFor, seedRanges, slotKey, type Range } from './rules'

const q = { overrideAccess: true, pagination: false } as const
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null

export class NumberError extends Error {}

/** All stored ranges; seeds this season's years the first time. */
export async function storedRanges(p: Payload): Promise<Range[]> {
  const { docs } = await p.find({ ...q, collection: 'number-ranges', limit: 200, depth: 0 })
  if (docs.length) return docs.map((d) => ({ birthYear: d.birthYear, start: d.start, end: d.end }))
  const seeded = seedRanges(await getAgeRules(p))
  for (const r of seeded) await p.create({ ...q, collection: 'number-ranges', data: r }).catch(() => null)
  return seeded
}

/** A year's range, stored the first time it's needed (so it never changes after that). */
export async function rangeForYear(p: Payload, birthYear: number) {
  const all = await storedRanges(p)
  const r = rangeFor(birthYear, all)
  if (r && !all.some((x) => x.birthYear === birthYear)) await p.create({ ...q, collection: 'number-ranges', data: r }).catch(() => null)
  return r
}

/** Holds that ran out go back into the pool. */
async function expireHolds(p: Payload, req?: PayloadRequest) {
  const { docs } = await p.find({ ...q, collection: 'player-numbers', where: { status: { equals: 'held' }, heldUntil: { less_than: new Date().toISOString() } }, limit: 500, depth: 0, req })
  for (const d of docs) await p.update({ ...q, collection: 'player-numbers', id: d.id, data: { status: 'released', slot: null, releasedAt: new Date().toISOString() }, req })
}

export async function activeNumber(p: Payload, participantId: number, req?: PayloadRequest) {
  const { docs } = await p.find({ ...q, collection: 'player-numbers', where: { participant: { equals: participantId }, status: { equals: 'active' } }, limit: 1, depth: 0, req })
  return docs[0] ?? null
}

/** Active numbers for many players at once (for rosters and lists). */
export async function numbersFor(p: Payload, participantIds: number[]) {
  const map = new Map<number, number>()
  if (!participantIds.length) return map
  const { docs } = await p.find({ ...q, collection: 'player-numbers', where: { participant: { in: participantIds }, status: { equals: 'active' } }, limit: participantIds.length + 10, depth: 0, select: { participant: true, number: true } })
  for (const d of docs) map.set(idOf(d.participant)!, d.number)
  return map
}

/** Numbers taken in a year (active, or held by someone else and not expired). */
export async function takenNumbers(p: Payload, birthYear: number, exceptParticipant?: number) {
  await expireHolds(p)
  const { docs } = await p.find({ ...q, collection: 'player-numbers', where: { birthYear: { equals: birthYear }, status: { in: ['held', 'active'] } }, limit: 200, depth: 0 })
  return new Set(docs.filter((d) => idOf(d.participant) !== exceptParticipant || d.status === 'active').map((d) => d.number))
}

const audit = (p: Payload, data: { participant: number; action: 'picked' | 'assigned' | 'changed' | 'released' | 'released-inactive'; oldNumber?: number | null; newNumber?: number | null; birthYear?: number | null; by?: number | null; note?: string }, req?: PayloadRequest) =>
  p.create({ ...q, collection: 'number-audit-log', data: { ...data, oldNumber: data.oldNumber ?? null, newNumber: data.newNumber ?? null }, req })

/** Where a player stands with their number (for the picker page and the banner). */
export async function numberState(p: Payload, kid: Participant) {
  const rules = await getAgeRules(p)
  const birthYear = birthYearOf(kid.dateOfBirth)
  const active = await activeNumber(p, kid.id)
  if (active) return { kind: 'has' as const, number: active.number, birthYear: active.birthYear }
  if (!birthYear) return { kind: 'no-dob' as const }
  if (!picksNumber(birthYear, rules)) return { kind: 'senior' as const }
  const range = await rangeForYear(p, birthYear)
  if (!range) return { kind: 'no-range' as const }
  const taken = await takenNumbers(p, birthYear, kid.id)
  const free = freeNumbers(range, taken)
  const { docs: mine } = await p.find({ ...q, collection: 'player-numbers', where: { participant: { equals: kid.id } }, sort: '-updatedAt', limit: 5, depth: 0 })
  const held = mine.find((d) => d.status === 'held' && d.heldUntil && Date.parse(d.heldUntil) > Date.now()) ?? null
  // Rejoining: their old number, if it's still free
  const previous = mine.find((d) => d.status === 'released' && d.birthYear === birthYear)?.number ?? null
  return { kind: 'pick' as const, birthYear, range, taken: [...taken], free, held, previous: previous && free.includes(previous) ? previous : null }
}

export const needsNumber = (kid: Participant) => Boolean(kid.numbers?.required) && kid.status !== 'inactive'

const taken = () => new NumberError('Just taken — please pick another number.')
const isUnique = (e: unknown) => /unique|already exists|duplicate/i.test(String((e as Error)?.message ?? e)) || /unique/i.test(JSON.stringify((e as { data?: unknown })?.data ?? ''))

/** A family taps a number: hold it for 10 minutes while they confirm. */
export async function holdNumber(p: Payload, kid: Participant, number: number) {
  const s = await numberState(p, kid)
  if (s.kind === 'has') throw new NumberError(`${kid.firstName} already wears ${s.number}.`)
  if (s.kind !== 'pick') throw new NumberError('A number can’t be picked for this player yet.')
  if (number === 1) throw new NumberError('Number 1 is the goalkeeper top.')
  if (!s.free.includes(number)) throw taken()
  // Drop any other hold this player has
  const { docs: mine } = await p.find({ ...q, collection: 'player-numbers', where: { participant: { equals: kid.id }, status: { equals: 'held' } }, limit: 5, depth: 0 })
  for (const d of mine) await p.update({ ...q, collection: 'player-numbers', id: d.id, data: { status: 'released', slot: null, releasedAt: new Date().toISOString() } })
  try {
    return await p.create({ ...q, collection: 'player-numbers', data: { participant: kid.id, birthYear: s.birthYear, number, status: 'held', slot: slotKey(s.birthYear, number), heldUntil: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(), assignedBy: 'player' } })
  } catch (e) {
    if (isUnique(e)) throw taken()
    throw e
  }
}

/** Confirm the held number: it's theirs for RFA and Rowville. */
export async function confirmNumber(p: Payload, kid: Participant, userId: number | null) {
  const { docs } = await p.find({ ...q, collection: 'player-numbers', where: { participant: { equals: kid.id }, status: { equals: 'held' }, heldUntil: { greater_than: new Date().toISOString() } }, limit: 1, depth: 0 })
  const held = docs[0]
  if (!held) throw new NumberError('That hold ran out — please pick the number again.')
  const doc = await p.update({ ...q, collection: 'player-numbers', id: held.id, data: { status: 'active', heldUntil: null, assignedAt: new Date().toISOString() } })
  await audit(p, { participant: kid.id, action: 'picked', newNumber: doc.number, birthYear: doc.birthYear, by: userId })
  return doc
}

/** Management: give a player a number (or change it). */
export async function assignNumber(p: Payload, participantId: number, number: number, by: number) {
  const kid = await p.findByID({ ...q, collection: 'participants', id: participantId, depth: 0 })
  const birthYear = birthYearOf(kid.dateOfBirth)
  if (!birthYear) throw new NumberError('Set the player’s date of birth first.')
  if (number === 1 || number < 2 || number > 99) throw new NumberError('Numbers are 2–99 (1 is the goalkeeper top).')
  const current = await activeNumber(p, participantId)
  if (current?.number === number && current.birthYear === birthYear) return current
  await expireHolds(p)
  if (current) await p.update({ ...q, collection: 'player-numbers', id: current.id, data: { status: 'released', slot: null, releasedAt: new Date().toISOString() } })
  try {
    const doc = await p.create({ ...q, collection: 'player-numbers', data: { participant: participantId, birthYear, number, status: 'active', slot: slotKey(birthYear, number), assignedAt: new Date().toISOString(), assignedBy: 'admin' } })
    await audit(p, { participant: participantId, action: current ? 'changed' : 'assigned', oldNumber: current?.number, newNumber: number, birthYear, by })
    return doc
  } catch (e) {
    if (current) await p.update({ ...q, collection: 'player-numbers', id: current.id, data: { status: 'active', slot: slotKey(current.birthYear, current.number), releasedAt: null } })
    if (isUnique(e)) throw new NumberError(`${number} is already taken in ${birthYear}.`)
    throw e
  }
}

/** Release a player's number (Management, or because they were marked inactive). */
export async function releaseNumber(p: Payload, participantId: number, o: { by?: number | null; action?: 'released' | 'released-inactive'; req?: PayloadRequest } = {}) {
  const { docs } = await p.find({ ...q, collection: 'player-numbers', where: { participant: { equals: participantId }, status: { in: ['active', 'held'] } }, limit: 5, depth: 0, req: o.req })
  for (const d of docs) {
    await p.update({ ...q, collection: 'player-numbers', id: d.id, data: { status: 'released', slot: null, releasedAt: new Date().toISOString() }, req: o.req })
    if (d.status === 'active') await audit(p, { participant: participantId, action: o.action ?? 'released', oldNumber: d.number, birthYear: d.birthYear, by: o.by ?? null }, o.req)
  }
  return docs.length
}

/** After an RFA term or Eagles registration is paid: the player needs a number (and a rejoining inactive player is active again). */
export async function requireNumber(p: Payload, participantId: number) {
  const kid = await p.findByID({ ...q, collection: 'participants', id: participantId, depth: 0 })
  const rules = await getAgeRules(p)
  if (!picksNumber(birthYearOf(kid.dateOfBirth), rules) && kid.dateOfBirth) return false
  if (await activeNumber(p, participantId)) {
    if (kid.status === 'inactive') await p.update({ ...q, collection: 'participants', id: participantId, data: { status: 'active' }, context: { skipNumberRelease: true } })
    return false
  }
  await p.update({ ...q, collection: 'participants', id: participantId, data: { status: 'active', numbers: { required: true, requiredAt: kid.numbers?.requiredAt ?? new Date().toISOString(), reminderAt: null } }, context: { skipNumberRelease: true } })
  // A full range: tell Management
  const birthYear = birthYearOf(kid.dateOfBirth)
  if (birthYear) {
    const range = await rangeForYear(p, birthYear)
    if (range && !freeNumbers(range, await takenNumbers(p, birthYear)).length) {
      const { record } = await import('../staff-feed/service')
      await record(p, `numbers-full:${birthYear}:${participantId}`, { kind: 'problem', title: `No shirt numbers left for ${birthYear}`, detail: `${kid.firstName} ${kid.lastName} needs one — widen the range or free a number`, href: '/management/numbers' })
    }
  }
  return true
}

/** Players this family needs to pick a number for. */
export async function familyNeedsNumbers(p: Payload, accountId: number) {
  const { docs } = await p.find({ ...q, collection: 'participants', where: { account: { equals: accountId }, 'numbers.required': { equals: true }, status: { not_equals: 'inactive' } }, limit: 20, depth: 0 })
  const out: Participant[] = []
  for (const k of docs) if (!(await activeNumber(p, k.id))) out.push(k)
  return out
}

/** Daily: one reminder 24 hours after payment if the number still isn't picked. */
export async function sendNumberReminders(p: Payload, now = new Date()) {
  const { docs } = await p.find({ ...q, collection: 'participants', where: { 'numbers.required': { equals: true }, status: { not_equals: 'inactive' }, 'numbers.requiredAt': { less_than: new Date(now.getTime() - 24 * 3_600_000).toISOString() }, 'numbers.reminderAt': { exists: false } }, limit: 200, depth: 1 })
  const { sendEmail } = await import('../lib/email')
  const { emailLayout, esc } = await import('../lib/email-templates')
  const { siteUrl } = await import('../lib/payments')
  let sent = 0
  for (const kid of docs) {
    if (await activeNumber(p, kid.id)) continue
    const parent = typeof kid.account === 'object' ? kid.account : null
    if (parent?.email) {
      const html = emailLayout('club', [{ heading: `Pick ${esc(kid.firstName)}’s shirt number`, intro: `${esc(kid.firstName)} hasn’t picked a shirt number yet. It takes a minute — the number is theirs for both the Academy and Rowville Eagles.`, cta: { label: 'Pick a number', href: `${siteUrl()}/account/players/${kid.id}/number` } }])
      await sendEmail(p, { to: parent.email, subject: `Pick ${kid.firstName}’s shirt number`, html, sender: 'club', userId: parent.id })
      sent++
    }
    await p.update({ ...q, collection: 'participants', id: kid.id, data: { numbers: { ...kid.numbers, reminderAt: now.toISOString() } }, context: { skipNumberRelease: true } })
  }
  return { sent }
}

export type { PlayerNumber }
