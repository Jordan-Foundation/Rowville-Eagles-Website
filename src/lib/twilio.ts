import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Twilio, spoken directly over its REST API (no SDK): send SMS, verify webhook signatures, write TwiML.
 * Credentials come from env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (+614…).
 */

export const twilioConfig = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  return sid && token && from ? { sid, token, from } : null
}

/** Local testing only: point at a mock API (never honoured in production). */
const apiBase = () => (process.env.NODE_ENV !== 'production' && process.env.TWILIO_API_BASE) || 'https://api.twilio.com'

/**
 * Twilio's request signature: HMAC-SHA1 (auth token) of the full URL followed by every POST parameter
 * name+value in alphabetical order, base64-encoded. https://www.twilio.com/docs/usage/security
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('')
  return createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64')
}

export function validTwilioSignature(authToken: string, signature: string | null, urls: string[], params: Record<string, string>) {
  if (!signature) return false
  const given = Buffer.from(signature)
  return urls.some((url) => {
    const expected = Buffer.from(twilioSignature(authToken, url, params))
    return expected.length === given.length && timingSafeEqual(expected, given)
  })
}

export type SendResult = { ok: true; sid: string } | { ok: false; code?: number; error: string }

export async function sendTwilioSms(to: string, body: string, statusCallback?: string): Promise<SendResult> {
  const cfg = twilioConfig()
  if (!cfg) return { ok: false, error: 'Twilio is not configured' }
  const form = new URLSearchParams({ To: to, From: cfg.from, Body: body, ...(statusCallback ? { StatusCallback: statusCallback } : {}) })
  const res = await fetch(`${apiBase()}/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const json = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string }
  if (!res.ok || !json.sid) return { ok: false, code: json.code, error: json.message ?? `Twilio error ${res.status}` }
  return { ok: true, sid: json.sid }
}

/** Fetch a recording (Twilio media URLs can require the account's credentials). */
export async function fetchRecording(recordingSid: string) {
  const cfg = twilioConfig()
  if (!cfg || !/^RE[0-9a-f]{32}$/i.test(recordingSid)) return null
  const res = await fetch(`${apiBase()}/2010-04-01/Accounts/${cfg.sid}/Recordings/${recordingSid}.mp3`, {
    headers: { authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64')}` },
  })
  return res.ok ? res : null
}

// ── TwiML ────────────────────────────────────────────────────────────────────

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
export const twiml = (inner = '') => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { headers: { 'content-type': 'text/xml' } })

/** Forward the call, showing the caller's own number; afterwards Twilio calls `action` with the outcome. */
export const dialTwiml = (o: { to: string; callerId?: string; action: string; timeout?: number }) =>
  `<Dial${o.callerId ? ` callerId="${xmlEsc(o.callerId)}"` : ''} timeout="${o.timeout ?? 20}" action="${xmlEsc(o.action)}" method="POST"><Number>${xmlEsc(o.to)}</Number></Dial>`

/** Amazon Polly's Australian voice (Twilio only accepts it by its neural name). */
export const VOICE = 'Polly.Olivia-Neural'
export const sayTwiml = (text: string) => `<Say voice="${VOICE}" language="en-AU">${xmlEsc(text)}</Say>`

/**
 * If anything goes wrong while answering a call, the caller still gets the voicemail (plain voice) instead of
 * Twilio's "an application error has occurred".
 */
export const safeVoicemail = (greeting: string) =>
  twiml(`<Say language="en-AU">${xmlEsc(greeting)}</Say><Record action="/twilio/voice/done" method="POST" maxLength="120" playBeep="true" timeout="5" transcribe="true" transcribeCallback="/twilio/voice/transcription"/>`)

/** Greeting, then record up to 2 minutes; `action` gets the recording when they hang up, `transcribeCallback` the text later. */
export const voicemailTwiml = (o: { greeting: string; action: string; transcribeCallback: string }) =>
  `${sayTwiml(o.greeting)}<Record action="${xmlEsc(o.action)}" method="POST" maxLength="120" playBeep="true" timeout="5" transcribe="true" transcribeCallback="${xmlEsc(o.transcribeCallback)}"/>`

export const messageTwiml = (text: string) => `<Message>${xmlEsc(text)}</Message>`

/** STOP / START keywords (Twilio's standard set). */
export function smsKeyword(body: string): 'stop' | 'start' | 'help' | null {
  const w = body.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'REVOKE'].includes(w)) return 'stop'
  if (['START', 'YES', 'UNSTOP', 'OPTIN'].includes(w)) return 'start'
  if (['HELP', 'INFO'].includes(w)) return 'help'
  return null
}
