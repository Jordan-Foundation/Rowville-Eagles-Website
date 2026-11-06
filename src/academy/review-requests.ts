import type { Payload } from 'payload'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { siteUrl } from '../lib/payments'
import { makeUnsubscribeToken } from '../lib/unsubscribe-token'

/**
 * One Google review request per family, once ever, after their Nth attended 1-on-1 (default 12).
 * Sent to EVERY family that reaches the milestone — never filtered by how happy we think they are,
 * and never with an incentive (ACCC online-review guidance and Google's review policy).
 * Families who unsubscribed from our emails are skipped; the email carries an unsubscribe link.
 */
export function reviewDue(attended: number, threshold: number, alreadySent: boolean) {
  return !alreadySent && attended >= threshold
}

export async function sendReviewRequests(payload: Payload) {
  const settings = await payload.findGlobal({ slug: 'academy-settings', overrideAccess: true })
  const url = settings.googleReviewUrl?.trim()
  if (!url || settings.reviewRequestsOn === false) return { skipped: 'no review link set (Academy settings)' }
  const threshold = settings.reviewAfterSessions ?? 12

  // Attended sessions per family
  const { docs } = await payload.find({ collection: 'academy-sessions', where: { status: { equals: 'completed' }, account: { exists: true } }, limit: 50000, depth: 0, overrideAccess: true, select: { account: true } })
  const count = new Map<number, number>()
  for (const s of docs) {
    const a = typeof s.account === 'object' ? s.account?.id : s.account
    if (a) count.set(a, (count.get(a) ?? 0) + 1)
  }
  const result = { eligible: 0, sent: 0, unsubscribed: 0 }
  for (const [accountId, attended] of count) {
    if (attended < threshold) continue
    const user = await payload.findByID({ collection: 'users', id: accountId, depth: 0, overrideAccess: true, disableErrors: true })
    if (!user || !reviewDue(attended, threshold, Boolean(user.reviewRequestSentAt))) continue
    result.eligible++
    // Claim first so a second run can't send twice
    const claimed = await payload.update({ collection: 'users', where: { id: { equals: user.id }, reviewRequestSentAt: { exists: false } }, data: { reviewRequestSentAt: new Date().toISOString() }, overrideAccess: true })
    if (!claimed.docs.length) continue
    const { docs: optOut } = await payload.find({ collection: 'consent-records', where: { user: { equals: user.id }, channel: { equals: 'marketing_email' } }, sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true })
    if (optOut[0]?.action === 'withdrawn' && optOut[0].source === 'unsubscribe_link') {
      result.unsubscribed++
      continue
    }
    const unsubscribeUrl = `${siteUrl()}/unsubscribe/${makeUnsubscribeToken(user.id)}`
    const html = emailLayout(
      'academy',
      [
        {
          heading: 'How are we going?',
          intro: `Hi ${esc(user.firstName || 'there')}, thanks for training with Foundation Academy — that’s ${attended} 1-on-1 sessions so far. We’d really value an honest Google review of your experience; it helps other families find us and helps us improve.`,
          cta: { label: 'Leave a Google review', href: url },
          after: 'It takes about a minute. Anything you’d rather tell us directly? Just reply to this email. This is the only time we’ll ask.',
        },
      ],
      { unsubscribeUrl },
    )
    await sendEmail(payload, {
      to: user.email,
      subject: 'How are we going? A quick review for Foundation Academy',
      html,
      sender: 'academy',
      userId: user.id,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    result.sent++
  }
  return result
}
