'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { createCycleReports, reassignReport } from '@/academy/reports/service'
import { approveReports, managementEdit, releaseCycle, returnReport } from '@/academy/reports/review'
import { STRANDS } from '@/academy/curriculum/levels'

export type CycleState = { error?: string; message?: string }
const nums = (fd: FormData, k: string) => fd.getAll(k).map(Number).filter((n) => Number.isInteger(n) && n > 0)

export async function createCycleAction(_prev: CycleState, fd: FormData): Promise<CycleState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const name = String(fd.get('name') ?? '').trim().slice(0, 120)
  const season = Number(fd.get('season'))
  const due = String(fd.get('dueDate') ?? '')
  if (!name) return { error: 'Give the round a name, e.g. “Mid-year 2027”.' }
  if (!Number.isInteger(season) || season < 2020 || season > 2100) return { error: 'Enter the season year.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: 'Choose the date coaches must finish by.' }
  const programs = nums(fd, 'programs')
  const teams = nums(fd, 'teams')
  if (!programs.length && !teams.length) return { error: 'Tick at least one program or team.' }
  // Evening of that day in Melbourne (12:00 UTC = 10pm AEST / 11pm AEDT — still the same calendar day)
  const dueDate = new Date(`${due}T12:00:00.000Z`).toISOString()
  const p = await payload()
  const cycle = await p.create({ collection: 'report-cycles', overrideAccess: true, data: { name, season, dueDate, programs, teams, status: 'open' } })
  redirect(`/management/reports/${cycle.id}?new=1`)
}

export async function createReportsAction(_prev: CycleState, fd: FormData): Promise<CycleState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const id = Number(fd.get('cycle'))
  const r = await createCycleReports(await payload(), id, user.id)
  revalidatePath(`/management/reports/${id}`)
  const parts = [`${r.created} report${r.created === 1 ? '' : 's'} created`]
  if (r.already) parts.push(`${r.already} already had one`)
  if (r.skipped.length) parts.push(`${r.skipped.length} skipped (${r.skipped.slice(0, 5).map((s) => `${s.name}: ${s.reason}`).join('; ')}${r.skipped.length > 5 ? '…' : ''})`)
  if (r.noCoach) parts.push(`${r.noCoach} need a coach — choose one below`)
  return { message: parts.join(' · ') + '.' }
}

export async function reassignAction(fd: FormData) {
  const user = await managementOrNull()
  if (!user) return
  const raw = String(fd.get('coach') ?? '')
  await reassignReport(await payload(), Number(fd.get('report')), raw ? Number(raw) : null, user.id)
  revalidatePath(`/management/reports/${fd.get('cycle')}`)
}

export async function setCycleStatusAction(fd: FormData) {
  const user = await managementOrNull()
  if (!user) return
  const status = fd.get('status') === 'closed' ? 'closed' : 'open'
  const id = Number(fd.get('cycle'))
  await (await payload()).update({ collection: 'report-cycles', id, overrideAccess: true, data: { status } })
  revalidatePath(`/management/reports/${id}`)
}

// ── Review & release (Stage 38) ──────────────────────────────────────────────

export async function approveSelectedAction(fd: FormData) {
  const user = await managementOrNull()
  if (!user) return
  const cycle = Number(fd.get('cycle'))
  const n = await approveReports(await payload(), nums(fd, 'ids'), user.id)
  revalidatePath(`/management/reports/${cycle}`)
  redirect(`/management/reports/${cycle}?approved=${n}`)
}

export async function releaseAction(_prev: CycleState, fd: FormData): Promise<CycleState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const cycle = Number(fd.get('cycle'))
  const r = await releaseCycle(await payload(), cycle, user.id)
  revalidatePath(`/management/reports/${cycle}`)
  return { message: `${r.released} report${r.released === 1 ? '' : 's'} released to ${r.families} famil${r.families === 1 ? 'y' : 'ies'} (email + text).${r.unreachable ? ` ${r.unreachable} had no contact details — they’ll see it when they log in.` : ''}` }
}

const reportInput = (fd: FormData) => ({
  strands: STRANDS.map((s) => ({ strand: s.key, rating: (String(fd.get(`rating-${s.key}`) ?? '') || null) as never, comment: String(fd.get(`comment-${s.key}`) ?? '') })),
  overall: String(fd.get('overall') ?? ''),
  level: String(fd.get('level') ?? ''),
})

export async function reviewAction(_prev: CycleState, fd: FormData): Promise<CycleState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const id = Number(fd.get('id'))
  const intent = String(fd.get('intent'))
  const p = await payload()
  try {
    if (intent === 'save' || intent === 'approve') await managementEdit(p, id, reportInput(fd), user.id)
    if (intent === 'approve') {
      const n = await approveReports(p, [id], user.id)
      if (!n) return { error: 'Only submitted reports can be approved.' }
    }
    if (intent === 'return') await returnReport(p, id, String(fd.get('note') ?? ''), user.id)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save.' }
  }
  revalidatePath(`/management/reports/r/${id}`)
  if (intent === 'save') return { message: 'Saved.' }
  const next = String(fd.get('next') ?? '')
  redirect(next.startsWith('/management/reports/') ? next : `/management/reports/r/${id}`)
}
