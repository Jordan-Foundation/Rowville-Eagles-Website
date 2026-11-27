import { describe, expect, it } from 'vitest'
import { addMinutes, ageGroupOf, lengthFor, minutesBetween } from '@/academy/session-lengths'
import { slotSessions } from '@/academy/terms/slots'
import { dueReminder, reminderText, sessionKey, type TrialSession } from '@/academy/trial-list'
import { inviteSms, openPlaces, squadCounts } from '@/tournaments/service'

describe('session length by age group', () => {
  const rules = [{ ageGroup: 'U7', minutes: 60 }]
  it('U7 = turns 7 that year (season − year of birth)', () => {
    expect(ageGroupOf(2019, 2026)).toBe('U7')
    expect(ageGroupOf(2020, 2027)).toBe('U7')
    expect(ageGroupOf(2021, 2027)).toBe('U6')
  })
  it('applies only when every year in the slot is in the group', () => {
    expect(lengthFor([2019], 2026, rules)).toBe(60)
    expect(lengthFor([2019, 2018], 2026, rules)).toBeNull() // U7 + U8 together: left alone
    expect(lengthFor([2017], 2026, rules)).toBeNull() // other age groups unchanged
    expect(lengthFor([], 2026, rules)).toBeNull()
  })
  it('works out the new finish time', () => {
    expect(addMinutes('16:30', 60)).toBe('17:30')
    expect(minutesBetween('16:30', '17:45')).toBe(75)
  })
  it('weeks before a mid-term change keep the old finish time (history + pay unchanged)', () => {
    const slot = { id: 1, weekday: 'Tuesday', startTime: '16:30', endTime: '17:30', previousEndTime: '17:45', previousEndUntil: '2026-11-17T00:00:00.000Z' }
    const s = slotSessions(slot, { startDate: '2026-11-03T00:00:00.000Z', endDate: '2026-11-25T00:00:00.000Z' })
    const len = (x: { startsAt: string; endsAt: string }) => (new Date(x.endsAt).getTime() - new Date(x.startsAt).getTime()) / 60000
    expect(s.filter((x) => x.date < '2026-11-17').every((x) => len(x) === 75)).toBe(true)
    expect(s.filter((x) => x.date >= '2026-11-17').every((x) => len(x) === 60)).toBe(true)
  })
})

describe('RFA trial reminders', () => {
  const start = '2026-12-01T05:30:00.000Z' // Tue 4:30pm Melbourne
  const at = (hoursBefore: number) => new Date(new Date(start).getTime() - hoursBefore * 3_600_000)
  it('1 day, 3 hours, 15 minutes', () => {
    expect(dueReminder(start, at(30))).toBeNull()
    expect(dueReminder(start, at(23))?.key).toBe('1d')
    expect(dueReminder(start, at(2.9))?.key).toBe('3h')
    expect(dueReminder(start, at(0.2))?.key).toBe('15m')
    expect(dueReminder(start, at(-0.1))).toBeNull()
  })
  it('a late booking only gets the reminder still to come', () => {
    expect(dueReminder(start, at(2))?.key).toBe('3h') // booked 2 hours before: the 1-day one is skipped
  })
  it('one message per session listing the players', () => {
    const s: TrialSession = { key: sessionKey(5, start), startsAt: start, ymd: '2026-12-01', program: 'Academy Term 4', programId: 5, venue: 'Rowville', coaches: [], players: [
      { bookingId: 1, name: 'Sam Kerr', short: 'Sam K', birthYear: 2016, ageGroup: 'U11', reference: null },
      { bookingId: 2, name: 'Mia Lee', short: 'Mia L', birthYear: 2016, ageGroup: 'U11', reference: null },
    ] }
    expect(reminderText(s, at(3))).toBe('U11 RFA, today 4:30pm, Rowville: 2 trial players attending — Sam K (2016), Mia L (2016).')
  })
})

describe('tournament squads', () => {
  const inv = (status: string) => ({ status }) as never
  it('counts', () => {
    const c = squadCounts([inv('invited'), inv('accepted'), inv('paid'), inv('declined'), inv('expired')])
    expect(c).toEqual({ invited: 5, accepted: 2, paid: 1, declined: 1, noResponse: 1, expired: 1 })
  })
  it('never invites past the squad size; declined/expired places free up', () => {
    expect(openPlaces(3, [inv('invited'), inv('accepted'), inv('declined')])).toBe(1)
    expect(openPlaces(2, [inv('paid'), inv('invited'), inv('expired')])).toBe(0)
  })
  it('invite text: who, squad, tournament, date, reply-by and the link — short enough for 2 SMS parts', () => {
    const o = { first: 'Ava', squad: 'U10 Blue', tournament: 'Easter Cup', when: 'Sat 3 Apr', replyBy: 'Thu, 25 Mar 5pm', url: 'https://www.rowvilleeagles.com.au/tournaments/invite/abcdefghijklmnopqrstuvwx' }
    const invite = inviteSms({ kind: 'invite', ...o })
    expect(invite).toBe('Foundation Academy: Ava is invited to play for us in U10 Blue at Easter Cup (Sat 3 Apr). Please accept or decline by Thu, 25 Mar 5pm: https://www.rowvilleeagles.com.au/tournaments/invite/abcdefghijklmnopqrstuvwx')
    expect(invite.length).toBeLessThanOrEqual(306)
    const reminder = inviteSms({ kind: 'reminder', ...o })
    expect(inviteSms({ kind: 'invite', ...o, squad: 'Girls’ U12 – Gold', when: 'Sat\u00A03 Apr' })).toMatch(/^[\x20-\x7E]+$/)
    expect(reminder).toMatch(/^Foundation Academy reminder: we haven't had a reply about Ava playing in U10 Blue at Easter Cup \(Sat 3 Apr\)\. Please accept or decline by Thu, 25 Mar 5pm: https:\/\/\S+invite\/abcdefghijklmnopqrstuvwx$/)
  })
})
