import { headers } from 'next/headers'

/** IP and browser of the current request — stored with consent records as evidence. */
export async function requestMeta() {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null,
    userAgent: h.get('user-agent'),
  }
}
