'use server'

import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { sendSms, smsConfigured, toE164 } from '@/lib/sms'

export type TestState = { results?: { to: string; ok: boolean; detail: string }[]; error?: string }

/** Sends a test text to every number in "Text alerts for new messages" and shows exactly what Twilio said. */
export async function sendTestText(_prev: TestState): Promise<TestState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  if (!smsConfigured()) return { error: 'Twilio isn’t set up: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM must all be set in Vercel.' }
  const p = await payload()
  const s = await p.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })
  const numbers = [...new Set(String(s.smsAlertNumbers ?? '').split(',').map((x) => toE164(x)).filter(Boolean) as string[])]
  if (!numbers.length) return { error: 'No numbers in Admin → Site settings → “Text alerts for new messages”.' }
  const results: NonNullable<TestState['results']> = []
  for (const to of numbers) {
    const r = await sendSms(p, { to, kind: 'coach_alert', body: 'Test text from the Rowville Eagles / Foundation Academy website — text alerts are working.' })
    let detail = r.sent ? 'Accepted by Twilio' : r.reason
    if (!r.sent) {
      const { docs } = await p.find({ collection: 'message-log', where: { to: { equals: to }, channel: { equals: 'sms' } }, sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true })
      if (docs[0]?.error) detail = docs[0].error
    }
    results.push({ to, ok: r.sent, detail })
  }
  return { results }
}
