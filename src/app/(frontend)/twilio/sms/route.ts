import { payload } from '@/lib/payload'
import { recordConsent } from '@/lib/consent'
import { logSms, toE164 } from '@/lib/sms'
import { smsKeyword, twiml } from '@/lib/twilio'
import { accountLinks, emailAcademyInbox, esc, localNumber, readTwilioRequest, usersByPhone, who } from '@/lib/twilio-inbound'

/**
 * Texts sent to the Twilio number ("A message comes in" → POST https://<site>/twilio/sms).
 * STOP / START update the family's SMS opt-out (Twilio also blocks/unblocks the number itself and sends
 * the standard confirmation). Anything else is logged and emailed to the academy inbox.
 */
export async function POST(req: Request) {
  const params = await readTwilioRequest(req)
  if (!params) return new Response('Forbidden', { status: 403 })
  const p = await payload()
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
    return twiml()
  }
  if (kw === 'help') return twiml() // Twilio sends the standard HELP reply

  const name = who(users, localNumber(from))
  await emailAcademyInbox(p, {
    subject: `Text from ${name}`,
    heading: 'New text message',
    intro: `${esc(name)} texted the Foundation Academy number:<br><br><strong style="white-space:pre-wrap">${esc(body || '(no text)')}</strong>${media ? `<br><br>(+${media} photo/file — open the Twilio console to view)` : ''}`,
    rows: [
      ['From', localNumber(from)],
      ['Account', users.length ? users.map((u) => u.email).join(', ') : 'No account with this mobile'],
    ],
    after: `To reply, text or call ${esc(localNumber(from))} from your phone. ${users.length ? `Account: ${esc(accountLinks(users))}` : ''}`,
  })
  return twiml()
}
