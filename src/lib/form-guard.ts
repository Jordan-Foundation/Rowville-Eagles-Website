import { createHash, createHmac, timingSafeEqual } from 'crypto'
import type { Payload } from 'payload'

/**
 * Spam protection for public forms without third-party services:
 *  - a hidden honeypot field people never fill in,
 *  - a signed time-stamp (bots that post instantly, or replay old forms, are ignored),
 *  - rate limits per IP address and per email (stored as hashes, cleared daily).
 */
const secret = () => process.env.PAYLOAD_SECRET || 'dev-secret'
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url').slice(0, 22)

export const formStamp = (now = Date.now()) => `${now}.${sign(String(now))}`

export function checkStamp(stamp: string | null | undefined, now = Date.now(), o = { minMs: 2500, maxMs: 6 * 3_600_000 }) {
  const [ts, mac] = String(stamp ?? '').split('.')
  if (!ts || !mac) return 'missing' as const
  const a = Buffer.from(mac)
  const b = Buffer.from(sign(ts))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'forged' as const
  const age = now - Number(ts)
  if (age < o.minMs) return 'too_fast' as const
  if (age > o.maxMs) return 'expired' as const
  return 'ok' as const
}

export const normaliseEmail = (e: string) => e.trim().toLowerCase()
export const validEmail = (e: string) => e.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(e)

export const hashKey = (kind: string, value: string) => `${kind}:${createHash('sha256').update(`${secret()}|${value}`).digest('base64url').slice(0, 32)}`

export function clientIp(h: Headers) {
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim()
}

/** Allow at most `limit` submissions per key in the window; records this attempt when allowed. */
export async function throttle(payload: Payload, form: string, keys: { key: string; limit: number }[], windowMs = 3_600_000) {
  const since = new Date(Date.now() - windowMs).toISOString()
  for (const k of keys) {
    const { totalDocs } = await payload.count({ collection: 'form-throttle', where: { key: { equals: k.key }, form: { equals: form }, createdAt: { greater_than: since } }, overrideAccess: true })
    if (totalDocs >= k.limit) return false
  }
  for (const k of keys) await payload.create({ collection: 'form-throttle', overrideAccess: true, data: { key: k.key, form } })
  return true
}

export async function purgeThrottle(payload: Payload) {
  const r = await payload.delete({ collection: 'form-throttle', where: { createdAt: { less_than: new Date(Date.now() - 86_400_000).toISOString() } }, overrideAccess: true })
  return { deleted: r.docs.length }
}

/**
 * One-line guard for public forms: at most `perIp` submissions per hour from one connection and `perEmail` per
 * email address. Returns an error message to show, or null when the submission may go ahead.
 */
export async function rateLimit(payload: Payload, form: string, o: { email?: string | null; perIp?: number; perEmail?: number } = {}) {
  const { headers } = await import('next/headers')
  const ip = clientIp(await headers())
  const keys = [{ key: hashKey('ip', ip), limit: o.perIp ?? 10 }]
  if (o.email) keys.push({ key: hashKey('email', normaliseEmail(o.email)), limit: o.perEmail ?? 5 })
  const ok = await throttle(payload, form, keys)
  return ok ? null : 'Too many attempts from here in the last hour — please wait a little and try again, or call us.'
}
