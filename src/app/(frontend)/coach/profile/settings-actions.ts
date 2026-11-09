'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { coachOrNull } from '@/academy/portal'
import { payload } from '@/lib/payload'

export type SettingsState = { saved?: string; error?: string }

const KEYS = ['bookingEmail', 'bookingText', 'cancelEmail', 'cancelText', 'replyEmail', 'replyText'] as const

export async function saveAlerts(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const c = await coachOrNull()
  if (!c) return { error: 'Please log in again.' }
  const alerts = Object.fromEntries(KEYS.map((k) => [k, fd.get(k) === 'on']))
  await (await payload()).update({ collection: 'academy-coaches', id: c.coach.id, data: { alerts }, overrideAccess: true })
  revalidatePath('/coach/profile')
  return { saved: 'Alert settings saved.' }
}

/** Create (or replace, which stops the old link working) the private calendar feed link. */
export async function newCalendarLink() {
  const c = await coachOrNull()
  if (!c) return
  await (await payload()).update({ collection: 'academy-coaches', id: c.coach.id, data: { calendarToken: randomBytes(24).toString('base64url') } as never, overrideAccess: true })
  revalidatePath('/coach/profile')
}
