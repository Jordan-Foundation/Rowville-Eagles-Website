import { payload } from '@/lib/payload'
import { siteUrl } from '@/lib/payments'
import { toE164 } from '@/lib/sms'
import { sayTwiml, twiml } from '@/lib/twilio'
import { accountLinks, emailAcademyInbox, esc, localNumber, readTwilioRequest, usersByPhone, who } from '@/lib/twilio-inbound'
import { findCallLog, minutes } from '../settings'

/** The caller finished recording (or hung up): email the voicemail to the academy inbox straight away. */
export async function POST(req: Request) {
  const params = await readTwilioRequest(req)
  if (!params) return new Response('Forbidden', { status: 403 })
  const p = await payload()
  const secs = Number(params.RecordingDuration ?? 0)
  if (params.RecordingSid && secs >= 2) {
    const from = toE164(params.From) ?? params.From ?? 'unknown'
    const users = await usersByPhone(p, from)
    const name = who(users, localNumber(from))
    const log = await findCallLog(p, params.CallSid)
    if (log) await p.update({ collection: 'message-log', id: log.id, overrideAccess: true, data: { status: 'voicemail', subject: `Voicemail (${minutes(secs)}) · ${params.RecordingSid}` } })
    await emailAcademyInbox(p, {
      subject: `Voicemail from ${name}`,
      heading: 'New voicemail',
      intro: `${esc(name)} left a ${esc(minutes(secs))} voicemail on the Foundation Academy number. The written transcript follows in a separate email.`,
      rows: [
        ['From', localNumber(from)],
        ['Account', users.length ? users.map((u) => u.email).join(', ') : 'No account with this mobile'],
        ['Received', new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium', timeStyle: 'short' })],
      ],
      cta: { label: 'Listen to the voicemail', href: `${siteUrl()}/staff/voicemail/${params.RecordingSid}` },
      after: `Log in as an admin to listen. To call back: ${esc(localNumber(from))}. ${users.length ? `Account: ${esc(accountLinks(users))}` : ''}`,
    })
  }
  return twiml(`${sayTwiml('Thanks. We’ll be in touch soon. Goodbye.')}<Hangup/>`)
}

// Twilio can be set to send these as GET instead of POST
export { POST as GET }
