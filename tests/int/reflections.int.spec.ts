import { describe, expect, it } from 'vitest'
import {
  anonLabel, computeStats, keywordHits, nextFixtureAfter, normaliseDraft, parseKeywords, redact, reflectionWindow, recentWeeks, reportPeriod, reportReady,
  streak, validateReflection, weekKey, windowState, DEFAULT_WELFARE_KEYWORDS, type MomentInput,
} from '@/reflections/rules'

const pillars = [1, 2, 3, 4, 5, 6]
const good = (type: 'great' | 'improve', n = 3): MomentInput[] => Array.from({ length: n }, (_, i) => ({ type, pillar: i + 1, comment: `I did a thing number ${i + 1} well` }))
const full = () => ({ feeling: 4, moments: [...good('great'), ...good('improve')], focus: 'Scan before I receive' })

describe('reflection window', () => {
  it('opens 3h after kick-off and closes 4 days later', () => {
    const w = reflectionWindow('2026-11-14T00:00:00Z', null)
    expect(w.opensAt.toISOString()).toBe('2026-11-14T03:00:00.000Z')
    expect(w.closesAt.toISOString()).toBe('2026-11-18T00:00:00.000Z')
    expect(windowState(w, new Date('2026-11-14T02:59:00Z'))).toBe('upcoming')
    expect(windowState(w, new Date('2026-11-14T03:00:00Z'))).toBe('open')
    expect(windowState(w, new Date('2026-11-18T00:00:00Z'))).toBe('closed')
  })
  it('closes at the next fixture when that is sooner', () => {
    const w = reflectionWindow('2026-11-14T00:00:00Z', '2026-11-16T08:00:00Z')
    expect(w.closesAt.toISOString()).toBe('2026-11-16T08:00:00.000Z')
  })
  it('ignores a "next" fixture before the window opens (same-day double header) and honours settings', () => {
    const w = reflectionWindow('2026-11-14T00:00:00Z', '2026-11-14T02:00:00Z', { opensAfterHours: 2, closesAfterDays: 2 })
    expect(w.opensAt.toISOString()).toBe('2026-11-14T02:00:00.000Z')
    expect(w.closesAt.toISOString()).toBe('2026-11-16T00:00:00.000Z')
  })
  it('finds the next fixture', () => {
    const fx = [{ id: 'a', startsAt: '2026-11-14T00:00:00Z' }, { id: 'c', startsAt: '2026-11-28T00:00:00Z' }, { id: 'b', startsAt: '2026-11-21T00:00:00Z' }]
    expect(nextFixtureAfter(fx, fx[0])?.id).toBe('b')
    expect(nextFixtureAfter(fx, fx[1])).toBeNull()
  })
})

describe('validation', () => {
  it('accepts a complete reflection (feeling optional)', () => {
    expect(validateReflection(full(), pillars).ok).toBe(true)
    expect(validateReflection({ ...full(), feeling: null }, pillars).ok).toBe(true)
  })
  it('needs 3 + 3 moments, each with a pillar and 10–280 chars', () => {
    expect(validateReflection({ ...full(), moments: [...good('great', 2), ...good('improve')] }, pillars).errors.join()).toMatch(/Add 3/)
    const bad = full()
    bad.moments[0] = { type: 'great', pillar: null, comment: 'short' }
    const errs = validateReflection(bad, pillars).errors
    expect(errs.some((e) => /skill area/.test(e))).toBe(true)
    expect(errs.some((e) => /at least 10/.test(e))).toBe(true)
    bad.moments[0] = { type: 'great', pillar: 99, comment: 'x'.repeat(281) }
    const errs2 = validateReflection(bad, pillars).errors
    expect(errs2.some((e) => /skill area/.test(e))).toBe(true)
    expect(errs2.some((e) => /under 280/.test(e))).toBe(true)
  })
  it('requires a focus and a valid feeling', () => {
    expect(validateReflection({ ...full(), focus: ' ' }, pillars).errors.join()).toMatch(/focus/)
    expect(validateReflection({ ...full(), feeling: 7 }, pillars).ok).toBe(false)
  })
  it('drafts keep a fixed 3 + 3 shape', () => {
    const d = normaliseDraft({ moments: [{ type: 'improve', pillar: 2, comment: 'abc' }, { type: 'great', pillar: 77, comment: 'x' }] }, pillars)
    expect(d.moments).toHaveLength(6)
    expect(d.moments[0]).toEqual({ type: 'great', position: 1, pillar: null, comment: 'x' })
    expect(d.moments[3]).toEqual({ type: 'improve', position: 1, pillar: 2, comment: 'abc' })
    expect(d.feeling).toBeNull()
  })
})

describe('safeguarding keywords', () => {
  it('matches whole words and phrases, case-insensitive', () => {
    const kw = DEFAULT_WELFARE_KEYWORDS
    expect(keywordHits('Someone at school BULLIED me again', kw)).toContain('bullied')
    expect(keywordHits('I felt scared after the game', kw)).toContain('scared')
    expect(keywordHits('I had a great first touch and scanned', kw)).toEqual([])
    expect(keywordHits('my secretive dribble move', kw)).toEqual([]) // not "secret"
  })
  it('parses the editable list', () => {
    expect(parseKeywords('Hurt me, scared\n scared \n\nUnsafe')).toEqual(['hurt me', 'scared', 'unsafe'])
  })
})

describe('anonymising', () => {
  it('removes names, emails and phone numbers', () => {
    expect(redact('Passed to Liam and josh, call 0412 345 678 or a@b.com', ['Liam', 'Josh'])).toBe('Passed to [name] and [name], call [number] or [email]')
    expect(redact('Liamson is not Liam', ['Liam'])).toBe('Liamson is not [name]')
  })
  it('labels players A, B … Z, AA', () => {
    expect(anonLabel(0)).toBe('Player A')
    expect(anonLabel(25)).toBe('Player Z')
    expect(anonLabel(26)).toBe('Player AA')
  })
})

describe('stats', () => {
  it('counts strengths and improvements by pillar, feeling average and completion (drafts excluded)', () => {
    const s = computeStats([
      { participant: 1, status: 'submitted', feeling: 5, fixtureAt: '2026-11-14', moments: [{ type: 'great', pillar: 1 }, { type: 'great', pillar: 1 }, { type: 'improve', pillar: 2 }] },
      { participant: 2, status: 'submitted', feeling: 2, fixtureAt: '2026-11-14', moments: [{ type: 'improve', pillar: 2 }] },
      { participant: 3, status: 'draft', feeling: 1, fixtureAt: '2026-11-14', moments: [{ type: 'great', pillar: 3 }] },
    ], [{ id: 1, name: 'Physical' }, { id: 2, name: 'Passing' }, { id: 3, name: 'Dribbling' }], 4)
    expect(s.submitted).toBe(2)
    expect(s.completionRate).toBe(0.5)
    expect(s.feelingAverage).toBe(3.5)
    expect(s.pillars.find((p) => p.pillar === 1)).toMatchObject({ great: 2, improve: 0 })
    expect(s.pillars.find((p) => p.pillar === 2)).toMatchObject({ great: 0, improve: 2 })
    expect(s.pillars.find((p) => p.pillar === 3)).toMatchObject({ great: 0, improve: 0 })
  })
  it('groups by week (Monday)', () => {
    expect(weekKey('2026-11-15')).toBe('2026-11-09') // Sunday → previous Monday
    expect(weekKey('2026-11-16')).toBe('2026-11-16')
  })
})

describe('streak', () => {
  it('counts back from the latest game, skipping one still open', () => {
    expect(streak([{ at: '1', reflected: true }, { at: '2', reflected: true }, { at: '3', reflected: false, open: true }])).toBe(2)
    expect(streak([{ at: '1', reflected: true }, { at: '2', reflected: false }, { at: '3', reflected: true }])).toBe(1)
    expect(streak([])).toBe(0)
  })
})

describe('weekly report timing', () => {
  it('covers the 7 days before the run day', () => {
    expect(reportPeriod('2026-11-16')).toEqual({ from: '2026-11-09', to: '2026-11-16' })
  })
  it('lists the last finished Monday-to-Monday weeks', () => {
    expect(recentWeeks('2026-11-19', 2)).toEqual([{ from: '2026-11-09', to: '2026-11-16' }, { from: '2026-11-02', to: '2026-11-09' }])
  })
  it('is ready once the week is over and every game has closed for reflections', () => {
    const end = new Date('2026-11-15T13:00:00Z')
    const closes = [new Date('2026-11-18T00:00:00Z'), new Date('2026-11-19T02:00:00Z')]
    expect(reportReady(new Date('2026-11-18T12:00:00Z'), end, closes)).toBe(false)
    expect(reportReady(new Date('2026-11-19T02:00:00Z'), end, closes)).toBe(true)
    expect(reportReady(new Date('2026-11-14T00:00:00Z'), end, [])).toBe(false)
  })
})

describe('AI summary tidy-up', async () => {
  const { tidySummary } = await import('@/reflections/ai')
  it('keeps only real quotes from anonymous players and trims lists', () => {
    const input = { reflections: [{ player: 'Player A', feeling: 4, great: [{ pillar: 'Passing', comment: 'I played a great through ball to [name]' }], improve: [], focus: 'scan more' }] }
    const out = tidySummary({
      headline: 'x', strength_themes: Array.from({ length: 6 }, () => ({ pillar: 'Passing', theme: 't', players: 1 })), improvement_themes: [], focus_themes: [], coach_suggestions: [],
      notable_examples: [
        { player: 'Player A', quote: '“a great through ball”', why: 'ok' },
        { player: 'Player A', quote: 'something invented', why: 'no' },
        { player: 'Liam', quote: 'scan more', why: 'named' },
      ],
    }, input)
    expect(out.strength_themes).toHaveLength(4)
    expect(out.notable_examples.map((e) => e.why)).toEqual(['ok'])
  })
})
