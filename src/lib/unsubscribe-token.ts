import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Signed, non-expiring unsubscribe tokens: "<userId>.<channel>.<signature>".
 * No database lookup needed to verify, and they can't be forged or edited to unsubscribe someone else.
 */
export type UnsubChannel = 'email'

const secret = () => {
  const s = process.env.PAYLOAD_SECRET
  if (!s) throw new Error('PAYLOAD_SECRET is required to sign unsubscribe links')
  return s
}

const sign = (body: string) => createHmac('sha256', secret()).update(`unsubscribe:${body}`).digest('base64url').slice(0, 32)

export function makeUnsubscribeToken(userId: number, channel: UnsubChannel = 'email') {
  const body = `${userId}.${channel}`
  return `${body}.${sign(body)}`
}

export function readUnsubscribeToken(token: string): { userId: number; channel: UnsubChannel } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [id, channel, sig] = parts
  if (channel !== 'email' || !/^\d+$/.test(id)) return null
  const expected = Buffer.from(sign(`${id}.${channel}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return { userId: Number(id), channel }
}
