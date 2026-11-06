/** Every date/time in the app is shown and calculated in this zone (stored as UTC). */
export const TZ = 'Australia/Sydney'

/** UTC offset (minutes) of the app time zone at a given instant, e.g. +660 in summer. */
function offsetMinutes(at: Date) {
  const part = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value // "GMT+11" / "GMT+10"
  const m = part?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return 600
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

/** Local wall-clock date (YYYY-MM-DD) + time (HH:MM) → UTC Date (DST-aware). */
export function localToUtc(ymd: string, hhmm: string): Date {
  const [y, mo, d] = ymd.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi))
  const first = new Date(guess.getTime() - offsetMinutes(guess) * 60000)
  return new Date(guess.getTime() - offsetMinutes(first) * 60000)
}

/** Local calendar date (YYYY-MM-DD) for an instant. */
export function localYmd(at: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const weekdayIndex = (day: string) => DAYS.indexOf(day)

/** Every local calendar date between two dates (inclusive) that falls on `day`. */
export function datesOnWeekday(fromYmd: string, toYmd: string, day: string): string[] {
  const target = weekdayIndex(day)
  const out: string[] = []
  const cur = new Date(`${fromYmd}T00:00:00Z`)
  const end = new Date(`${toYmd}T00:00:00Z`)
  while (cur <= end) {
    if (cur.getUTCDay() === target) out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

/** Local weekday name and "HH:MM" of an instant, e.g. { weekday: 'Tuesday', time: '17:00' }. */
export function localWeekdayTime(at: Date | string) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(at))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { weekday: get('weekday'), time: `${get('hour')}:${get('minute')}` }
}
