import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { canMarket } from './consent'
import { emailLayout, type Block } from './email-templates'
import { sendEmail } from './email'
import { siteUrl } from './payments'
import { makeUnsubscribeToken } from './unsubscribe-token'

/**
 * The ONLY way to send marketing email. Consent is re-read from the database at send time for every
 * recipient, so an unsubscribe that happened a second ago is respected even if the list was built earlier.
 */
export async function sendMarketingEmail(
  payload: Payload,
  opts: { userIds: number[]; subject: string; brand: 'club' | 'academy'; blocks: (user: User) => Block[] },
) {
  const result = { sent: 0, skipped: 0 }
  for (const id of Array.from(new Set(opts.userIds))) {
    const user = await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, disableErrors: true })
    if (!user || !canMarket(user, 'email')) {
      result.skipped++
      continue
    }
    const unsubscribeUrl = `${siteUrl()}/unsubscribe/${makeUnsubscribeToken(user.id)}`
    await sendEmail(payload, {
      to: user.email,
      subject: opts.subject,
      html: emailLayout(opts.brand, opts.blocks(user), { unsubscribeUrl }),
      sender: opts.brand,
      kind: 'marketing',
      userId: user.id,
      // RFC 8058 one-click unsubscribe (Gmail/Yahoo/Outlook show an "Unsubscribe" button)
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    result.sent++
  }
  return result
}
