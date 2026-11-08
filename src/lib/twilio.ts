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

/** Same as twilioSignature, from the raw list of fields (keeps repeated fields, as Twilio does: sorted by name, then value). */
export function twilioSignaturePairs(authToken: string, url: string, pairs: [string, string][]) {
  const sorted = [...pairs].sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0))
  const data = url + sorted.map(([k, v]) => k + v).join('')
  return createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64')
}

export function validTwilioSignature(authToken: string, signature: string | null, urls: string[], params: Record<string, string> | [string, string][]) {
  if (!signature) return false
  const given = Buffer.from(signature)
  const pairs = Array.isArray(params) ? params : Object.entries(params)
  return urls.some((url) => {
    const expected = Buffer.from(twilioSignaturePairs(authToken, url, pairs))
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

/**
 * Second check for call webhooks: ask Twilio whether this call really exists on our account, from and to
 * the numbers in the request. Used when the signature doesn't match (e.g. a small difference in the
 * webhook address) — a forged request can't name a real, current call.
 */
export async function confirmCallWithTwilio(p: { CallSid?: string; From?: string; To?: string; AccountSid?: string }): Promise<{ ok: boolean; why: string }> {
  const cfg = twilioConfig()
  if (!cfg) return { ok: false, why: 'Twilio settings missing' }
  if (!p.CallSid || !/^CA[0-9a-f]{32}$/i.test(p.CallSid)) return { ok: false, why: `no valid CallSid (${p.CallSid ? p.CallSid.length + ' chars' : 'missing'})` }
  if (p.AccountSid && p.AccountSid !== cfg.sid) return { ok: false, why: 'different account' }
  try {
    const res = await fetch(`${apiBase()}/2010-04-01/Accounts/${cfg.sid}/Calls/${p.CallSid}.json`, {
      headers: { authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64')}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { ok: false, why: `Twilio API answered ${res.status}` }
    const call = (await res.json()) as { from?: string; to?: string; date_created?: string }
    const age = Date.now() - new Date(call.date_created ?? 0).getTime()
    if (!(age < 2 * 3_600_000)) return { ok: false, why: `call too old or no date (${call.date_created ?? 'none'})` }
    if (p.From && call.from !== p.From) return { ok: false, why: `caller differs (${(call.from ?? '').slice(-3)} vs ${p.From.slice(-3)})` }
    if (p.To && call.to !== p.To && call.from !== p.To) return { ok: false, why: `called number differs (${(call.to ?? '').slice(-3)} vs ${p.To.slice(-3)})` }
    return { ok: true, why: 'confirmed with Twilio' }
  } catch (e) {
    return { ok: false, why: `Twilio API not reached (${e instanceof Error ? e.message : 'error'})` }
  }
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
