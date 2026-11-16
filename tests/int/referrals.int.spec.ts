import { describe, expect, it } from 'vitest'
import { chooseAttribution, confirmAfterFor, e164, makeCode, maskContact, milestonesDue, nextMilestone, normaliseCode, DEFAULT_MILESTONES } from '@/referrals/rules'
import { bookingReferralProgram } from '@/referrals/programs'

const ms = DEFAULT_MILESTONES.map((m, i) => ({ ...m, id: i + 1, active: true }))
const d = (s: string) => new Date(s)

describe('Refer a Friend rules', () => {
  it('makes readable codes', () => {
    expect(makeCode('Tom', () => [0, 1, 2, 3])).toBe('TOM-ABCD')
    expect(makeCode('Zoë-Anne', () => [0, 0, 0, 0])).toMatch(/^ZOEANN-/)
    expect(makeCode('', () => [0, 0, 0, 0])).toBe('RFA-AAAA')
    expect(normaliseCode(' tom-7k3q ')).toBe('TOM-7K3Q')
    expect(normaliseCode('nonsense')).toBeNull()
  })
  it('only the five programs count', () => {
    expect(bookingReferralProgram({}, 'registration')).toBe('eagles')
    expect(bookingReferralProgram({}, 'academy-year')).toBe('academy-term')
    expect(bookingReferralProgram({}, 'toddler')).toBe('mini-ballers')
    expect(bookingReferralProgram({ bookingType: 'trial' }, 'academy-term')).toBeNull()
    expect(bookingReferralProgram({}, 'tournament')).toBeNull()
  })
  it('counts after the window, or when the program starts if sooner', () => {
    const paid = d('2027-01-01T00:00:00Z')
    expect(confirmAfterFor('holiday-camp', paid, { windowDays: 14 }).toISOString()).toBe('2027-01-15T00:00:00.000Z')
    expect(confirmAfterFor('holiday-camp', paid, { windowDays: 14, startsAt: '2027-01-05T00:00:00Z' }).toISOString()).toBe('2027-01-05T00:00:00.000Z')
    expect(confirmAfterFor('academy-term', paid, { windowDays: 14, startsAt: '2027-02-01T00:00:00Z' }).toISOString()).toBe('2027-01-15T00:00:00.000Z')
    expect(confirmAfterFor('academy-term', paid, { windowDays: 14, startsAt: '2026-12-01T00:00:00Z' }).toISOString()).toBe(paid.toISOString())
    expect(confirmAfterFor('one-on-one', paid, { windowDays: 14, startsAt: '2027-01-20T05:00:00Z' }).toISOString()).toBe('2027-01-20T05:00:00.000Z')
  })
  it('a code beats an invite; otherwise the earliest invite', () => {
    const invites = [{ id: 2, referrer: 20, createdAt: '2027-01-02' }, { id: 1, referrer: 10, createdAt: '2027-01-01' }]
    expect(chooseAttribution({ code: { referrer: 99 }, invites })).toEqual({ referrer: 99, attribution: 'code', invite: null })
    expect(chooseAttribution({ invites })).toEqual({ referrer: 10, attribution: 'invite_match', invite: 1 })
    expect(chooseAttribution({ invites: [] })).toBeNull()
  })
  it('unlocks each milestone once', () => {
    expect(milestonesDue(3, ms, []).map((m) => m.threshold)).toEqual([2])
    expect(milestonesDue(4, ms, [1]).map((m) => m.threshold)).toEqual([4])
    expect(milestonesDue(10, ms, [1, 2, 3, 4, 5])).toEqual([])
    expect(milestonesDue(12, [...ms, { id: 6, threshold: 12, active: true }], [1, 2, 3, 4, 5]).map((m) => m.id)).toEqual([6])
    expect(nextMilestone(3, ms)).toMatchObject({ rewardName: 'Free bag', toGo: 1 })
    expect(nextMilestone(10, ms)).toBeNull()
  })
  it('masks contacts and reads mobiles', () => {
    expect(maskContact('jane@gmail.com')).toBe('j•••@gmail.com')
    expect(maskContact(null, '0412 345 678')).toBe('•••• ••• 678')
    expect(e164('0412 345 678')).toBe('+61412345678')
    expect(e164('12345')).toBeNull()
  })
})
