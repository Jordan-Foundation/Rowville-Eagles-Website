'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { financeOrNull } from '@/finance/access'
import { mondayOf } from '@/finance/rules'
import { sendFinanceReport } from '@/finance/report'

/** Build and send the weekly report for any week now (re-sends a week already sent). */
export async function sendReportNow(fd: FormData) {
  const user = await financeOrNull()
  if (!user) redirect('/management/finance?error=Admins%20only.')
  const wk = String(fd.get('week') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wk)) redirect('/management/finance?error=Pick%20a%20week.')
  const start = mondayOf(wk)
  const r = await sendFinanceReport(await payload(), start, { force: true, to: fd.get('onlyMe') === 'on' ? [user.email] : undefined })
  redirect(`/management/finance?view=${start}&done=${encodeURIComponent(`Report for the week of ${start} sent to ${r.to ?? 0} ${r.to === 1 ? 'person' : 'people'}.`)}`)
}
