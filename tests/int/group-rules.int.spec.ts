import { describe, expect, it } from 'vitest'
import { cleanPlayer, firstNamesList, groupDeadline, reminderAt, rosterProblem, type RosterPlayer } from '@/academy/group-rules'

const now = new Date('2027-02-01T00:00:00Z')
const inH = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString()

describe('payment deadline', () => {
  it('is 48 hours from now when the session is well ahead', () => {
    expect(groupDeadline({ now, firstSessionAt: inH(24 * 10), hours: 48, cutoffHours: 24 })?.toISOString()).toBe(inH(48))
  })
  it('never runs past the booking cut-off before the first session', () => {
    expect(groupDeadline({ now, firstSessionAt: inH(60), hours: 48, cutoffHours: 24 })?.toISOString()).toBe(inH(36))
  })
  it('is refused when families would have under 2 hours to pay', () => {
    expect(groupDeadline({ now, firstSessionAt: inH(25), hours: 48, cutoffHours: 24 })).toBeNull()
    expect(groupDeadline({ now, firstSessionAt: inH(26), hours: 48, cutoffHours: 24 })?.toISOString()).toBe(inH(2))
  })
})

describe('reminder', () => {
  it('goes out the set hours before the deadline', () => {
    expect(reminderAt({ sentAt: now, deadline: new Date(inH(48)), hoursBefore: 12 })?.toISOString()).toBe(inH(36))
  })
  it('is skipped if it would fall before the group was sent, or is switched off', () => {
    expect(reminderAt({ sentAt: now, deadline: new Date(inH(10)), hoursBefore: 12 })).toBeNull()
    expect(reminderAt({ sentAt: now, deadline: new Date(inH(48)), hoursBefore: 0 })).toBeNull()
  })
})

const fresh = (first: string, email = `${first.toLowerCase()}@example.com`): RosterPlayer => ({ kind: 'new', playerFirstName: first, playerLastName: 'Smith', parentFirstName: 'Pat', parentLastName: 'Smith', email })

describe('roster', () => {
  it('needs 2 to 5 players', () => {
    expect(rosterProblem([fresh('Mia')])).toMatch(/2–5/)
    expect(rosterProblem([1, 2, 3, 4, 5, 6].map((i) => fresh(`P${i}`)))).toMatch(/2–5/)
    expect(rosterProblem([fresh('Mia'), { kind: 'existing', participantId: 4 }])).toBeNull()
  })
  it('checks new players’ details', () => {
    expect(rosterProblem([fresh('Mia'), { ...fresh('Leo'), email: 'nope' } as RosterPlayer])).toMatch(/Player 2: enter the parent’s email/)
    expect(rosterProblem([fresh('Mia'), { ...fresh('Leo'), mobile: '0312345678' } as RosterPlayer])).toMatch(/Australian mobile/)
    expect(rosterProblem([fresh('Mia'), { ...fresh('Leo'), playerLastName: '' } as RosterPlayer])).toMatch(/player’s first and last name/)
    expect(rosterProblem([fresh('Mia'), null])).toMatch(/Player 2: choose a player/)
  })
  it('the same player can’t be added twice — siblings with one parent email can', () => {
    expect(rosterProblem([{ kind: 'existing', participantId: 4 }, { kind: 'existing', participantId: 4 }])).toMatch(/Player 2 is already/)
    expect(rosterProblem([fresh('Mia', 'pat@example.com'), { ...fresh('mia ', 'pat@example.com') } as RosterPlayer])).toMatch(/already/)
    expect(rosterProblem([fresh('Mia', 'pat@example.com'), fresh('Leo', 'pat@example.com')])).toBeNull()
  })
  it('tidies form input', () => {
    expect(cleanPlayer({ kind: 'new', playerFirstName: ' Mia ', playerLastName: 'S', parentFirstName: 'P', parentLastName: 'S', email: ' PAT@Example.com ', mobile: '0412 345 678' })).toEqual({ kind: 'new', playerFirstName: 'Mia', playerLastName: 'S', parentFirstName: 'P', parentLastName: 'S', email: 'pat@example.com', mobile: '0412345678' })
    expect(cleanPlayer({ kind: 'existing', participantId: '7' })).toEqual({ kind: 'existing', participantId: 7 })
    expect(cleanPlayer({ kind: 'existing', participantId: 'x' })).toBeNull()
    expect(cleanPlayer('nope')).toBeNull()
  })
})

describe('other players’ names', () => {
  it('first names only', () => {
    expect(firstNamesList(['Mia Smith', 'Leo'])).toBe('Mia and Leo')
    expect(firstNamesList(['Mia', 'Leo', 'Ava Jones'])).toBe('Mia, Leo and Ava')
    expect(firstNamesList(['Mia'])).toBe('Mia')
    expect(firstNamesList([])).toBe('')
  })
})

import { playerProblem } from '@/academy/group-rules'
describe('one player', () => {
  it('checks a replacement player', () => {
    expect(playerProblem({ kind: 'existing', participantId: 3 })).toBeNull()
    expect(playerProblem(null)).toMatch(/Choose a player/)
    expect(playerProblem({ kind: 'new', playerFirstName: 'A', playerLastName: 'B', parentFirstName: 'C', parentLastName: 'D', email: 'bad' })).toMatch(/email/)
    expect(playerProblem({ kind: 'new', playerFirstName: 'A', playerLastName: 'B', parentFirstName: 'C', parentLastName: 'D', email: 'c@d.com', mobile: '0412345678' })).toBeNull()
  })
})
