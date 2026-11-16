import { financeOrNull } from '@/finance/access'
import { payload } from '@/lib/payload'
import { csvFilename, toCsv } from '@/lib/csv'
import { mondayOf } from '@/finance/rules'
import { weekPay } from '@/finance/pay'
import { payCsvRows, payWorkbook } from '@/finance/export'
import { localYmd } from '@/lib/time'

export const dynamic = 'force-dynamic'

/** Weekly pay as XLSX (summary, lines, Xero Payroll sheet) or CSV. Admins only. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await financeOrNull())) return new Response('Admins only', { status: 403 })
  const kind = (await params).kind
  const wk = new URL(req.url).searchParams.get('week') ?? ''
  const week = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(wk) ? wk : localYmd(new Date()))
  const w = await weekPay(await payload(), week)
  const headers = { 'cache-control': 'private, no-store' }
  if (kind === 'pay.xlsx') {
    return new Response(new Uint8Array(await payWorkbook(w)), { headers: { ...headers, 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="coach-pay-${week}.xlsx"` } })
  }
  if (kind === 'pay.csv') {
    const t = payCsvRows(w)
    return new Response(toCsv(t.headers, t.rows), { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${csvFilename(`coach-pay-${week}`)}"` } })
  }
  return new Response('Not found', { status: 404 })
}
