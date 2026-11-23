import { payload } from '@/lib/payload'
import { icsFile } from '@/lib/ics'
import { siteBase } from '@/lib/seo'
import { publicEvents, toCal } from '@/site/events'

export const revalidate = 900

/** The club's events as a calendar feed (subscribe once; calendars re-check it automatically). */
export async function GET() {
  const events = await publicEvents(await payload(), new Date(Date.now() - 180 * 86_400_000))
  const base = siteBase()
  return new Response(icsFile(events.map((e) => toCal(e, base)), 'Rowville Eagles events'), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="rowville-eagles-events.ics"', 'Cache-Control': 'public, max-age=900' },
  })
}
