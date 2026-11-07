import { describe, expect, it } from 'vitest'
import { groupByYear, inTab, isMoved, pickOutcome, toCsv } from '@/selections/board'
import { fill, leftovers, toHtml, DEFAULT_TEMPLATES } from '@/selections/templates'

const e = (o: Record<string, unknown>) => ({ status: 'interested', birthYear: 2017, playingBirthYear: null, outcomeQueued: null, ...o }) as never

describe('selection board', () => {
  it('sorts entries into tabs', () => {
    expect(inTab(e({}), 'interest')).toBe(true)
    expect(inTab(e({ status: 'offered' }), 'picked')).toBe(true)
    expect(inTab(e({ status: 'unsuccessful' }), 'unsuccessful')).toBe(true)
    expect(inTab(e({ playingBirthYear: 2016 }), 'moved')).toBe(true)
    expect(inTab(e({ outcomeQueued: 'selected' }), 'queued')).toBe(true)
  })
  it('groups by the age group they play in, oldest first', () => {
    const g = groupByYear([e({ birthYear: 2018 }), e({ birthYear: 2017, playingBirthYear: 2016 }), e({ birthYear: 2016 })])
    expect(g.map((x) => [x.label, x.entries.length])).toEqual([['2016s', 2], ['2018s', 1]])
    expect(isMoved(e({ playingBirthYear: 2017 }))).toBe(false)
  })
  it('a pick means selected for tournaments and successful for Rowville', () => {
    expect(pickOutcome('tournament')).toBe('selected')
    expect(pickOutcome('rowville')).toBe('successful')
  })
  it('exports CSV safely', () => {
    expect(toCsv([{ name: 'Ava "Ace" Singh', note: 'a, b' }])).toBe('name,note\n"Ava ""Ace"" Singh","a, b"\n')
  })
})

describe('outcome templates', () => {
  it('fills placeholders and keeps unknown ones visible', () => {
    expect(fill('Hi {parent}, {player} → {team} {oops}', { parent: 'Kate', player: 'Oscar', team: '2016s Red' })).toBe('Hi Kate, Oscar → 2016s Red {oops}')
    expect(leftovers('Hi {parent} {oops}')).toEqual(['{parent}', '{oops}'])
  })
  it('turns text into safe paragraphs', () => {
    expect(toHtml('One <b>\n\nTwo')).toBe('One &lt;b&gt;<br><br>Two')
  })
  it('the default unsuccessful message uses the approved wording', () => {
    expect(DEFAULT_TEMPLATES.unsuccessful.body).toMatch(/^Thank you for trialling with Rowville Eagles/)
  })
})
