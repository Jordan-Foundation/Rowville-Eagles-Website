import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Resend webhooks are signed the Svix way: base64(HMAC-SHA256(secret, "<id>.<timestamp>.<body>")).
 * The secret (RESEND_WEBHOOK_SECRET) starts with "whsec_" followed by the base64 key. Pure — unit tested.
 */
export function verifySvix(o: { secret: string; id: string | null; timestamp: string | null; signature: string | null; body: string; now?: number }) {
  if (!o.id || !o.timestamp || !o.signature) return false
  const ts = Number(o.timestamp)
  if (!Number.isFinite(ts) || Math.abs((o.now ?? Date.now()) / 1000 - ts) > 300) return false
  const key = Buffer.from(o.secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${o.id}.${o.timestamp}.${o.body}`).digest('base64')
  return o.signature.split(' ').some((part) => {
    const sig = part.split(',')[1] ?? ''
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  })
}
