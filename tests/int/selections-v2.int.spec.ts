import { describe, expect, it } from 'vitest'
import { finaliseWarnings, isSuccessful, isTrialist, isUnsuccessful, notPaid, positionGroupOf, prefTags, prefsEditable, SURVEY_WORDING, teamCounts, trialistStage, kindOf, programOf } from '@/selections/flow'
import { DEFAULT_TEMPLATES, OLD_DEFAULTS, fill } from '@/selections/templates'

type S = Parameters<typeof isTrialist>[0]
const e = (status: string, outcomeQueued: string | null = null, extra: Partial<S> = {}) => ({ status, outcomeQueued, ...extra }) as S

describe('trialist → outcome', () => {
  it('a trialist is someone without an outcome', () => {
    expect(isTrialist(e('interested'))).toBe(true)
    expect(isTrialist(e('attended'))).toBe(true)
    expect(isTrialist(e('attended', null, { needsAnotherTrial: true }))).toBe(true) // needs another trial stays on the page
    expect(isTrialist(e('attended', 'successful'))).toBe(false)
    expect(isTrialist(e('attended', 'unsuccessful'))).toBe(false)
  })
  it('successful (queued or sent) → Selected page; unsuccessful → archive', () => {
    expect(isSuccessful(e('attended', 'successful'))).toBe(true)
    expect(isSuccessful(e('offered'))).toBe(true)
    expect(isSuccessful(e('registered'))).toBe(true)
    expect(isSuccessful(e('interested', 'selected'))).toBe(true)
    expect(isUnsuccessful(e('attended', 'unsuccessful'))).toBe(true)
    expect(isUnsuccessful(e('unsuccessful'))).toBe(true)
  })
  it('stages', () => {
    expect(trialistStage(e('interested'), [])).toBe('registered')
    expect(trialistStage(e('trial-booked'), [{ session: 1, attended: false, start: '' }])).toBe('invited')
    expect(trialistStage(e('trial-booked'), [{ session: 1, attended: true, start: '' }])).toBe('attended')
    expect(trialistStage(e('attended', null, { needsAnotherTrial: true }), [])).toBe('another_trial')
  })
  it('program filter maps to round kinds', () => {
    expect(kindOf('rfa')).toBe('tournament')
    expect(kindOf('eagles')).toBe('rowville')
    expect(programOf('tournament')).toBe('rfa')
  })
})

describe('depth chart cards', () => {
  it('NP only for players who haven’t paid; nothing for paid players', () => {
    expect(notPaid({ status: 'offered' })).toBe(true)
    expect(notPaid({ status: 'attended' })).toBe(true) // offer not sent yet
    expect(notPaid({ status: 'registered' })).toBe(false)
  })
  it('survey answers become small tags and team counts', () => {
    expect(prefTags({ prefs: { trainingNights: 'mon_wed', gameDay: 'sat', answeredAt: 'x' } })).toEqual(['Mon/Wed', 'Sat'])
    expect(prefTags({ prefs: { trainingNights: 'none', gameDay: 'sun' } })).toEqual(['Sun'])
    expect(prefTags({})).toEqual([])
    const c = teamCounts([{ prefs: { trainingNights: 'mon_wed', gameDay: 'sat', answeredAt: 'x' } }, { prefs: { trainingNights: 'tue_thu', gameDay: 'sat', answeredAt: 'x' } }, {}])
    expect(c).toEqual({ players: 3, monWed: 1, tueThu: 1, sat: 2, sun: 0, unanswered: 1 })
  })
  it('positions from free text', () => {
    expect(positionGroupOf('Goalkeeper')).toBe('gk')
    expect(positionGroupOf('centre back')).toBe('def')
    expect(positionGroupOf('Midfield')).toBe('mid')
    expect(positionGroupOf('Striker')).toBe('fwd')
    expect(positionGroupOf('')).toBeNull()
  })
})

describe('finalising and the survey', () => {
  const p = (status: string, first: string) => ({ status, player: { firstName: first, lastName: 'X', dateOfBirth: '2016-01-01' } }) as Parameters<typeof finaliseWarnings>[0]['players'][number]
  it('warns about unpaid players, no coach, and no coach message', () => {
    const w = finaliseWarnings({ players: [p('registered', 'Ava'), p('offered', 'Ben')], coachName: null, welcome: null })
    expect(w.join(' ')).toMatch(/1 player hasn’t paid yet \(NP\): Ben/)
    expect(w.join(' ')).toMatch(/No coach assigned/)
    expect(finaliseWarnings({ players: [p('registered', 'Ava')], coachName: 'Sam', welcome: '' }).join(' ')).toMatch(/Sam hasn’t written a welcome message/)
    expect(finaliseWarnings({ players: [p('registered', 'Ava')], coachName: 'Sam', welcome: 'Hi!' })).toEqual([])
  })
  it('preferences are editable until the team is finalised', () => {
    expect(prefsEditable(null)).toBe(true)
    expect(prefsEditable({ finalisedAt: null })).toBe(true)
    expect(prefsEditable({ finalisedAt: '2027-01-01' })).toBe(false)
  })
  it('survey wording says it can’t be guaranteed', () => {
    expect(SURVEY_WORDING).toMatch(/can’t be guaranteed/)
  })
})

describe('outcome templates', () => {
  it('unsuccessful is encouraging and links to RFA terms, camps and 1-on-1s', () => {
    const body = fill(DEFAULT_TEMPLATES.unsuccessful.body, { parent: 'Jo', player: 'Ava', ageGroup: '2016s', siteUrl: 'https://x' })
    expect(body).toMatch(/^Thank you for trialling with Rowville Eagles/)
    expect(body).toMatch(/https:\/\/x\/programs\?type=academy-term/)
    expect(body).toMatch(/holiday-camp/)
    expect(body).toMatch(/1-on-1/)
  })
  it('successful explains next steps and doesn’t need a team yet', () => {
    expect(DEFAULT_TEMPLATES.successful.body).not.toMatch(/\{team\}/)
    expect(DEFAULT_TEMPLATES.successful.body).toMatch(/\{deadline\}/)
    expect(OLD_DEFAULTS.successful.body).toMatch(/\{team\}/)
  })
})
