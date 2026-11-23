import { payload } from '@/lib/payload'
import { icsFile } from '@/lib/ics'
import { siteBase } from '@/lib/seo'
import { publicEvents, toCal } from '@/site/events'

export const dynamic = 'force-dynamic'

/** One event as a calendar file ("Add to my calendar"). */
export async function GET(_req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const uid = (await params).uid.replace(/\.ics$/, '')
  if (!/^(e|camp)-\d+$/.test(uid)) return new Response('Not found', { status: 404 })
  const e = (await publicEvents(await payload(), new Date(0))).find((x) => x.uid === uid)
  if (!e) return new Response('Not found', { status: 404 })
  return new Response(icsFile([toCal(e, siteBase())], e.title), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${uid}.ics"` },
  })
}
