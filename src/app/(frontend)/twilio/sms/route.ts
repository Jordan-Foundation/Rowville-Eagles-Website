import { payload } from '@/lib/payload'
import { recordConsent } from '@/lib/consent'
import { logSms, toE164 } from '@/lib/sms'
import { smsKeyword, twiml } from '@/lib/twilio'
import { readTwilioRequest, rejectionDetail, usersByPhone } from '@/lib/twilio-inbound'
import { receiveSms, systemNote } from '@/messaging/service'

/**
 * Texts sent to the Twilio number ("A message comes in" → POST https://<site>/twilio/sms).
 * STOP / START update the family's SMS opt-out (Twilio also blocks/unblocks the number itself and sends
 * the standard confirmation). Anything else goes into the family's conversation (or Unassigned, for an
 * unknown number) and their coaches — or the academy inbox — get an email alert.
 */
export async function POST(req: Request) {
  const signed = req.headers.has('x-twilio-signature')
  const params = await readTwilioRequest(req.clone())
  const p = await payload()
  if (!params) {
    // Looks like Twilio but the security check failed — record it so the setup problem is visible (Admin → Message log)
    if (signed) {
      await logSms(p, { to: 'Twilio webhook', body: 'Incoming text rejected: security check failed', kind: 'service', status: 'failed', inbound: true, error: (process.env.TWILIO_AUTH_TOKEN ? `Signature didn’t match. ${await rejectionDetail(req)}` : 'TWILIO_AUTH_TOKEN is not set in Vercel').slice(0, 900) })
    }
    return new Response('Forbidden', { status: 403 })
  }
  const from = toE164(params.From) ?? params.From ?? 'unknown'
  const body = (params.Body ?? '').trim()
  const media = Number(params.NumMedia ?? 0)
  const users = await usersByPhone(p, from)
  await logSms(p, { to: from, body: body + (media ? ` [+${media} photo/file]` : ''), kind: 'service', status: 'received', userId: users[0]?.id, sid: params.MessageSid, inbound: true })

  const kw = smsKeyword(body)
  if (kw === 'stop' || kw === 'start') {
    for (const u of users) {
      if (Boolean(u.smsOptOut) === (kw === 'stop')) continue
      await recordConsent(p, u, {
        channel: 'sms_all',
        action: kw === 'stop' ? 'withdrawn' : 'granted',
        wording: `Replied “${body.slice(0, 40)}” by SMS to the Foundation Academy / Rowville Eagles number`,
        source: 'stop_reply',
        basis: 'express',
      })
    }
    await systemNote(p, { users, phone: from, body: kw === 'stop' ? `Replied “${body.slice(0, 40)}” — texts to this number are stopped. Replies will be emailed instead.` : `Replied “${body.slice(0, 40)}” — texts to this number are back on.` })
    return twiml()
  }
  if (kw === 'help') return twiml() // Twilio sends the standard HELP reply

  try {
    await receiveSms(p, { from, body, sid: params.MessageSid, media, users })
  } catch (e) {
    p.logger.error({ err: e, msg: 'Filing an incoming text failed' })
    await logSms(p, { to: from, body: 'Incoming text could not be added to Messages', kind: 'service', status: 'failed', inbound: true, sid: params.MessageSid, error: e instanceof Error ? e.message : String(e) })
  }
  return twiml()
}

// Twilio can be set to send these as GET instead of POST
export { POST as GET }
