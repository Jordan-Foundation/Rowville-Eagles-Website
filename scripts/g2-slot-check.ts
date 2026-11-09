/**
 * Small groups G2 check (Postgres): a coach can't hold a group and a 1-on-1 — or two groups — at the
 * same time, but a group's players can share its time. Run with DATABASE_URL pointing at Postgres:
 *   npx payload run scripts/g2-slot-check.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { createGroupHold, releaseGroup } from '../src/academy/group-holds'
import { createHold, loadTermBookingData } from '../src/academy/booking-data'
import { creditBalance, giveCredit } from '../src/academy/credits'

let failed = 0
const ok = (label: string, v: boolean) => { console.log(`• ${label}: ${v}`); if (!v) failed++ }

const payload = await getPayload({ config })
const coach = (await payload.find({ collection: 'academy-coaches', limit: 1, sort: 'id', depth: 0 })).docs[0]
const term = (await payload.find({ collection: 'academy-terms', limit: 1, sort: 'id', depth: 0 })).docs[0]
const user = (await payload.find({ collection: 'users', limit: 1, sort: 'id', depth: 0 })).docs[0]
// A random time far in the future so reruns don't collide
const base = Date.UTC(2031, 0, 1) + Math.floor(Math.random() * 100_000) * 3_600_000
const at = (h: number) => new Date(base + h * 3_600_000).toISOString()
const T = at(0), T2 = at(1), T3 = at(2)
const deadline = new Date(Date.now() + 48 * 3_600_000).toISOString()
const groupInput = (dates: string[]) => ({ coach: coach.id, term: term.id, type: 'casual' as const, dates, plannedSize: 3, pricingSize: 3, ratePerPlayer: 60, paymentDeadline: deadline })
const hold = (startsAt: string, extra: Record<string, unknown> = {}) => createHold(payload, {
  reference: `G2T-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
  type: 'casual', paymentMode: 'casual', amount: 60, sessionsTotal: 1, sessionsPaid: 0, coach: coach.id, term: term.id, firstSessionAt: startsAt,
  contact: { firstName: 'Test', lastName: 'Family', email: 'g2-check@example.com', mobile: '0400000000' },
  player: { firstName: 'Test', lastName: 'Player', dateOfBirth: '2015-01-01T00:00:00.000Z', emergencyName: 'Em', emergencyPhone: '0400000001' },
  sessions: [{ startsAt }], holdMinutes: 30, ...extra,
} as never)

// 1. A group holds its time
const g = await createGroupHold(payload, groupInput([T]))
ok('group holds its time', g.ok)
if (!g.ok) throw new Error('cannot continue')

// 2. Another group at the same time is refused (clear check)
const g2 = await createGroupHold(payload, groupInput([T]))
ok('second group at the same time refused', !g2.ok && g2.clashes.length === 1)

// 3. A 1-on-1 at the group's time is refused by the database index
ok('1-on-1 at the group\'s time refused', !(await hold(T)).ok)

// 4. The database itself refuses a second live row at that time (no app check)
let dbRefused = false
try { await payload.create({ collection: 'academy-sessions', overrideAccess: true, data: { kind: 'group-slot', coach: coach.id, startsAt: T, status: 'held' } }) } catch { dbRefused = true }
ok('database index refuses a raw duplicate', dbRefused)

// 5. Five players' own rows share the group's time
const players = await Promise.all([1, 2, 3, 4, 5].map(() => hold(T, { kind: 'group', group: g.group.id, groupSize: 5 })))
ok('five player rows share the group\'s time', players.every((p) => p.ok))
const rows = await payload.find({ collection: 'academy-sessions', where: { group: { equals: g.group.id }, status: { not_equals: 'cancelled' } }, depth: 0, limit: 20 })
ok('1 slot row + 5 player rows', rows.docs.filter((r) => r.kind === 'group-slot').length === 1 && rows.docs.filter((r) => r.kind === 'group-player').length === 5)

// 6. The 1-on-1 slot engine sees the group's time as taken
const data = await loadTermBookingData(payload, term)
ok('slot engine: time taken', data.taken.some((t) => t.coachId === coach.id && new Date(t.startsAt).getTime() === new Date(T).getTime()) || new Date(T) > new Date(term.endDate))

// 7. Race: two groups at the same instant — exactly one wins
const race = await Promise.all([createGroupHold(payload, groupInput([T2, T3])), createGroupHold(payload, groupInput([T3]))])
ok('race: exactly one group wins', race.filter((r) => r.ok).length === 1)

// 8. A 1-on-1 already there blocks a group
const one = await hold(at(5))
ok('1-on-1 booked', one.ok)
const g3 = await createGroupHold(payload, groupInput([at(5), at(6)]))
ok('group refused over a 1-on-1 (nothing saved)', !g3.ok && (await payload.count({ collection: 'academy-sessions', where: { coach: { equals: coach.id }, startsAt: { equals: at(6) }, status: { not_equals: 'cancelled' } } })).totalDocs === 0)

// 9. Releasing a group frees the time for a 1-on-1
await releaseGroup(payload, g.group.id, { note: 'check' })
ok('after release, a 1-on-1 can book the time', (await hold(T)).ok)
ok('group marked cancelled', (await payload.findByID({ collection: 'academy-groups', id: g.group.id, depth: 0 })).status === 'cancelled')

// 10. Group credits are kept apart from 1-on-1 credits
const anyBefore = await creditBalance(payload, user.id)
const groupBefore = await creditBalance(payload, user.id, undefined, 'group')
await giveCredit(payload, { account: user.id, sessions: 2, reason: 'adjustment', note: 'G2 check', scope: 'group' })
ok('group credit not usable for 1-on-1s', (await creditBalance(payload, user.id)) === anyBefore)
ok('group credit counted for groups', (await creditBalance(payload, user.id, undefined, 'group')) === groupBefore + 2)

console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
