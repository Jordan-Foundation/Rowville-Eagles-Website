import { payload } from '@/lib/payload'
import { toE164 } from '@/lib/sms'
import { safeVoicemail, twiml, voicemailTwiml } from '@/lib/twilio'
import { readTwilioRequest, requestOrigin, usersByPhone } from '@/lib/twilio-inbound'
import { DEFAULT_GREETING, findAccepted, logCall, minutes, rejectedWebhook, voiceSettings } from '../settings'

/**
 * After the forwarded call: taken (the person pressed 1) → done; anything else — no answer, busy, declined,
 * or picked up by the phone's own voicemail — → the Foundation Academy voicemail.
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
  const params = await readTwilioRequest(req)
  if (!params) {
    await rejectedWebhook(req)
    return new Response('Forbidden', { status: 403 })
  }
  const p = await payload()
  const from = toE164(params.From) ?? params.From ?? 'unknown'
  const users = await usersByPhone(p, from)
  const accepted = params.DialCallStatus === 'completed' ? await findAccepted(p, params.CallSid) : null
  if (accepted) {
    await p.update({ collection: 'message-log', id: accepted.id, overrideAccess: true, data: { subject: `Call answered (${minutes(params.DialCallDuration)})`, userId: users[0]?.id } })
    return twiml('<Hangup/>')
  }
  const why = params.DialCallStatus === 'completed' ? 'not taken — went to the phone’s own voicemail or wasn’t accepted' : (params.DialCallStatus ?? 'no answer')
  await logCall(p, { from, callSid: params.CallSid, status: 'missed', note: `Missed call (${why})`, userId: users[0]?.id })
  const { greeting } = await voiceSettings(p)
  return twiml(voicemailTwiml({ greeting, action: `${requestOrigin(req)}/twilio/voice/done`, transcribeCallback: `${requestOrigin(req)}/twilio/voice/transcription` }))
}

// Twilio can be set to send these as GET instead of POST
export { POST as GET }
