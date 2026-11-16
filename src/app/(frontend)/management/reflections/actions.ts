'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { generateReports, notifyReports } from '@/reflections/reports'
import { reportPeriod } from '@/reflections/rules'
import { localYmd } from '@/lib/time'

const q = { overrideAccess: true, depth: 0 } as const
const back = (tab: string, k: 'done' | 'error', m: string, extra = '') => redirect(`/management/reflections?tab=${tab}${extra}&${k}=${encodeURIComponent(m)}`)

/** Welfare queue: mark a flag reviewed with what was done. */
export async function reviewFlag(fd: FormData) {
  const user = await managementOrNull()
  if (!user) return back('welfare', 'error', 'Management only.')
  const notes = String(fd.get('notes') ?? '').trim().slice(0, 2000)
  if (!notes) return back('welfare', 'error', 'Write a short note about what was done.')
  const p = await payload()
  await p.update({ collection: 'welfare-flags', id: Number(fd.get('id')), data: { status: 'reviewed', reviewedBy: user.id, reviewedAt: new Date().toISOString(), notes }, ...q })
  revalidatePath('/management')
  return back('welfare', 'done', 'Marked reviewed.')
}

/** Rebuild one report (or the whole week) now. Optionally email coaches/Management again. */
export async function regenerateReport(fd: FormData) {
  const user = await managementOrNull()
  if (!user) return back('reports', 'error', 'Management only.')
  const p = await payload()
  const raw = String(fd.get('from') ?? '')
  const from = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : reportPeriod(localYmd(new Date())).from
  const period = { from, to: new Date(new Date(`${from}T00:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10) }
  const scopeType = String(fd.get('scopeType') ?? '')
  const scopeKey = String(fd.get('scopeKey') ?? '')
  const only = scopeType && scopeKey ? { type: scopeType as 'team' | 'age_group' | 'club', key: scopeKey } : undefined
  const made = await generateReports(p, period, { only })
  if (fd.get('notify') === 'on') await notifyReports(p, made, { force: true })
  revalidatePath('/management/reflections')
  const failed = made.filter((r) => r.status === 'failed').length
  if (!made.length) return back('reports', 'error', 'No games were played that week by teams using reflections.', `&week=${period.from}`)
  return back('reports', failed ? 'error' : 'done', failed ? `${made.length - failed} built; ${failed} couldn’t get an AI summary (numbers saved).` : `${made.length} report${made.length === 1 ? '' : 's'} built.`, `&week=${period.from}`)
}

/** Settings + pillars. */
export async function saveSettings(fd: FormData) {
  const user = await managementOrNull()
  if (!user) return back('settings', 'error', 'Management only.')
  const p = await payload()
  const num = (k: string, d: number, min: number, max: number) => { const n = Number(fd.get(k)); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d }
  const email = String(fd.get('safeguardingEmail') ?? '').trim()
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return back('settings', 'error', 'The safeguarding email doesn’t look right.')
  await p.updateGlobal({
    slug: 'reflection-settings',
    data: {
      enabled: fd.get('enabled') === 'on',
      opensAfterHours: num('opensAfterHours', 3, 0, 48),
      closesAfterDays: num('closesAfterDays', 4, 1, 14),
      remindOnOpen: fd.get('remindOnOpen') === 'on',
      closingReminderHours: num('closingReminderHours', 24, 0, 96),
      teams: fd.getAll('teams').map(Number).filter(Boolean),
      showStreak: fd.get('showStreak') === 'on',
      aiReports: fd.get('aiReports') === 'on',
      aiWelfareCheck: fd.get('aiWelfareCheck') === 'on',
      safeguardingEmail: email || null,
      keywords: String(fd.get('keywords') ?? '').slice(0, 5000),
    },
    ...q,
  })
  // Pillars: rename / hint / on-off / order, plus one new one
  const { docs } = await p.find({ collection: 'reflection-pillars', limit: 50, pagination: false, ...q })
  for (const x of docs) {
    const name = String(fd.get(`pillar-${x.id}-name`) ?? '').trim().slice(0, 40)
    if (!name) continue
    await p.update({ collection: 'reflection-pillars', id: x.id, data: { name, hint: String(fd.get(`pillar-${x.id}-hint`) ?? '').trim().slice(0, 120) || null, active: fd.get(`pillar-${x.id}-active`) === 'on', sortOrder: num(`pillar-${x.id}-order`, x.sortOrder ?? 0, 0, 99) }, ...q })
  }
  const add = String(fd.get('newPillar') ?? '').trim().slice(0, 40)
  if (add) await p.create({ collection: 'reflection-pillars', data: { name: add, active: true, sortOrder: docs.length + 1 }, ...q })
  revalidatePath('/management/reflections')
  return back('settings', 'done', 'Settings saved.')
}
