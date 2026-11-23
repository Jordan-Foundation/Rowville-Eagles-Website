import type { Payload } from 'payload'
import { localYmd, TZ } from '@/lib/time'
import { programPlace } from '@/lib/place'
import type { CalEvent } from '@/lib/ics'
import type { PublicEvent } from './calendar'

const q = { overrideAccess: true, depth: 0, pagination: false } as const

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-AU', { timeZone: TZ, ...o }).format(new Date(iso))
const time = (iso: string) => fmt(iso, { hour: 'numeric', minute: '2-digit' }).replace(':00', '').toLowerCase()
const dayLabel = (iso: string) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' })

function shape(o: { uid: string; title: string; start: string; end?: string | null; allDay?: boolean | null; location?: string | null; summary?: string | null; details?: string | null; link?: string | null; linkLabel?: string | null; category?: string | null }): PublicEvent {
  const startYmd = localYmd(new Date(o.start))
  const endYmd = o.end ? localYmd(new Date(o.end)) : startYmd
  const multi = endYmd > startYmd
  return {
    uid: o.uid,
    title: o.title,
    start: o.start,
    end: o.end ?? null,
    allDay: Boolean(o.allDay),
    startYmd,
    endYmd: endYmd < startYmd ? startYmd : endYmd,
    timeLabel: o.allDay ? (multi ? 'All day, each day' : 'All day') : `${time(o.start)}${o.end ? ` – ${time(o.end)}` : ''}`,
    dateLabel: multi ? `${dayLabel(o.start)} – ${dayLabel(o.end!)}` : fmt(o.start, { weekday: 'long', day: 'numeric', month: 'long' }),
    location: o.location ?? null,
    summary: o.summary ?? null,
    details: o.details ?? null,
    link: o.link ?? null,
    linkLabel: o.linkLabel ?? null,
    category: o.category ?? 'club',
  }
}

/** Every public event from `from` on: the club's events plus holiday camps (from Programs). */
export async function publicEvents(p: Payload, from = new Date(Date.now() - 62 * 86_400_000)) {
  const fromIso = from.toISOString()
  const [{ docs: events }, { docs: camps }, settings] = await Promise.all([
    p.find({ collection: 'events', where: { published: { equals: true }, or: [{ start: { greater_than_equal: fromIso } }, { end: { greater_than_equal: fromIso } }] }, sort: 'start', limit: 1000, ...q }),
    p.find({ collection: 'programs', where: { type: { equals: 'holiday-camp' }, status: { not_equals: 'draft' }, startDate: { exists: true }, or: [{ startDate: { greater_than_equal: fromIso } }, { endDate: { greater_than_equal: fromIso } }] }, sort: 'startDate', limit: 200, ...q }),
    p.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null),
  ])
  const out: PublicEvent[] = events.map((e) => shape({ uid: `e-${e.id}`, title: e.title, start: e.start, end: e.end, allDay: e.allDay, location: e.location, summary: e.summary, details: e.details, link: e.link, linkLabel: e.linkLabel, category: e.category }))
  for (const c of camps) {
    out.push(shape({
      uid: `camp-${c.id}`,
      title: c.title,
      start: c.startDate!,
      end: c.endDate ?? c.startDate,
      allDay: true,
      location: programPlace(c.location, settings?.ground?.address).place,
      summary: c.summary ?? 'Holiday camp',
      details: [c.summary, c.ageRange && `Ages: ${c.ageRange}`, c.scheduleNote].filter(Boolean).join('\n'),
      link: `/programs/${c.slug}`,
      linkLabel: 'Details & book',
      category: c.brand === 'academy' ? 'academy' : 'juniors',
    }))
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/** For the calendar feed (.ics). */
export const toCal = (e: PublicEvent, base: string): CalEvent => ({
  uid: `${e.uid}@rowvilleeagles`,
  title: e.title,
  start: e.start,
  end: e.end,
  allDay: e.allDay,
  location: e.location,
  description: [e.details || e.summary, e.link && `${e.link.startsWith('/') ? base + e.link : e.link}`].filter(Boolean).join('\n\n') || null,
  url: e.link ? (e.link.startsWith('/') ? base + e.link : e.link) : `${base}/events`,
})
