'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { financeOrNull } from '@/finance/access'
import { disconnect, importGmailReceipts } from '@/finance/gmail'
import { COACHED_KINDS } from '@/finance/rules'

const q = { overrideAccess: true, depth: 0 } as const
const back = (k: 'done' | 'error', m: string) => redirect(`/management/finance/settings?${k}=${encodeURIComponent(m)}`)
const YMD = /^\d{4}-\d{2}-\d{2}$/

export async function saveFinanceSettings(fd: FormData) {
  const user = await financeOrNull()
  if (!user) return back('error', 'Admins only.')
  const num = (k: string, d: number, min: number, max: number) => { const n = Number(fd.get(k)); return Number.isFinite(n) && String(fd.get(k) ?? '') !== '' ? Math.min(max, Math.max(min, n)) : d }
  const emails = String(fd.get('reportRecipients') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (emails.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) return back('error', 'One of the report emails doesn’t look right.')
  const ss = String(fd.get('eaglesSeasonStart') ?? '')
  const se = String(fd.get('eaglesSeasonEnd') ?? '')
  const kinds = fd.getAll('setupKinds').map(String).filter((k) => (COACHED_KINDS as string[]).includes(k))
  const p = await payload()
  const cur = await p.findGlobal({ slug: 'finance-settings', ...q })
  await p.updateGlobal({ slug: 'finance-settings', data: {
    superRate: num('superRate', 12, 0, 30), superOnBonus: fd.get('superOnBonus') === 'on', bonusPct: num('bonusPct', 10, 0, 100),
    setupMinutes: num('setupMinutes', 15, 0, 120), packupMinutes: num('packupMinutes', 15, 0, 120), blockGapMinutes: num('blockGapMinutes', 0, 0, 120),
    setupKinds: kinds as never, eaglesSeasonStart: YMD.test(ss) ? ss : null, eaglesSeasonEnd: YMD.test(se) ? se : null, eaglesGameMinutes: num('eaglesGameMinutes', 90, 15, 300),
    reportRecipients: emails.join(', ') || null, reportDay: String(num('reportDay', 1, 0, 6)) as '1', reportHour: num('reportHour', 9, 0, 23),
    gmail: cur.gmail,
  }, ...q, user })
  revalidatePath('/management/finance', 'layout')
  return back('done', 'Settings saved.')
}

export async function saveCategories(fd: FormData) {
  const user = await financeOrNull()
  if (!user) return back('error', 'Admins only.')
  const p = await payload()
  const { docs } = await p.find({ collection: 'expense-categories', limit: 100, pagination: false, ...q })
  for (const c of docs) {
    const name = String(fd.get(`cat-${c.id}`) ?? '').trim().slice(0, 60)
    if (name) await p.update({ collection: 'expense-categories', id: c.id, data: { name, active: fd.get(`active-${c.id}`) === 'on' }, ...q, user }).catch(() => null)
  }
  const add = String(fd.get('newCategory') ?? '').trim().slice(0, 60)
  if (add) await p.create({ collection: 'expense-categories', data: { name: add, active: true, sortOrder: docs.length }, ...q, user }).catch(() => null)
  revalidatePath('/management/finance', 'layout')
  return back('done', 'Categories saved.')
}

export async function gmailAction(fd: FormData) {
  const user = await financeOrNull()
  if (!user) return back('error', 'Admins only.')
  const p = await payload()
  if (fd.get('do') === 'disconnect') { await disconnect(p); return back('done', 'Gmail disconnected. Also remove the website at myaccount.google.com/permissions if you like.') }
  const r = await importGmailReceipts(p, { force: true })
  if ('skipped' in r) return back('error', `Not checked: ${r.skipped}.`)
  revalidatePath('/management/finance', 'layout')
  return r.error ? back('error', r.error) : back('done', `${r.created} new receipt${r.created === 1 ? '' : 's'} added for review (${r.notReceipts} emails weren’t receipts, ${r.duplicates} already recorded).`)
}
