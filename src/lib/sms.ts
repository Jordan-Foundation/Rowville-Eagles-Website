import type { Payload } from 'payload'
import { sendTwilioSms, twilioConfig } from './twilio'

/**
 * SMS sending through Twilio. Without credentials (local dev / not yet set up) messages are logged and
 * skipped, so features keep working. Every attempt is written to the message log.
 */
export type SmsKind = 'service' | 'reminder' | 'coach_alert' | 'marketing'

export const smsConfigured = () => twilioConfig() !== null

/** Australian mobile → E.164 (+614…). Returns null if it isn't one. */
export function toE164(mobile: string | null | undefined) {
  const m = (mobile ?? '').replace(/[\s()-]/g, '')
  if (/^04\d{8}$/.test(m)) return `+61${m.slice(1)}`
  if (/^\+614\d{8}$/.test(m)) return m
  if (/^614\d{8}$/.test(m)) return `+${m}`
  return null
}

/** Twilio error codes meaning the recipient replied STOP (carrier-level opt-out). */
const OPTED_OUT_CODES = new Set([21610])

type Status = 'sent' | 'failed' | 'not-configured' | 'skipped-opted-out'

export async function logSms(payload: Payload, o: { to: string; body: string; kind: SmsKind; status: Status | 'received'; userId?: number | null; sid?: string; error?: string; inbound?: boolean }) {
  try {
    await payload.create({
      collection: 'message-log',
      overrideAccess: true,
      data: {
        channel: o.inbound ? 'sms_in' : 'sms',
        to: o.to,
        subject: o.body.slice(0, 1000) || '(empty)',
        kind: o.kind === 'marketing' ? 'marketing' : 'service',
        sender: o.inbound ? undefined : /Foundation Academy/.test(o.body) ? 'academy' : 'club',
        userId: o.userId ?? undefined,
        status: o.status,
        providerId: o.sid,
        error: o.error?.slice(0, 300),
      },
    })
  } catch (e) {
    payload.logger.error({ err: e, msg: 'Could not write SMS to the message log' })
  }
}

export async function sendSms(payload: Payload, o: { to: string | null | undefined; body: string; kind: SmsKind; optedOut?: boolean | null; userId?: number | null }) {
  const to = toE164(o.to)
  if (!to) return { sent: false as const, reason: 'no_mobile' }
  if (o.optedOut) {
    await logSms(payload, { to, body: o.body, kind: o.kind, status: 'skipped-opted-out', userId: o.userId })
    return { sent: false as const, reason: 'opted_out' }
  }
  if (!smsConfigured()) {
    payload.logger.info(`[sms not sent — Twilio not set up] to=${to} kind=${o.kind} body="${o.body}"`)
    return { sent: false as const, reason: 'not_configured' }
  }
  try {
    const r = await sendTwilioSms(to, o.body)
    if (r.ok) {
      await logSms(payload, { to, body: o.body, kind: o.kind, status: 'sent', userId: o.userId, sid: r.sid })
      return { sent: true as const, sid: r.sid }
    }
    const optedOut = r.code !== undefined && OPTED_OUT_CODES.has(r.code)
    if (!optedOut) payload.logger.error(`[sms] Twilio refused the message to ${to}: ${r.error}`)
    await logSms(payload, { to, body: o.body, kind: o.kind, status: optedOut ? 'skipped-opted-out' : 'failed', userId: o.userId, error: r.error })
    return { sent: false as const, reason: optedOut ? 'opted_out' : 'failed' }
  } catch (e) {
    payload.logger.error({ err: e, msg: `[sms] sending to ${to} failed` })
    await logSms(payload, { to, body: o.body, kind: o.kind, status: 'failed', userId: o.userId, error: e instanceof Error ? e.message : String(e) })
    return { sent: false as const, reason: 'failed' }
  }
}
