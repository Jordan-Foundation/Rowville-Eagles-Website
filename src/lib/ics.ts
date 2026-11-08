/** Calendar (.ics) files for bookings (pure — unit tested). */
export type CalEvent = { uid: string; title: string; start: string; end?: string | null; allDay?: boolean; location?: string | null; description?: string | null; url?: string }

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const day = (iso: string, addDays = 0) => {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }))
  d.setDate(d.getDate() + addDays)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
/** Lines longer than 75 characters are folded (RFC 5545). */
const fold = (line: string) => line.match(/.{1,74}/g)!.join('\r\n ')

export function icsFile(events: CalEvent[], name = 'Rowville Eagles') {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rowville Eagles FC//Bookings//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`]
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp(new Date().toISOString())}`)
    if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${day(e.start)}`, `DTEND;VALUE=DATE:${day(e.end ?? e.start, 1)}`)
    else lines.push(`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end ?? new Date(new Date(e.start).getTime() + 3_600_000).toISOString())}`)
    lines.push(`SUMMARY:${esc(e.title)}`)
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
