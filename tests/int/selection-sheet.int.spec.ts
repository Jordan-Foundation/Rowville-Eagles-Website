import { describe, expect, it } from 'vitest'
import { sheetGroups, sheetsFor } from '../../src/selections/sheet'

const rules = { season: 2027, miniMin: 6, miniMax: 11, maxDown: 2, warnDown: 2 }

describe('selection trial sheet', () => {
  it('one group per age group (youngest first), names sorted, year of birth and parent contact', () => {
    const g = sheetGroups(
      [
        { firstName: 'Zoe', lastName: 'Ng', dateOfBirth: '2017-04-02', birthYear: 2017, parentFirst: 'Kim', parentLast: 'Ng', phone: '0400 111 222' },
        { firstName: 'Ava', lastName: 'Lee', dateOfBirth: '2017-09-09', birthYear: 2017, parentFirst: 'Jo', parentLast: 'Lee', phone: '0400 333 444' },
        { firstName: 'Max', lastName: 'Day', dateOfBirth: '2015-01-01', birthYear: 2015, parentFirst: 'Sam', parentLast: 'Day', phone: ' 0400 555 666 ' },
      ],
      rules,
    )
    expect(g.map((x) => x.title)).toEqual(['U10 · born 2017', 'U12 · born 2015'])
    expect(g[0].rows.map((r) => r.name)).toEqual(['Ava Lee', 'Zoe Ng'])
    expect(g[1].rows[0]).toEqual({ name: 'Max Day', born: 2015, group: 'U12', parent: 'Sam Day', phone: '0400 555 666' })
    // Everyone on one sheet (the default): youngest group first, then by name
    const one = sheetsFor(g, 'combined', [], rules)
    expect(one).toHaveLength(1)
    expect(one[0].title).toBe('U10 · U12')
    expect(one[0].rows.map((r) => `${r.group} ${r.name}`)).toEqual(['U10 Ava Lee', 'U10 Zoe Ng', 'U12 Max Day'])
    expect(sheetsFor(g, 'groups', [], rules)).toHaveLength(2)
  })
  it('a player moved to another group appears there, with their real year of birth', () => {
    const g = sheetGroups([{ firstName: 'Up', lastName: 'One', dateOfBirth: '2018-02-02', birthYear: 2018, playingBirthYear: 2017 }], rules)
    expect(g[0].title).toBe('U10 · born 2017')
    expect(g[0].rows[0].born).toBe(2018)
  })
})

describe('an empty trial', () => {
  it('still prints: one blank sheet, or one per age group', () => {
    expect(sheetsFor([], 'combined', [2019, 2018], rules).map((x) => [x.title, x.rows.length])).toEqual([['U8 · U9', 0]])
    expect(sheetsFor([], 'groups', [2019, 2018], rules).map((x) => x.title)).toEqual(['U8 · born 2019', 'U9 · born 2018'])
  })
})
