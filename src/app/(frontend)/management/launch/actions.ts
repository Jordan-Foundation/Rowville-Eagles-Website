'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { localToUtc } from '@/lib/time'
import { cancelSchedule, continueLaunch, sendFollowUpNow, sendTo, startLaunch, type Filter } from '@/launch/service'

const BACK = '/management/launch'
const go = (kind: 'done' | 'error', msg: string, extra = ''): never => redirect(`${BACK}?${kind}=${encodeURIComponent(msg)}${extra}`)
const filterOf = (fd: FormData): Filter => ({
  mode: fd.get('mode') === 'not_activated' ? 'not_activated' : 'all',
  team: Number(fd.get('team')) || null,
  rfa: fd.get('rfa') === 'on' || fd.get('rfa') === '1',
  batch: Number(fd.get('batch')) || null,
})

/** Save the email / text templates and the reminder / follow-up settings. */
export async function saveTemplatesAction(fd: FormData) {
  if (!(await managementOrNull())) go('error', 'Management only.')
  const s = (k: string, max: number) => String(fd.get(k) ?? '').slice(0, max)
  const p = await payload()
  const g = await p.findGlobal({ slug: 'portal-launch', depth: 0, overrideAccess: true })
  await p.updateGlobal({
    slug: 'portal-launch',
    overrideAccess: true,
    data: {
      launchSubject: s('launchSubject', 200),
      launchBody: s('launchBody', 8000),
      launchSms: s('launchSms', 640),
      followUpSubject: s('followUpSubject', 200),
      followUpBody: s('followUpBody', 8000),
      reminderEnabled: fd.get('reminderEnabled') === 'on',
      reminderDays: Math.max(1, Math.min(60, Number(fd.get('reminderDays')) || 5)),
      followUpDays: Math.max(1, Math.min(60, Number(fd.get('followUpDays')) || 7)),
      followUpPaused: fd.get('followUpPaused') === 'on',
      run: g.run,
    },
  })
  revalidatePath(BACK)
  go('done', 'Saved.', '#templates')
}

/** Send the launch email + text to me (the signed-in Management user), using a real family's details. */
export async function testAction(fd: FormData) {
  const me = await managementOrNull()
  if (!me) go('error', 'Management only.')
  const p = await payload()
  const family = await p.findByID({ collection: 'users', id: Number(fd.get('family')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!family) go('error', 'Choose a family to preview with.')
  const kind = fd.get('kind') === 'followup' ? 'followup' : 'launch'
  const r = await sendTo(p, family!, kind, { test: { email: me!.email, phone: me!.phone } })
  go(r.email ? 'done' : 'error', r.email ? `Test ${kind === 'followup' ? 'follow-up' : 'launch'} email sent to ${me!.email}${r.sms === 'sent' ? ` and text to ${me!.phone}` : kind === 'launch' ? (me!.phone ? ' (the text couldn’t be sent)' : ' (add your mobile to your account to get the test text)') : ''}.` : 'The test email couldn’t be sent.', `&family=${family!.id}`)
}

/** Send now or schedule — only after the confirmation step. */
export async function sendLaunchAction(fd: FormData) {
  const me = await managementOrNull()
  if (!me) go('error', 'Management only.')
  if (fd.get('confirm') !== 'yes') go('error', 'Please confirm the send.')
  const when = String(fd.get('when') ?? '')
  const at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when) ? localToUtc(when.slice(0, 10), when.slice(11, 16)).toISOString() : null
  const p = await payload()
  await startLaunch(p, { filter: filterOf(fd), by: me!, at })
  revalidatePath(BACK)
  if (at && new Date(at).getTime() > Date.now()) go('done', `Scheduled — it will start at ${when.replace('T', ' ')}.`)
  redirect(`${BACK}?sending=1`)
}

/** Keep a send going (the page calls this until everyone has been sent to). */
export async function continueAction(): Promise<{ sent: number; left: number; error?: string }> {
  if (!(await managementOrNull())) return { sent: 0, left: 0, error: 'Management only.' }
  return continueLaunch(await payload(), Date.now() + 50_000)
}

export async function cancelScheduleAction() {
  if (!(await managementOrNull())) go('error', 'Management only.')
  await cancelSchedule(await payload())
  revalidatePath(BACK)
  go('done', 'Scheduled send cancelled.')
}

/** Send the 1-on-1 follow-up now to the filtered list (parents who've had the launch email but not the follow-up). */
export async function followUpNowAction(fd: FormData) {
  if (!(await managementOrNull())) go('error', 'Management only.')
  if (fd.get('confirm') !== 'on') go('error', 'Tick the box to confirm the follow-up send.')
  const r = await sendFollowUpNow(await payload(), filterOf(fd))
  revalidatePath(BACK)
  go('done', `Follow-up sent to ${r.sent} parent${r.sent === 1 ? '' : 's'}${r.left ? ` — ${r.left} still to go (press again or the hourly job will catch up)` : ''}.`)
}
