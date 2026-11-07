import { payload } from '@/lib/payload'
import { toE164 } from '@/lib/sms'
import { twiml, voicemailTwiml } from '@/lib/twilio'
import { readTwilioRequest, usersByPhone } from '@/lib/twilio-inbound'
import { logCall, minutes, voiceSettings } from '../settings'

/** After the forwarded call: answered → done; no answer / busy / failed → voicemail. */
export async function POST(req: Request) {
  const params = await readTwilioRequest(req)
  if (!params) return new Response('Forbidden', { status: 403 })
  const p = await payload()
  const from = toE164(params.From) ?? params.From ?? 'unknown'
  const users = await usersByPhone(p, from)
  if (params.DialCallStatus === 'completed') {
    await logCall(p, { from, callSid: params.CallSid, status: 'answered', note: `Call answered (${minutes(params.DialCallDuration)})`, userId: users[0]?.id })
    return twiml('<Hangup/>')
  }
  await logCall(p, { from, callSid: params.CallSid, status: 'missed', note: `Missed call (${params.DialCallStatus ?? 'no answer'})`, userId: users[0]?.id })
  const { greeting } = await voiceSettings(p)
  return twiml(voicemailTwiml({ greeting, action: '/twilio/voice/done', transcribeCallback: '/twilio/voice/transcription' }))
}
