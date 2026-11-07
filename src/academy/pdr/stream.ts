/**
 * Cloudflare Stream: private player videos. Families upload straight from the browser to a one-time
 * Stream link (the file never passes through our servers); playback only via short-lived signed tokens.
 * Env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_TOKEN (API token with Stream:Edit), CLOUDFLARE_STREAM_CUSTOMER_CODE.
 */
const base = () => (process.env.NODE_ENV !== 'production' && process.env.STREAM_API_BASE) || 'https://api.cloudflare.com/client/v4'

export const streamConfigured = () => Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_STREAM_TOKEN && process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE)

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base()}/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream${path}`, {
    method,
    headers: { authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_TOKEN}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; result?: T; errors?: { message: string }[] }
  if (!res.ok || json.success === false) throw new Error(json.errors?.[0]?.message ?? `Cloudflare Stream error ${res.status}`)
  return json.result as T
}

/** A one-time upload link for the browser (expires after 30 minutes). */
export async function createUpload(o: { maxDurationSeconds: number; name: string }) {
  const expiry = new Date(Date.now() + 30 * 60_000).toISOString()
  return call<{ uploadURL: string; uid: string }>('POST', '/direct_upload', { maxDurationSeconds: o.maxDurationSeconds, requireSignedURLs: true, expiry, meta: { name: o.name } })
}

export type StreamVideo = { uid: string; readyToStream: boolean; duration?: number; status?: { state?: string; errorReasonText?: string } }
export const getVideo = (uid: string) => call<StreamVideo>('GET', `/${uid}`)
export const deleteVideo = (uid: string) => call<unknown>('DELETE', `/${uid}`)

/** Short-lived signed playback link (only issued after the viewer's access is checked). */
export async function playbackUrl(uid: string) {
  const { token } = await call<{ token: string }>('POST', `/${uid}/token`, { exp: Math.floor(Date.now() / 1000) + 2 * 3600 })
  return `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${token}/iframe`
}
