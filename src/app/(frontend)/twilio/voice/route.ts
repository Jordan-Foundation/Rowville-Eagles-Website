import { payload } from '@/lib/payload'
import { toE164 } from '@/lib/sms'
import { dialTwiml, safeVoicemail, twiml, voicemailTwiml } from '@/lib/twilio'
import { readTwilioRequest, requestOrigin, usersByPhone } from '@/lib/twilio-inbound'
import { DEFAULT_GREETING, logCall, rejectedWebhook, voiceSettings } from './settings'

/**
 * Calls to the Twilio number ("A call comes in" → POST https://<site>/twilio/voice).
 * Rings the forwarding mobile for 20 seconds, showing the caller's own number; /twilio/voice/after
 * handles no answer (voicemail). With no forwarding number set, callers go straight to voicemail.
 */
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
  const { forwardTo, greeting } = await voiceSettings(p)
  const from = toE164(params.From)
  if (forwardTo && forwardTo !== from) {
    return twiml(dialTwiml({ to: forwardTo, callerId: from ?? undefined, action: `${requestOrigin(req)}/twilio/voice/after` }))
  }
  const users = await usersByPhone(p, params.From)
  await logCall(p, { from: from ?? params.From ?? 'unknown', callSid: params.CallSid, status: 'missed', note: 'Missed call (no forwarding number set)', userId: users[0]?.id })
  return twiml(voicemailTwiml({ greeting, action: `${requestOrigin(req)}/twilio/voice/done`, transcribeCallback: `${requestOrigin(req)}/twilio/voice/transcription` }))
}

// Twilio can be set to send these as GET instead of POST
export { POST as GET }
