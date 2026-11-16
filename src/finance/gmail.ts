import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Payload } from 'payload'
import { siteUrl } from '../lib/payments'
import { readReceipt, receiptAiConfigured } from './ai'
import { categories, categoryIdFor, createExpense, duplicateOf, saveReceiptFile } from './expenses'

/**
 * Receipts from the Gmail inbox (read-only). Google OAuth with the gmail.readonly scope; the refresh token is stored
 * encrypted (AES-256-GCM, key derived from PAYLOAD_SECRET). Only likely receipts are opened, and from those only the
 * text and the receipt attachment are sent to Claude — nothing else from the mailbox is extracted or stored.
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (a Google Cloud OAuth client, "Internal" for a Workspace domain).
 */

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const oauthBase = () => (process.env.NODE_ENV !== 'production' && process.env.GOOGLE_OAUTH_BASE) || 'https://oauth2.googleapis.com'
const gmailBase = () => (process.env.NODE_ENV !== 'production' && process.env.GMAIL_API_BASE) || 'https://gmail.googleapis.com'
export const gmailConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
export const redirectUri = () => `${siteUrl()}/management/finance/gmail/callback`

// ── Encryption of the stored token ───────────────────────────────────────────────
const key = () => createHash('sha256').update(`gmail-token:${process.env.PAYLOAD_SECRET || 'dev-secret'}`).digest()
export function encrypt(plain: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64url')).join('.')
}
export function decrypt(blob: string) {
  const [iv, tag, body] = blob.split('.').map((x) => Buffer.from(x, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(body), d.final()]).toString('utf8')
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
const sign = (s: string) => createHmac('sha256', process.env.PAYLOAD_SECRET || 'dev-secret').update(`gmail-state:${s}`).digest('base64url').slice(0, 24)
export function authUrl(userId: number) {
  const nonce = `${userId}.${Date.now().toString(36)}`
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? '', redirect_uri: redirectUri(), response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state: `${nonce}.${sign(nonce)}`, login_hint: 'jordan@foundation.football' })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}
export function checkState(state: string, userId: number) {
  const parts = state.split('.')
  if (parts.length !== 3) return false
  const nonce = `${parts[0]}.${parts[1]}`
  const a = Buffer.from(parts[2])
  const b = Buffer.from(sign(nonce))
  return Number(parts[0]) === userId && a.length === b.length && timingSafeEqual(a, b) && Date.now() - parseInt(parts[1], 36) < 15 * 60_000
}

async function token(body: Record<string, string>) {
  const res = await fetch(`${oauthBase()}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', ...body }) })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error_description?: string; error?: string }
  if (!res.ok || !json.access_token) throw new Error(`Google sign-in failed: ${json.error_description || json.error || res.status}`)
  return json
}

/** Callback: swap the code for tokens, store the refresh token encrypted, remember which mailbox. */
export async function connect(p: Payload, code: string) {
  const t = await token({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() })
  if (!t.refresh_token) throw new Error('Google didn’t return a refresh token — remove the website’s access at myaccount.google.com/permissions and connect again.')
  const prof = await fetch(`${gmailBase()}/gmail/v1/users/me/profile`, { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => ({})) as { emailAddress?: string }
  await p.updateGlobal({ slug: 'finance-settings', data: { gmail: { email: prof.emailAddress ?? null, connectedAt: new Date().toISOString(), refreshToken: encrypt(t.refresh_token), lastError: null, checkedIds: [] } }, overrideAccess: true, depth: 0 })
  return prof.emailAddress ?? null
}

export async function disconnect(p: Payload) {
  await p.updateGlobal({ slug: 'finance-settings', data: { gmail: { email: null, connectedAt: null, refreshToken: null, lastError: null, checkedIds: [] } }, overrideAccess: true, depth: 0 })
}

// ── The import job ────────────────────────────────────────────────────────────
const SEARCH = 'newer_than:10d -in:sent -in:chats (receipt OR invoice OR "tax invoice" OR "order confirmation" OR "payment received" OR "your order" OR "amount paid" OR "billing")'

type Part = { mimeType?: string; filename?: string; body?: { data?: string; attachmentId?: string; size?: number }; parts?: Part[] }
const b64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
function walk(part: Part, out: Part[] = []) { out.push(part); for (const c of part.parts ?? []) walk(c, out); return out }
const stripHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/** Every few hours: look for new receipts in the inbox and add them as expenses to review. */
export async function importGmailReceipts(p: Payload, o: { force?: boolean } = {}) {
  const g = await p.findGlobal({ slug: 'finance-settings', depth: 0, overrideAccess: true }).then((x) => x.gmail).catch(() => null)
  if (!g?.refreshToken || !gmailConfigured()) return { skipped: 'not connected' }
  if (!o.force && g.lastCheckedAt && Date.now() - Date.parse(g.lastCheckedAt) < 3 * 3_600_000) return { skipped: 'checked recently' }
  const checked = new Set<string>(Array.isArray(g.checkedIds) ? (g.checkedIds as string[]) : [])
  let created = 0
  let notReceipts = 0
  let duplicates = 0
  let lastError: string | null = null
  try {
    const { access_token } = await token({ refresh_token: decrypt(g.refreshToken), grant_type: 'refresh_token' })
    const api = (path: string) => fetch(`${gmailBase()}/gmail/v1/users/me/${path}`, { headers: { authorization: `Bearer ${access_token}` } }).then(async (r) => { if (!r.ok) throw new Error(`Gmail ${r.status}`); return r.json() })
    const list = (await api(`messages?maxResults=50&q=${encodeURIComponent(SEARCH)}`)) as { messages?: { id: string }[] }
    const cats = (await categories(p)).filter((c) => c.active !== false).map((c) => c.name)
    for (const { id } of list.messages ?? []) {
      if (checked.has(id)) continue
      checked.add(id)
      if (await duplicateOf(p, { supplier: '', date: '', amount: -1, sourceRef: `gmail:${id}` })) { duplicates++; continue }
      const msg = (await api(`messages/${id}?format=full`)) as { payload?: Part & { headers?: { name: string; value: string }[] } }
      const parts = walk(msg.payload ?? {})
      const subject = msg.payload?.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value ?? ''
      const fromH = msg.payload?.headers?.find((h) => h.name.toLowerCase() === 'from')?.value ?? ''
      const plain = parts.find((x) => x.mimeType === 'text/plain' && x.body?.data)
      const html = parts.find((x) => x.mimeType === 'text/html' && x.body?.data)
      const text = `From: ${fromH}\nSubject: ${subject}\n\n${plain ? b64(plain.body!.data!).toString('utf8') : html ? stripHtml(b64(html.body!.data!).toString('utf8')) : ''}`
      const att = parts.find((x) => x.filename && x.body?.attachmentId && /pdf|image\//i.test(x.mimeType ?? '') && (x.body.size ?? 0) < 8_000_000)
      let file: { data: Buffer; mediaType: string; name: string } | undefined
      if (att) {
        const a = (await api(`messages/${id}/attachments/${att.body!.attachmentId}`)) as { data?: string }
        if (a.data) file = { data: b64(a.data), mediaType: att.mimeType!, name: att.filename! }
      }
      if (!receiptAiConfigured()) { lastError = 'ANTHROPIC_API_KEY is not set — emails can’t be read yet'; checked.delete(id); break }
      const r = await readReceipt({ text, file: file ? { data: file.data, mediaType: file.mediaType } : undefined, categories: cats })
      if (!r.isReceipt || !(r.total > 0) || !r.date) { notReceipts++; continue }
      if (await duplicateOf(p, { supplier: r.supplier, date: r.date, amount: r.total })) { duplicates++; continue }
      const receipt = file ? await saveReceiptFile(p, { data: file.data, mimetype: file.mediaType, name: file.name, size: file.data.length }) : null
      const res = await createExpense(p, { date: r.date, supplier: r.supplier.slice(0, 120), amount: r.total, gst: r.gst, description: (r.summary || subject).slice(0, 300), category: await categoryIdFor(p, r.category), paymentMethod: r.paymentMethod, source: 'email', status: 'needs_review', receipt, sourceRef: `gmail:${id}` })
      if (res.duplicate) duplicates++
      else created++
    }
  } catch (e) {
    lastError = (e instanceof Error ? e.message : String(e)).slice(0, 300)
  }
  await p.updateGlobal({ slug: 'finance-settings', data: { gmail: { ...g, lastCheckedAt: new Date().toISOString(), lastError, checkedIds: [...checked].slice(-1000) } }, overrideAccess: true, depth: 0 })
  return { created, notReceipts, duplicates, error: lastError }
}
