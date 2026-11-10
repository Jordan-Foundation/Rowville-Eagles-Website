'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { localToUtc } from '@/lib/time'
import { SetupError, publishSetup, saveSetup, startSetup } from '@/academy/yearly-setup'
import type { HolidayPeriod } from '@/academy/yearly'

const go = (year: number, msg: string, key: 'done' | 'error' = 'done') => redirect(`/management/yearly-setup?year=${year}&${key}=${encodeURIComponent(msg)}`)
const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

async function guard(fn: () => Promise<string>, year: number) {
  if (!(await managementOrNull())) return go(year, 'Management only.', 'error')
  let msg: string
  try {
    msg = await fn()
  } catch (e) {
    return go(year, e instanceof SetupError ? e.message : 'Something went wrong — please try again.', 'error')
  }
  revalidatePath('/management/yearly-setup')
  go(year, msg)
}

/** Step 1: the four terms. */
export async function startAction(fd: FormData) {
  const year = Number(s(fd, 'year'))
  await guard(async () => {
    await startSetup(await payload(), year, [1, 2, 3, 4].map((n) => ({ start: s(fd, `t${n}start`), end: s(fd, `t${n}end`) })))
    return 'Holidays and availability deadlines worked out — check them below.'
  }, year)
}

/** Step 2: save any changes to the dates. */
export async function saveAction(fd: FormData) {
  const year = Number(s(fd, 'year'))
  await guard(async () => {
    const opens = s(fd, 'term1OpensAt')
    await saveSetup(await payload(), year, {
      terms: [1, 2, 3, 4].map((n) => ({ start: s(fd, `t${n}start`), end: s(fd, `t${n}end`), deadline: s(fd, `t${n}deadline`) })),
      holidays: (['summer', 'april', 'mid-year', 'september'] as HolidayPeriod[]).map((h) => ({ period: h, start: s(fd, `${h}start`), end: s(fd, `${h}end`), deadline: s(fd, `${h}deadline`) })),
      term1OpensAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(opens) ? localToUtc(opens.slice(0, 10), opens.slice(11)).toISOString() : null,
    })
    return 'Saved. Check the summary, then publish.'
  }, year)
}

export async function publishAction(fd: FormData) {
  const year = Number(s(fd, 'year'))
  const user = await managementOrNull()
  await guard(async () => {
    const r = await publishSetup(await payload(), year, user?.id)
    return `Published ${year}: ${r.timeframes.length} timeframes and ${r.programs.filter((x) => x.action === 'created').length} Academy term programs (as drafts).`
  }, year)
}
