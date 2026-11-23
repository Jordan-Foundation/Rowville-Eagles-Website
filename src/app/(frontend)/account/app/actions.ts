'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentLogin as currentUser } from '@/lib/auth'
import { recordAppStep, snoozeAppCard } from '@/lib/app-install'
import { saveSubscription } from '@/push/send'

/** The app is running from the home screen (or was installed from the browser's prompt). */
export async function appInstalledAction() {
  const u = await currentUser()
  if (!u) return { ok: false }
  const changed = await recordAppStep(await payload(), u.id, 'installed')
  if (changed) revalidatePath('/account')
  return { ok: true }
}

/** Notifications allowed on this device: save it and record the step. */
export async function appPushAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, device: string) {
  const u = await currentUser()
  if (!u) return { error: 'Please log in again, then turn notifications on.' }
  const p = await payload()
  try {
    await saveSubscription(p, u.id, sub, device)
  } catch {
    return { error: 'Couldn’t turn on notifications on this device.' }
  }
  const changed = await recordAppStep(p, u.id, 'push')
  if (changed) revalidatePath('/account')
  return { ok: true }
}

/** "Remind me later": hide the homepage card for 7 days. */
export async function snoozeAppAction() {
  const u = await currentUser()
  if (!u) return
  await snoozeAppCard(await payload(), u.id)
  revalidatePath('/account')
}
