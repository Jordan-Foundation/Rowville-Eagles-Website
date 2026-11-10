import { describe, expect, it } from 'vitest'
import { DATE_FIELDS, dateIssues, formatDateInput, parseDateInput } from '../../src/lib/dates-edit'

describe('Set dates — input parsing', () => {
  it('days are stored at the start/end of the Melbourne day (summer and winter)', () => {
    expect(parseDateInput(DATE_FIELDS['academy-terms.startDate'], '2027-02-01')).toBe('2027-01-31T13:00:00.000Z') // AEDT +11
    expect(parseDateInput(DATE_FIELDS['academy-terms.endDate'], '2027-07-01')).toBe('2027-07-01T13:59:00.000Z') // AEST +10
  })
  it('date-times are Melbourne local time', () => {
    expect(parseDateInput(DATE_FIELDS['trial-sessions.start'], '2027-03-02T17:30')).toBe('2027-03-02T06:30:00.000Z')
  })
  it('round-trips what the input shows', () => {
    const k = DATE_FIELDS['programs.startDate']
    expect(formatDateInput(k, parseDateInput(k, '2027-01-12T09:00') as string)).toBe('2027-01-12T09:00')
    const d = DATE_FIELDS['report-cycles.dueDate']
    expect(formatDateInput(d, parseDateInput(d, '2027-06-20') as string)).toBe('2027-06-20')
  })
  it('rejects bad input', () => {
    expect(() => parseDateInput(DATE_FIELDS['pdr-challenges.month'], '2027-13')).toThrow()
    expect(() => parseDateInput(DATE_FIELDS['g:site-settings.season'], '1999')).toThrow()
    expect(() => parseDateInput(DATE_FIELDS['selection-rounds.paymentDeadlineDays'], '3.5')).toThrow()
    expect(() => parseDateInput(DATE_FIELDS['trial-sessions.start'], 'tomorrow')).toThrow()
    expect(parseDateInput(DATE_FIELDS['programs.endDate'], '  ')).toBeNull()
  })
})

describe('Set dates — what needs attention', () => {
  const now = new Date('2027-03-01T00:00:00Z')
  const base = { now, terms: [], programs: [], cycles: [], season: 2027, expectedSeason: 2027 }
  it('flags no upcoming term, finished-but-open programs, overdue reports, old season', () => {
    const issues = dateIssues({
      ...base,
      terms: [{ id: 1, name: 'Term 1', status: 'open', startDate: '2027-01-31T13:00:00Z', endDate: '2027-04-01T12:00:00Z' }],
      programs: [
        { id: 2, name: 'Jan camp', type: 'holiday-camp', status: 'open', startDate: '2027-01-12T00:00:00Z', endDate: '2027-01-15T00:00:00Z', termLinked: false },
        { id: 3, name: 'Easter camp', type: 'holiday-camp', status: 'open', termLinked: false },
        { id: 4, name: 'Group term', type: 'academy-term', status: 'open', termLinked: true },
      ],
      cycles: [{ id: 5, name: 'Summer reports', status: 'open', dueDate: '2027-02-20T12:00:00Z', outstanding: 3 }],
      season: 2026,
    })
    expect(issues.map((i) => i.text)).toEqual([
      'The next school term timeframe isn’t set up yet.',
      'The school holidays after Term 1 aren’t set up yet — add them so coaches can give holiday availability.',
      'Jan camp finished but is still open for bookings.',
      'Easter camp is open but has no start date.',
      'Summer reports: due date has passed with 3 reports unfinished.',
      'Season is set to 2026 — change it to 2027 when the new season’s age groups start.',
    ])
  })
  it('holiday timeframes don’t count as the next term, but do cover the holidays after the current term', () => {
    const t1 = { id: 1, name: 'Term 1', status: 'open', category: 'school-term', startDate: '2027-01-31T13:00:00Z', endDate: '2027-04-01T12:00:00Z' }
    const april = { id: 2, name: 'April holidays', status: 'availability', category: 'school-holidays', startDate: '2027-04-02T13:00:00Z', endDate: '2027-04-18T13:59:00Z' }
    const t2 = { id: 3, name: 'Term 2', status: 'draft', category: 'school-term', startDate: '2027-04-18T14:00:00Z', endDate: '2027-06-25T13:59:00Z' }
    expect(dateIssues({ ...base, terms: [t1, april] }).map((i) => i.text)).toEqual(['The next school term timeframe isn’t set up yet.'])
    expect(dateIssues({ ...base, terms: [t1, t2] }).map((i) => i.text)).toEqual(['The school holidays after Term 1 aren’t set up yet — add them so coaches can give holiday availability.'])
    expect(dateIssues({ ...base, terms: [t1, april, t2] })).toEqual([])
  })
  it('nothing to fix', () => {
    expect(dateIssues({ ...base, terms: [{ id: 1, name: 'Term 2', status: 'open', startDate: '2027-04-19T14:00:00Z', endDate: '2027-06-27T13:59:00Z' }] })).toEqual([])
  })
})
