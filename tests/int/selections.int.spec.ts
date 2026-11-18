import { describe, expect, it } from 'vitest'
import { entryFlags, entryStatusLabel } from '@/selections/entries'
import { DEFAULT_RULES } from '@/lib/age-groups'

const rules = { season: 2027, ...DEFAULT_RULES }

describe('selection entries', () => {
  it('flags tournament players outside MiniRoos, and Rowville players too young', () => {
    expect(entryFlags(2017, rules, 'tournament')).toEqual([])
    expect(entryFlags(2013, rules, 'tournament')).toEqual(['outside-miniroos'])
    expect(entryFlags(2013, rules, 'rowville')).toEqual([])
    expect(entryFlags(2022, rules, 'rowville')).toEqual(['outside-miniroos'])
  })
  it('shows families a clear status', () => {
    expect(entryStatusLabel({ status: 'interested', kind: 'tournament' }).label).toBe('Interest registered — awaiting selection')
    expect(entryStatusLabel({ status: 'interested', kind: 'rowville' }).label).toBe('Interest registered — we’ll email trial dates')
    expect(entryStatusLabel({ status: 'interested', kind: 'rowville', trialInvitedAt: '2026-11-18T02:00:00Z' }).label).toBe('Trial dates sent 18 Nov — not confirmed yet')
    expect(entryStatusLabel({ status: 'interested', kind: 'rowville', trialInvitedAt: '2026-11-18T02:00:00Z', trialReminderAt: '2026-11-21T20:00:00Z' }).label).toBe('Trial dates sent 18 Nov — not confirmed yet · reminder sent 22 Nov')
    expect(entryStatusLabel({ status: 'interested', kind: 'rowville', notifiedSessions: [3] }).label).toBe('Trial dates sent — not confirmed yet') // told under the earlier flow
    expect(entryStatusLabel({ status: 'unsuccessful', kind: 'rowville' }).tone).toBe('muted')
  })
})
