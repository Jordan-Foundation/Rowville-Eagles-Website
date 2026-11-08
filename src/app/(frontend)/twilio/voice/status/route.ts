import { payload } from '@/lib/payload'
import { toE164 } from '@/lib/sms'
import { accountLinks, emailAcademyInbox, esc, localNumber, readTwilioRequest, usersByPhone, who } from '@/lib/twilio-inbound'
import { findCallLog } from '../settings'

/**
 * Optional ("Call status changes" → POST https://<site>/twilio/voice/status): when a call ends and it was
 * missed without a voicemail (caller hung up during the greeting), email the academy inbox so they can call back.
 */
export async function POST(req: Request) {
  const params = await readTwilioRequest(req)
  if (!params) return new Response('Forbidden', { status: 403 })
  if (!['completed', 'no-answer', 'busy', 'failed', 'canceled'].includes(params.CallStatus ?? '')) return new Response(null, { status: 204 })
  const p = await payload()
  const log = await findCallLog(p, params.CallSid)
  if (log?.status === 'missed') {
    const from = toE164(params.From) ?? params.From ?? 'unknown'
    const users = await usersByPhone(p, from)
    const name = who(users, localNumber(from))
    await emailAcademyInbox(p, {
      subject: `Missed call from ${name}`,
      heading: 'Missed call',
      intro: `${esc(name)} called the Foundation Academy number and hung up without leaving a message.`,
      rows: [
        ['From', localNumber(from)],
        ['Account', users.length ? users.map((u) => u.email).join(', ') : 'No account with this mobile'],
      ],
      after: `To call back: ${esc(localNumber(from))}. ${users.length ? `Account: ${esc(accountLinks(users))}` : ''}`,
    })
  }
  return new Response(null, { status: 204 })
}

// Twilio can be set to send these as GET instead of POST
export { POST as GET }
