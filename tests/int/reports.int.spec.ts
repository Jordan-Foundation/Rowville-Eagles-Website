import { describe, expect, it } from 'vitest'
import { cleanEntry, coachCanEdit, planReports, submitProblems, type Candidate } from '../../src/academy/reports/rules'
import { dueReminder, daysUntil } from '../../src/academy/reminders'

const full = { strands: ['ATT', 'DEF', 'PHY', 'PAS', 'TAC', 'CHA'].map((strand) => ({ strand, rating: 'at' as const, comment: '' })), overall: 'Great term — keep working on your weaker foot.' }
const cand = (o: Partial<Candidate>): Candidate => ({ key: 'participant:1', name: 'Ava Smith', birthYear: 2018, coachUserId: 5, source: 'term', sourceLabel: 'Tue 5pm', ...o })

describe('report entry rules', () => {
  it('locks once submitted, unlocks when returned', () => {
    expect(coachCanEdit('not_started')).toBe(true)
    expect(coachCanEdit('draft')).toBe(true)
    expect(coachCanEdit('returned')).toBe(true)
    expect(coachCanEdit('submitted')).toBe(false)
    expect(coachCanEdit('approved')).toBe(false)
    expect(coachCanEdit('released')).toBe(false)
  })
  it('cleans drafts: all six strands, unknown ratings/strands dropped, text capped', () => {
    const c = cleanEntry({ strands: [{ strand: 'ATT', rating: 'amazing' as never, comment: ' x ' }, { strand: 'ZZZ', rating: 'at' }], overall: 'y'.repeat(5000) })
    expect(c.strands.map((s) => s.strand)).toEqual(['ATT', 'DEF', 'PHY', 'PAS', 'TAC', 'CHA'])
    expect(c.strands[0]).toEqual({ strand: 'ATT', rating: null, comment: 'x' })
    expect(c.overall.length).toBe(2000)
  })
  it('needs every strand rated and an overall comment to submit', () => {
    expect(submitProblems(full)).toEqual([])
    expect(submitProblems({ ...full, overall: 'ok' })).toHaveLength(1)
    const missing = submitProblems({ ...full, strands: full.strands.map((s) => (s.strand === 'TAC' ? { ...s, rating: null } : s)) })
    expect(missing[0]).toContain('Tactical')
    // Strand comments are optional
    expect(submitProblems({ ...full, strands: full.strands.map((s) => ({ ...s, comment: '' })) })).toEqual([])
  })
})

describe('planReports', () => {
  it('one report per player; the first place found wins', () => {
    const r = planReports([cand({ source: 'term' }), cand({ source: 'team', sourceLabel: 'U9 Blue' })], 2027, new Set())
    expect(r.create).toHaveLength(1)
    expect(r.create[0]).toMatchObject({ source: 'term', level: '9' })
  })
  it('skips Mini Ballers, too young, no date of birth, and players already in the cycle', () => {
    const r = planReports([
      cand({ key: 'participant:2', toddler: true }),
      cand({ key: 'participant:3', birthYear: 2024 }),
      cand({ key: 'registration:4', birthYear: null }),
      cand({ key: 'participant:5' }),
      cand({ key: 'participant:6', coachUserId: null }),
    ], 2027, new Set(['participant:5']))
    expect(r.skipped.map((s) => s.reason)).toEqual(['Mini Ballers (no curriculum report)', 'Too young for Foundation', 'No date of birth'])
    expect(r.already).toBe(1)
    expect(r.create.map((c) => c.key)).toEqual(['participant:6']) // still created; Management assigns a coach
  })
  it('uses the age group a player was moved into', () => {
    expect(planReports([cand({ playingBirthYear: 2017 })], 2027, new Set()).create[0].level).toBe('10')
  })
})

describe('report reminders', () => {
  it('14/7/3/1 days before the due date, never twice', () => {
    const due = new Date('2027-06-20T12:00:00Z')
    expect(dueReminder(daysUntil(due, new Date('2027-06-06T00:00:00Z')), new Set())).toBe('14d')
    expect(dueReminder(daysUntil(due, new Date('2027-06-13T00:00:00Z')), new Set(['14d']))).toBe('7d')
    expect(dueReminder(daysUntil(due, new Date('2027-06-13T00:00:00Z')), new Set(['14d', '7d']))).toBeNull()
    expect(dueReminder(daysUntil(due, new Date('2027-06-19T00:00:00Z')), new Set(['14d', '7d', '3d']))).toBe('1d')
    expect(dueReminder(daysUntil(due, new Date('2027-06-20T01:00:00Z')), new Set())).toBeNull()
  })
})
