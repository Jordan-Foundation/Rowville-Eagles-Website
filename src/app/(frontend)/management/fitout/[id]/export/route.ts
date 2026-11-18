import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { fitoutRows, fitoutWorkbook } from '@/numbers/fitout'

export const dynamic = 'force-dynamic'

/** The kit order as .xlsx; exported rows are stamped so later additions can go in a top-up order. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await managementOrNull())) return new Response('Forbidden', { status: 403 })
  const { id } = await params
  const p = await payload()
  const session = await p.findByID({ collection: 'fitout-sessions', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!session) return new Response('Not found', { status: 404 })
  const sp = new URL(req.url).searchParams
  const data = await fitoutRows(p, session.id, { program: sp.get('program') || undefined, team: sp.get('team') || undefined, birthYear: sp.get('birthYear') || undefined, notExported: sp.get('notExported') === '1' })
  const file = await fitoutWorkbook(session.name, data)
  const now = new Date().toISOString()
  for (const r of data.rows) await p.update({ collection: 'fitout-entries', id: r.entryId, data: { exportedAt: now }, overrideAccess: true })
  const name = `${session.name.replace(/[^\w -]+/g, '').replace(/\s+/g, '-').toLowerCase()}-kit-order.xlsx`
  return new Response(new Uint8Array(file), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } })
}
