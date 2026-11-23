import { describe, expect, it } from 'vitest'
import { eventsOn, googleEventLink, lookingAhead, monthGrid, shiftMonth, type PublicEvent } from '@/site/calendar'

const ev = (uid: string, startYmd: string, endYmd = startYmd, extra: Partial<PublicEvent> = {}): PublicEvent => ({
  uid, title: uid, start: `${startYmd}T08:00:00.000Z`, end: null, allDay: false, startYmd, endYmd, timeLabel: '', dateLabel: '', location: null, summary: null, details: null, link: null, linkLabel: null, category: 'club', ...extra,
})

describe('events calendar', () => {
  it('month grid starts on Monday and covers the whole month', () => {
    const w = monthGrid('2026-11')
    expect(w[0][0]).toBe('2026-10-26') // Mon before Sun 1 Nov
    expect(w.at(-1)!.at(-1)).toBe('2026-12-06')
    expect(w.every((x) => x.length === 7)).toBe(true)
    expect(monthGrid('2027-02').flat()).toContain('2027-02-28')
  })
  it('shifts months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2027-01', -1)).toBe('2026-12')
  })
  it('multi-day events show on each day they cover', () => {
    const camp = ev('camp', '2027-01-12', '2027-01-14')
    expect(eventsOn('2027-01-13', [camp])).toHaveLength(1)
    expect(eventsOn('2027-01-15', [camp])).toHaveLength(0)
  })
  it('looking ahead: only events more than a month away, soonest first', () => {
    const list = lookingAhead([ev('soon', '2026-12-10'), ev('far2', '2027-03-01'), ev('far1', '2027-01-05')], '2026-11-23')
    expect(list.map((e) => e.uid)).toEqual(['far1', 'far2'])
  })
  it('Google Calendar link: all-day end is the day after', () => {
    const url = googleEventLink(ev('camp', '2027-01-12', '2027-01-14', { allDay: true, title: 'Camp' }))
    expect(url).toContain('dates=20270112%2F20270115')
    expect(url).toContain('text=Camp')
  })
})
