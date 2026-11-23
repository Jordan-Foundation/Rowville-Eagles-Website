/** Events calendar helpers (pure — unit tested). Dates are local (YYYY-MM-DD) in the club's time zone. */

export type PublicEvent = {
  uid: string
  title: string
  start: string // ISO
  end: string | null
  allDay: boolean
  startYmd: string
  endYmd: string
  timeLabel: string // "6:30 pm – 9:00 pm" or "All day"
  dateLabel: string // "Fri 12 Dec" or "Mon 12 – Fri 16 Jan"
  location: string | null
  summary: string | null
  details: string | null
  link: string | null
  linkLabel: string | null
  category: string
}

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The weeks shown for a month (Monday first), each a list of 7 dates; days outside the month included. */
export function monthGrid(ym: string): string[][] {
  const first = `${ym}-01`
  const dow = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
  let cur = addDays(first, -dow)
  const weeks: string[][] = []
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cur, i)))
    cur = addDays(cur, 7)
  } while (cur.slice(0, 7) === ym)
  return weeks
}

export const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

/** Events on a local date (multi-day events appear on every day they cover). */
export const eventsOn = (ymd: string, events: PublicEvent[]) => events.filter((e) => e.startYmd <= ymd && e.endYmd >= ymd)

/** "Looking ahead": events starting more than a month from today, soonest first. */
export function lookingAhead(events: PublicEvent[], todayYmd: string, limit = 12) {
  const cutoff = shiftMonth(todayYmd.slice(0, 7), 1) + todayYmd.slice(7)
  return events.filter((e) => e.startYmd > cutoff).sort((a, b) => a.start.localeCompare(b.start)).slice(0, limit)
}

/** Google Calendar "add this event" link. */
export function googleEventLink(e: Pick<PublicEvent, 'title' | 'start' | 'end' | 'allDay' | 'startYmd' | 'endYmd' | 'location' | 'details' | 'summary'>) {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const dates = e.allDay ? `${e.startYmd.replace(/-/g, '')}/${addDays(e.endYmd, 1).replace(/-/g, '')}` : `${stamp(e.start)}/${stamp(e.end ?? new Date(new Date(e.start).getTime() + 3_600_000).toISOString())}`
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, ...(e.location ? { location: e.location } : {}), ...(e.details || e.summary ? { details: (e.details || e.summary)! } : {}) })
  return `https://calendar.google.com/calendar/render?${q}`
}
