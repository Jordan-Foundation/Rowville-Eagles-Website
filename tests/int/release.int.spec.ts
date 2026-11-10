import { describe, expect, it } from 'vitest'
import { dueToOpen, opensAtFor, releaseLabel } from '../../src/academy/release'

const ends = ['2027-03-25', '2027-06-25', '2027-09-17', '2027-12-17']
describe('Academy registrations opening', () => {
  it('Term 1 at the chosen time (or now); later terms 2 weeks before the previous term ends (Sydney midnight)', () => {
    const now = new Date('2026-11-20T00:00:00Z')
    expect(opensAtFor(1, ends, '2026-12-01T22:00:00.000Z', now)).toBe('2026-12-01T22:00:00.000Z')
    expect(opensAtFor(1, ends, null, now)).toBe(now.toISOString())
    expect(opensAtFor(2, ends, null, now)).toBe('2027-03-10T13:00:00.000Z') // 11 Mar 00:00 AEDT
    expect(opensAtFor(3, ends, null, now)).toBe('2027-06-10T14:00:00.000Z') // 11 Jun 00:00 AEST
  })
  it('only drafts with automatic opening on, once the time has come', () => {
    const now = new Date('2027-03-11T00:00:00Z')
    expect(dueToOpen({ status: 'draft', opensAt: '2027-03-10T13:00:00.000Z' }, now)).toBe(true)
    expect(dueToOpen({ status: 'draft', opensAt: '2027-03-12T13:00:00.000Z' }, now)).toBe(false)
    expect(dueToOpen({ status: 'draft', autoOpen: false, opensAt: '2027-03-10T13:00:00.000Z' }, now)).toBe(false)
    expect(dueToOpen({ status: 'closed', opensAt: '2027-03-10T13:00:00.000Z' }, now)).toBe(false)
    expect(dueToOpen({ status: 'draft' }, now)).toBe(false)
  })
  it('labels', () => {
    const f = () => 'Thu 11 Mar'
    const now = new Date('2027-03-01T00:00:00Z')
    expect(releaseLabel({ status: 'draft', opensAt: '2027-03-10T13:00:00.000Z' }, now, f)).toBe('Opens Thu 11 Mar')
    expect(releaseLabel({ status: 'draft', autoOpen: false, opensAt: '2027-03-10T13:00:00.000Z' }, now, f)).toBe('Automatic opening off (was Thu 11 Mar)')
    expect(releaseLabel({ status: 'open' }, now, f)).toBe('Open for registrations')
  })
})
