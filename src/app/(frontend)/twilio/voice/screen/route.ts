import { payload } from '@/lib/payload'
import { screenTwiml, twiml } from '@/lib/twilio'
import { readTwilioRequest, requestOrigin } from '@/lib/twilio-inbound'
import { markAccepted, rejectedWebhook } from '../settings'

/**
 * Played to whoever answers the forwarded call. Pressing 1 connects the caller; no key (e.g. the phone's own
 * voicemail picked up) hangs up this leg, and /twilio/voice/after sends the caller to the academy voicemail.
 */
export async function POST(req: Request) {
  const params = await readTwilioRequest(req)
  if (!params) {
    await rejectedWebhook(req)
    return new Response('Forbidden', { status: 403 })
  }
  if (params.Digits === undefined) return twiml(screenTwiml({ from: params.From, action: `${requestOrigin(req)}/twilio/voice/screen` }))
  if (params.Digits === '1') {
    if (params.ParentCallSid) await markAccepted(await payload(), params.ParentCallSid, params.From ?? 'unknown')
    return twiml() // empty response: connect the two calls
  }
  return twiml('<Hangup/>')
}

// Twilio can be set to send these as GET instead of POST
export { POST as GET }
