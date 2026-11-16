'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { financeOrNull } from '@/finance/access'

const q = { overrideAccess: true, depth: 0 } as const
const YMD = /^\d{4}-\d{2}-\d{2}$/
const back = (qs: string, k: 'done' | 'error', m: string) => redirect(`/management/finance/coaches?${qs}${qs ? '&' : ''}${k}=${encodeURIComponent(m)}`)

/** New hourly rate from a date (earlier weeks keep the old rate). Same date again = correct that rate. */
export async function setRate(fd: FormData) {
  const qs = String(fd.get('qs') ?? '')
  const user = await financeOrNull()
  if (!user) return back(qs, 'error', 'Admins only.')
  const coach = Number(fd.get('coach'))
  const rate = Number(fd.get('rate'))
  const from = String(fd.get('from') ?? '')
  if (!coach || !(rate >= 0) || !YMD.test(from)) return back(qs, 'error', 'Enter a rate and the date it starts.')
  const p = await payload()
  const { docs } = await p.find({ collection: 'coach-pay-rates', where: { coach: { equals: coach }, effectiveFrom: { equals: from } }, limit: 1, ...q })
  if (docs[0]) await p.update({ collection: 'coach-pay-rates', id: docs[0].id, data: { hourlyRate: rate, note: String(fd.get('note') ?? '') || null }, ...q, user, overrideAccess: true })
  else await p.create({ collection: 'coach-pay-rates', data: { coach, hourlyRate: rate, effectiveFrom: from, note: String(fd.get('note') ?? '') || null }, ...q, user })
  revalidatePath('/management/finance', 'layout')
  return back(qs, 'done', `Rate $${rate.toFixed(2)}/h from ${from} saved.`)
}

export async function saveProfile(fd: FormData) {
  const qs = String(fd.get('qs') ?? '')
  const user = await financeOrNull()
  if (!user) return back(qs, 'error', 'Admins only.')
  const p = await payload()
  const coach = Number(fd.get('coach'))
  const data = { superOn: fd.get('superOn') === 'on', eaglesPaid: fd.get('eaglesPaid') === 'on', payrollActive: fd.get('payrollActive') === 'on', superFund: String(fd.get('superFund') ?? '').slice(0, 120) || null, xeroEmployee: String(fd.get('xeroEmployee') ?? '').slice(0, 120) || null, notes: String(fd.get('notes') ?? '').slice(0, 1000) || null }
  const { docs } = await p.find({ collection: 'coach-pay-profiles', where: { coach: { equals: coach } }, limit: 1, ...q })
  if (docs[0]) await p.update({ collection: 'coach-pay-profiles', id: docs[0].id, data, ...q, user })
  else await p.create({ collection: 'coach-pay-profiles', data: { ...data, coach }, ...q, user })
  revalidatePath('/management/finance', 'layout')
  return back(qs, 'done', 'Pay details saved.')
}

/** Manual hours (admin, fit-out, events…) or a correction (negative minutes), always with a reason. */
export async function addHours(fd: FormData) {
  const qs = String(fd.get('qs') ?? '')
  const user = await financeOrNull()
  if (!user) return back(qs, 'error', 'Admins only.')
  const coach = Number(fd.get('coach'))
  const date = String(fd.get('date') ?? '')
  const hours = Number(fd.get('hours'))
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 300)
  const startTime = String(fd.get('startTime') ?? '')
  if (!coach || !YMD.test(date) || !Number.isFinite(hours) || hours === 0) return back(qs, 'error', 'Enter a date and hours (use a minus for a correction).')
  if (!reason) return back(qs, 'error', 'Add a reason — it’s kept in the audit log.')
  await (await payload()).create({ collection: 'coach-hour-adjustments', data: { coach, date, kind: 'manual', minutes: Math.round(hours * 60), startTime: /^\d{2}:\d{2}$/.test(startTime) ? startTime : null, reason, createdBy: user.id }, ...q, user })
  revalidatePath('/management/finance', 'layout')
  return back(qs, 'done', 'Hours added.')
}

/** Pay a coach for a session that was cancelled (e.g. late cancellation). */
export async function payCancelled(fd: FormData) {
  const qs = String(fd.get('qs') ?? '')
  const user = await financeOrNull()
  if (!user) return back(qs, 'error', 'Admins only.')
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 300) || 'Cancelled session paid'
  await (await payload()).create({ collection: 'coach-hour-adjustments', data: { coach: Number(fd.get('coach')), date: String(fd.get('date')), kind: 'paid-cancellation', minutes: 0, sessionKey: String(fd.get('sessionKey')), reason, createdBy: user.id }, ...q, user })
  revalidatePath('/management/finance', 'layout')
  return back(qs, 'done', 'The cancelled session will be paid.')
}

export async function removeAdjustment(fd: FormData) {
  const qs = String(fd.get('qs') ?? '')
  const user = await financeOrNull()
  if (!user) return back(qs, 'error', 'Admins only.')
  await (await payload()).delete({ collection: 'coach-hour-adjustments', id: Number(fd.get('id')), ...q, user })
  revalidatePath('/management/finance', 'layout')
  return back(qs, 'done', 'Removed.')
}
