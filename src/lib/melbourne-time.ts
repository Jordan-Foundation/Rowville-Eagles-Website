const TZ = 'Australia/Melbourne'

/** UTC offset (minutes) of Melbourne at a given instant, e.g. +660 in summer. */
function offsetMinutes(at: Date) {
  const part = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value // "GMT+11" / "GMT+10"
  const m = part?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return 600
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

/** Melbourne wall-clock date (YYYY-MM-DD) + time (HH:MM) → UTC Date (DST-aware). */
export function melbourneToUtc(ymd: string, hhmm: string): Date {
  const [y, mo, d] = ymd.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi))
  const first = new Date(guess.getTime() - offsetMinutes(guess) * 60000)
  return new Date(guess.getTime() - offsetMinutes(first) * 60000)
}

/** Melbourne calendar date (YYYY-MM-DD) for an instant. */
export function melbourneYmd(at: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const weekdayIndex = (day: string) => DAYS.indexOf(day)

/** Every Melbourne calendar date between two dates (inclusive) that falls on `day`. */
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
