'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { sendPastDueReminder } from '@/academy/pdr/manage'
import { validMonth } from '@/academy/pdr/challenge-rules'

export type FplusState = { ok?: string; error?: string }

export async function remindAction(_prev: FplusState, fd: FormData): Promise<FplusState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  try {
    const r = await sendPastDueReminder(await payload(), Number(fd.get('kid')))
    revalidatePath('/management/foundation-plus')
    return { ok: `Reminder sent to ${r.parent}.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not send.' }
  }
}

const text = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max)

/** Create or update a monthly challenge (only these fields; the results are filled in automatically). */
export async function saveChallengeAction(_prev: FplusState, fd: FormData): Promise<FplusState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const id = fd.get('id') ? Number(fd.get('id')) : null
  const month = text(fd, 'month', 7)
  if (!validMonth(month)) return { error: 'Choose the month (YYYY-MM).' }
  const title = text(fd, 'title', 120)
  const description = text(fd, 'description', 2000)
  if (!title || !description) return { error: 'Give the challenge a title and say what to do.' }
  const winners = Number(fd.get('winnersPerGroup') ?? 1)
  if (!Number.isInteger(winners) || winners < 1 || winners > 10) return { error: 'Winners per group must be 1–10.' }
  const data = {
    title,
    month,
    description,
    rules: text(fd, 'rules', 2000),
    unit: text(fd, 'unit', 40) || 'points',
    direction: fd.get('direction') === 'lower' ? ('lower' as const) : ('higher' as const),
    groupBy: fd.get('groupBy') === 'all' ? ('all' as const) : ('birthYear' as const),
    winnersPerGroup: winners,
    prize: text(fd, 'prize', 500),
    published: fd.get('published') === 'on',
  }
  const p = await payload()
  let savedId = id
  try {
    if (id) await p.update({ collection: 'pdr-challenges', id, data, user, overrideAccess: false })
    else savedId = (await p.create({ collection: 'pdr-challenges', data, user, overrideAccess: false })).id
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: /unique|month/i.test(msg) ? `There’s already a challenge for ${month}.` : msg }
  }
  revalidatePath('/management/foundation-plus')
  redirect(`/management/foundation-plus?saved=${savedId}#challenges`)
}
