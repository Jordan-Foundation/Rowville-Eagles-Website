import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { loadAudience, SOURCES } from '@/lib/audience'
import { heardFromLabel } from '@/tracking/heard'

export const dynamic = 'force-dynamic'

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** Families who opted in to marketing (email or text) — the only list that may be used for marketing. */
export async function GET() {
  const me = await managementOrNull()
  if (!me) return new Response('Forbidden', { status: 403 })
  const all = (await loadAudience(await payload())).filter((c) => c.marketingEmail || c.marketingSms)
  const rows = [['Name', 'Email', 'Mobile', 'Marketing email', 'Marketing text', 'Came from', 'Heard about us', 'Players', 'First seen']]
  for (const c of all) rows.push([c.name, c.email, c.marketingSms ? c.phone : '', c.marketingEmail ? 'yes' : 'no', c.marketingSms ? 'yes' : 'no', c.sources.map((k) => SOURCES[k]).join('; '), c.heardFrom.map(heardFromLabel).join('; '), c.players.map((x) => `${x.name}${x.birthYear ? ` (${x.birthYear})` : ''}`).join('; '), c.firstSeen.slice(0, 10)])
  return new Response(rows.map((r) => r.map(cell).join(',')).join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="audience-opted-in-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } })
}
