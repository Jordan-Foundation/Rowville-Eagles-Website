import type { Payload } from 'payload'
import { toE164 } from '@/lib/sms'

export const DEFAULT_GREETING =
  'Thanks for calling Foundation Academy. We can’t take your call right now. Please leave your name, your child’s name and a message after the tone, and we’ll call you back as soon as we can.'

export async function voiceSettings(payload: Payload) {
  const s = await payload.findGlobal({ slug: 'academy-settings', depth: 0, overrideAccess: true }).catch(() => null)
  return {
    forwardTo: toE164(s?.callForwardTo) ?? toE164(process.env.CALL_FORWARD_TO),
    greeting: s?.voicemailGreeting?.trim() || DEFAULT_GREETING,
  }
}

export async function logCall(payload: Payload, o: { from: string; callSid?: string; status: 'answered' | 'missed' | 'voicemail'; note: string; userId?: number }) {
  try {
    await payload.create({
      collection: 'message-log',
      overrideAccess: true,
      data: { channel: 'call', to: o.from, subject: o.note, kind: 'service', sender: 'academy', status: o.status, providerId: o.callSid, userId: o.userId },
    })
  } catch (e) {
    payload.logger.error({ err: e, msg: 'Could not log call' })
  }
}

export async function findCallLog(payload: Payload, callSid: string | undefined) {
  if (!callSid) return null
  const { docs } = await payload.find({ collection: 'message-log', where: { providerId: { equals: callSid }, channel: { equals: 'call' } }, limit: 1, sort: '-createdAt', overrideAccess: true })
  return docs[0] ?? null
}

export const minutes = (secs: string | number | undefined) => {
  const n = Number(secs ?? 0)
  return n < 60 ? `${n} sec` : `${Math.round(n / 60)} min`
}

/** A call webhook that looked like Twilio but failed the security check — logged so the setup problem is visible. */
export async function rejectedWebhook(req: Request) {
  if (!req.headers.has('x-twilio-signature')) return
  const p = (await import('@/lib/payload')).payload
  try {
    await (await p()).create({
      collection: 'message-log',
      overrideAccess: true,
      data: {
        channel: 'call',
        to: 'Twilio webhook',
        subject: 'Incoming call rejected: security check failed',
        kind: 'service',
        sender: 'academy',
        status: 'failed',
        error: (process.env.TWILIO_AUTH_TOKEN ? `Signature didn’t match. ${await (await import('@/lib/twilio-inbound')).rejectionDetail(req)}` : 'TWILIO_AUTH_TOKEN is not set in Vercel').slice(0, 900),
      },
    })
  } catch {
    // logging must never stop the call
  }
}

/** Marker that the person on the forwarded phone pressed 1 (written by /twilio/voice/screen, keyed by the caller's call). */
export async function markAccepted(payload: Payload, parentCallSid: string, from: string) {
  await payload.create({ collection: 'message-log', overrideAccess: true, data: { channel: 'call', to: from, subject: 'Call taken', kind: 'service', sender: 'academy', status: 'answered', providerId: parentCallSid } })
}

export async function findAccepted(payload: Payload, callSid: string | undefined) {
  if (!callSid) return null
  const { docs } = await payload.find({ collection: 'message-log', where: { providerId: { equals: callSid }, channel: { equals: 'call' }, status: { equals: 'answered' } }, limit: 1, overrideAccess: true })
  return docs[0] ?? null
}
