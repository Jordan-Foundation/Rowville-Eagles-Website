import type { Payload } from 'payload'

/**
 * SMS sending. Twilio is connected in stage 10 — until then messages are logged and skipped,
 * so features that send SMS can be built (and tested) now and start sending once Twilio is set up.
 */
export type SmsKind = 'service' | 'reminder' | 'coach_alert' | 'marketing'

export const smsConfigured = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)

/** Australian mobile → E.164 (+614…). Returns null if it isn't one. */
export function toE164(mobile: string | null | undefined) {
  const m = (mobile ?? '').replace(/[\s()-]/g, '')
  if (/^04\d{8}$/.test(m)) return `+61${m.slice(1)}`
  if (/^\+614\d{8}$/.test(m)) return m
  if (/^614\d{8}$/.test(m)) return `+${m}`
  return null
}

export async function sendSms(payload: Payload, o: { to: string | null | undefined; body: string; kind: SmsKind; optedOut?: boolean | null }) {
  const to = toE164(o.to)
  if (!to) return { sent: false as const, reason: 'no_mobile' }
  if (o.optedOut) return { sent: false as const, reason: 'opted_out' }
  if (!smsConfigured()) {
    payload.logger.info(`[sms not sent — Twilio not set up] to=${to} kind=${o.kind} body="${o.body}"`)
    return { sent: false as const, reason: 'not_configured' }
  }
  // Stage 10: Twilio send + message log go here
  payload.logger.warn(`[sms] Twilio credentials present but sending is not implemented yet (stage 10) — to=${to}`)
  return { sent: false as const, reason: 'not_implemented' }
}
