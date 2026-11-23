import { describe, expect, it } from 'vitest'
import { dayWord, recoveryDue, timeWord, trialEnrolDue, trialNudgeDue, trialReminderDue } from '../../src/lib/follow-up-rules'
import { makeFollowToken, readFollowToken } from '../../src/lib/follow-up-token'
import { programSchedule } from '../../src/lib/camps'

process.env.PAYLOAD_SECRET ||= 'unit-test-secret'
// Melbourne/Sydney summer time is UTC+11
const at = (local: string) => new Date(`${local}+11:00`)
const H = 3_600_000

describe('trial reminder (day before)', () => {
  const start = at('2026-11-25T17:30:00')
  const created = at('2026-11-20T10:00:00')
  it('goes the day before, in the daytime', () => {
    expect(trialReminderDue({ start, created, now: at('2026-11-24T16:07:00') })).toBe(true)
    expect(trialReminderDue({ start, created, now: at('2026-11-24T17:07:00') })).toBe(true)
  })
  it('not more than 26 hours ahead, not in the last 3 hours, not at night', () => {
    expect(trialReminderDue({ start, created, now: at('2026-11-24T08:07:00') })).toBe(false)
    expect(trialReminderDue({ start, created, now: at('2026-11-25T15:07:00') })).toBe(false)
    expect(trialReminderDue({ start: at('2026-11-25T09:00:00'), created, now: at('2026-11-24T21:07:00') })).toBe(false)
  })
  it('not for a trial booked the same day (the confirmation is enough)', () => {
    expect(trialReminderDue({ start, created: at('2026-11-25T08:00:00'), now: at('2026-11-25T10:07:00') })).toBe(false)
  })
})

describe('after the trial', () => {
  const start = at('2026-11-24T17:30:00')
  it('enrol email from the next morning, daytime only, up to two weeks', () => {
    expect(trialEnrolDue({ start, now: at('2026-11-24T19:07:00') })).toBe(false)
    expect(trialEnrolDue({ start, now: at('2026-11-25T06:07:00') })).toBe(false)
    expect(trialEnrolDue({ start, now: at('2026-11-25T09:07:00') })).toBe(true)
    expect(trialEnrolDue({ start, now: at('2026-12-10T10:07:00') })).toBe(false)
  })
  it('last reminder 4 days after the enrol email', () => {
    const sent = at('2026-11-25T09:07:00')
    expect(trialNudgeDue({ enrolSentAt: sent, now: at('2026-11-28T10:07:00') })).toBe(false)
    expect(trialNudgeDue({ enrolSentAt: sent, now: at('2026-11-29T10:07:00') })).toBe(true)
  })
})

describe('unfinished booking', () => {
  const created = at('2026-11-24T12:00:00')
  it('one hour to two days later, daytime', () => {
    expect(recoveryDue({ created, now: new Date(created.getTime() + 30 * 60_000) })).toBe(false)
    expect(recoveryDue({ created, now: new Date(created.getTime() + 61 * 60_000) })).toBe(true)
    expect(recoveryDue({ created: at('2026-11-24T22:00:00'), now: at('2026-11-24T23:30:00') })).toBe(false)
    expect(recoveryDue({ created, now: new Date(created.getTime() + 49 * H) })).toBe(false)
  })
})

describe('wording', () => {
  it('today / tomorrow / weekday and 12-hour times', () => {
    const now = at('2026-11-24T10:00:00')
    expect(dayWord(at('2026-11-24T17:30:00'), now)).toBe('today')
    expect(dayWord(at('2026-11-25T17:30:00'), now)).toBe('tomorrow')
    expect(dayWord(at('2026-11-27T17:30:00'), now)).toBe('Friday')
    expect(timeWord(at('2026-11-25T17:30:00'))).toBe('5:30pm')
    expect(timeWord(at('2026-11-25T09:00:00'))).toBe('9am')
  })
})

describe('signed follow-up links', () => {
  it('round trip, and edits are refused', () => {
    const t = makeFollowToken('RFA-ABC123')
    expect(readFollowToken(t)).toBe('RFA-ABC123')
    expect(readFollowToken(t.replace('ABC123', 'ABC124'))).toBeNull()
    expect(readFollowToken('RFA-ABC123.nope')).toBeNull()
    expect(readFollowToken(undefined)).toBeNull()
  })
})

describe('camp schedule from the camp days', () => {
  const day = (date: string, endTime = '15:30') => ({ date: `${date}T00:00:00.000Z`, startTime: '09:00', endTime })
  it('"3 days · 9am–3:30pm" whatever the typed note says', () => {
    expect(programSchedule({ type: 'holiday-camp', scheduleNote: '3 days · 9am–3pm', campDays: [day('2027-01-20'), day('2027-01-21'), day('2027-01-22')] })).toBe('3 days · 9am–3:30pm')
  })
  it('new camps default to 3:30pm; mixed hours say so; other programs keep their note', () => {
    expect(programSchedule({ type: 'holiday-camp', startDate: '2027-01-19T13:00:00.000Z', endDate: '2027-01-20T13:00:00.000Z' })).toBe('2 days · 9am–3:30pm')
    expect(programSchedule({ type: 'holiday-camp', campDays: [day('2027-01-20'), day('2027-01-21', '12:00')] })).toBe('2 days · hours vary by day')
    expect(programSchedule({ type: 'academy-term', scheduleNote: 'Tuesdays 5–6pm' })).toBe('Tuesdays 5–6pm')
  })
})

describe('follow-up links stay private', () => {
  it('never sent to Meta/Google', async () => {
    const { isTrackable } = await import('../../src/tracking/config')
    expect(isTrackable('/trial-details/RFA-1.abc', null)).toBe(false)
    expect(isTrackable('/follow-ups/stop/RFA-1.abc', null)).toBe(false)
    expect(isTrackable('/programs/camp/book', new URLSearchParams('resume=RFA-1.abc'))).toBe(false)
    expect(isTrackable('/programs/camp/book', new URLSearchParams(''))).toBe(true)
  })
})
