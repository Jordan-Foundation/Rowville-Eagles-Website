import { payload } from '@/lib/payload'
import { toE164 } from '@/lib/sms'
import { safeVoicemail, twiml, voicemailTwiml } from '@/lib/twilio'
import { readTwilioRequest, requestOrigin, usersByPhone } from '@/lib/twilio-inbound'
import { DEFAULT_GREETING, logCall, minutes, rejectedWebhook, voiceSettings } from '../settings'

/** After the forwarded call: answered → done; no answer / busy / failed → voicemail. */
export async function POST(req: Request) {
  try {
    return await handle(req)
  } catch (e) {
    ;(await payload()).logger.error({ err: e, msg: 'Answering a call failed — sent the caller to voicemail' })
    return safeVoicemail(DEFAULT_GREETING)
  }
}

async function handle(req: Request) {
  const params = await readTwilioRequest(req.clone())
  if (!params) {
    await rejectedWebhook(req)
    return new Response('Forbidden', { status: 403 })
  }
  const p = await payload()
  const from = toE164(params.From) ?? params.From ?? 'unknown'
  const users = await usersByPhone(p, from)
  if (params.DialCallStatus === 'completed') {
    await logCall(p, { from, callSid: params.CallSid, status: 'answered', note: `Call answered (${minutes(params.DialCallDuration)})`, userId: users[0]?.id })
    return twiml('<Hangup/>')
  }
  await logCall(p, { from, callSid: params.CallSid, status: 'missed', note: `Missed call (${params.DialCallStatus ?? 'no answer'})`, userId: users[0]?.id })
  const { greeting } = await voiceSettings(p)
  return twiml(voicemailTwiml({ greeting, action: `${requestOrigin(req)}/twilio/voice/done`, transcribeCallback: `${requestOrigin(req)}/twilio/voice/transcription` }))
}

// Twilio can be set to send these as GET instead of POST
export { POST as GET }
