import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { csvFilename, toCsv } from '@/lib/csv'
import { EXPORTS } from '@/lib/exports'

export const dynamic = 'force-dynamic'

/** Download any Management list as a CSV (Management only). */
export async function GET(req: Request, { params }: { params: Promise<{ list: string }> }) {
  const user = await managementOrNull()
  if (!user) return new Response('Management only', { status: 403 })
  const list = (await params).list
  // Money and pay exports are Finance (admins only)
  if (['money', 'finance-pay'].includes(list) && !user.roles?.includes('admin')) return new Response('Admins only', { status: 403 })
  const make = EXPORTS[list]
  if (!make) return new Response('Not found', { status: 404 })
  const out = await make(await payload(), new URL(req.url).searchParams)
  return new Response(toCsv(out.headers, out.rows), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${csvFilename(out.name)}"`, 'cache-control': 'private, no-store' },
  })
}
