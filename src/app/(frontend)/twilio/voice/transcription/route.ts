import { payload } from '@/lib/payload'
import { siteUrl } from '@/lib/payments'
import { toE164 } from '@/lib/sms'
import { accountLinks, emailAcademyInbox, esc, localNumber, readTwilioRequest, usersByPhone, who } from '@/lib/twilio-inbound'

/** Twilio's transcription of a voicemail (arrives a minute or two after the call). */
export async function POST(req: Request) {
  const params = await readTwilioRequest(req)
  if (!params) return new Response('Forbidden', { status: 403 })
  const p = await payload()
  const from = toE164(params.From) ?? params.From ?? 'unknown'
  const users = await usersByPhone(p, from)
  const name = who(users, localNumber(from))
  const ok = params.TranscriptionStatus === 'completed' && params.TranscriptionText?.trim()
  await emailAcademyInbox(p, {
    subject: `Voicemail transcript — ${name}`,
    heading: 'Voicemail transcript',
    intro: ok
      ? `${esc(name)} said:<br><br><strong style="white-space:pre-wrap">“${esc(params.TranscriptionText!.trim())}”</strong><br><br><em>Automatic transcript — names and numbers may be wrong, so listen to the recording to check.</em>`
      : `The voicemail from ${esc(name)} couldn’t be transcribed automatically. Please listen to the recording.`,
    rows: [['From', localNumber(from)]],
    cta: params.RecordingSid ? { label: 'Listen to the voicemail', href: `${siteUrl()}/management/voicemail/${params.RecordingSid}` } : undefined,
    after: users.length ? `Account: ${esc(accountLinks(users))}` : undefined,
  })
  return new Response(null, { status: 204 })
}

// Twilio can be set to send these as GET instead of POST
export { POST as GET }
