import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { canMarket } from './consent'
import { emailLayout, type Block } from './email-templates'
import { sendEmail } from './email'
import { siteUrl } from './payments'
import { makeUnsubscribeToken } from './unsubscribe-token'

/** Loads users 100 at a time (consent is read fresh for each batch, at the moment of sending). */
async function* userBatches(payload: Payload, ids: number[]) {
  const unique = Array.from(new Set(ids))
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100)
    const { docs } = await payload.find({ collection: 'users', where: { id: { in: chunk } }, limit: chunk.length, depth: 0, overrideAccess: true, pagination: false })
    const byId = new Map(docs.map((u) => [u.id, u]))
    yield chunk.map((id) => ({ id, user: byId.get(id) ?? null }))
  }
}

/** Result of a bulk send. `done` lists everyone handled (sent, skipped or failed) so an interrupted send can carry on. */
export type BulkResult = { sent: number; skipped: number; failed: number; done: number[]; finished: boolean }

/**
 * The ONLY way to send marketing email. Consent is re-read from the database at send time (100 recipients at a
 * time), so an unsubscribe that happened a second ago is respected even if the list was built earlier.
 * Stops cleanly before `deadline` (ms timestamp) so a long send can be resumed with the remaining ids.
 */
export async function sendMarketingEmail(
  payload: Payload,
  opts: { userIds: number[]; subject: string; brand: 'club' | 'academy'; blocks: (user: User) => Block[]; deadline?: number },
): Promise<BulkResult> {
  const result: BulkResult = { sent: 0, skipped: 0, failed: 0, done: [], finished: true }
  for await (const batch of userBatches(payload, opts.userIds)) {
    for (const { id, user } of batch) {
      if (opts.deadline && Date.now() > opts.deadline) return { ...result, finished: false }
      if (!user || !canMarket(user, 'email')) {
        result.skipped++
        result.done.push(id)
        continue
      }
      const unsubscribeUrl = `${siteUrl()}/unsubscribe/${makeUnsubscribeToken(user.id)}`
      const ok = await sendEmail(payload, {
        to: user.email,
        subject: opts.subject,
        html: emailLayout(opts.brand, opts.blocks(user), { unsubscribeUrl }),
        sender: opts.brand,
        kind: 'marketing',
        userId: user.id,
        // RFC 8058 one-click unsubscribe (Gmail/Yahoo/Outlook show an "Unsubscribe" button)
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      })
      if (ok) result.sent++
      else result.failed++
      result.done.push(id)
    }
  }
  return result
}

/**
 * The ONLY way to send a marketing text. Consent (marketing texts on, not replied STOP) is re-read for every
 * recipient at send time, and the body must already end with the opt-out wording. Resumable like the email send.
 */
export async function sendMarketingSms(payload: Payload, opts: { userIds: number[]; body: string; deadline?: number }): Promise<BulkResult> {
  const { sendSms } = await import('./sms')
  const result: BulkResult = { sent: 0, skipped: 0, failed: 0, done: [], finished: true }
  if (!/Reply STOP to opt out$/.test(opts.body)) throw new Error('Marketing texts must end with “Reply STOP to opt out”.')
  for await (const batch of userBatches(payload, opts.userIds)) {
    for (const { id, user } of batch) {
      if (opts.deadline && Date.now() > opts.deadline) return { ...result, finished: false }
      result.done.push(id)
      if (!user || !canMarket(user, 'sms') || !user.phone) {
        result.skipped++
        continue
      }
      const r = await sendSms(payload, { to: user.phone, body: opts.body, kind: 'marketing', optedOut: user.smsOptOut, userId: user.id })
      if (r.sent || r.reason === 'not_configured') result.sent++
      else if (r.reason === 'opted_out' || r.reason === 'no_mobile') result.skipped++
      else result.failed++
    }
  }
  return result
}
