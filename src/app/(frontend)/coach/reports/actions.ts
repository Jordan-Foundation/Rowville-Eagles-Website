'use server'

import { revalidatePath } from 'next/cache'
import { coachOrNull } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { coachReport, saveDraft, submitReport, type SaveResult } from '@/academy/reports/service'
import type { ReportInput } from '@/academy/reports/rules'

/** Autosave (called a moment after the coach stops typing). */
export async function saveReportDraft(id: number, input: ReportInput): Promise<SaveResult> {
  const c = await coachOrNull()
  if (!c) return { ok: false, error: 'Your login has expired — please log in again. Nothing typed since the last save was saved.' }
  const p = await payload()
  const report = await coachReport(p, id, c.user.id)
  if (!report) return { ok: false, error: 'This report isn’t assigned to you any more.' }
  return saveDraft(p, report, input, c.user.id)
}

export async function submitReportAction(id: number, input: ReportInput): Promise<SaveResult & { problems?: string[] }> {
  const c = await coachOrNull()
  if (!c) return { ok: false, error: 'Your login has expired — please log in again.' }
  const p = await payload()
  const report = await coachReport(p, id, c.user.id)
  if (!report) return { ok: false, error: 'This report isn’t assigned to you any more.' }
  const res = await submitReport(p, report, input, c.user.id)
  if (res.ok) revalidatePath('/coach/reports')
  return res
}
