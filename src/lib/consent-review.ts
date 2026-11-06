import type { Payload } from 'payload'
import { createInvite } from './invites'
import { emailLayout } from './email-templates'
import { sendEmail } from './email'
import { siteUrl } from './payments'
import { makeUnsubscribeToken } from './unsubscribe-token'

/**
 * One-time email asking existing members to confirm their preferences.
 * Until they answer they are treated as opted OUT of marketing. Each member is emailed at most once
 * (status moves pending → sent). ACMA treats consent requests as commercial messages, so it carries an
 * unsubscribe link and full sender details.
 */
export async function sendConsentReviewBatch(payload: Payload, limit = 100) {
  const { docs } = await payload.find({
    collection: 'users',
    where: { consentReviewStatus: { equals: 'pending' } },
    limit,
    depth: 0,
    overrideAccess: true,
  })
  for (const user of docs) {
    // Mark first, so a crash or double click can never email the same person twice.
    await payload.update({ collection: 'users', id: user.id, data: { consentReviewStatus: 'sent' }, overrideAccess: true })
    const token = await createInvite(payload, { userId: user.id, email: user.email, purpose: 'confirm-consent', ttlDays: 60 })
    const unsubscribeUrl = `${siteUrl()}/unsubscribe/${makeUnsubscribeToken(user.id)}`
    const html = emailLayout(
      'club',
      [
        {
          heading: 'Please confirm your preferences',
          intro: `Hi ${user.firstName || 'there'} — we’ve updated how Rowville Eagles and Foundation Academy contact members. We’ll keep sending you service messages about your bookings, sessions, payments and account. We won’t send you club news, offers or programs unless you tell us you’d like them.`,
          cta: { label: 'Choose my preferences', href: `${siteUrl()}/account/confirm-preferences?invite=${token}` },
          after: 'It takes 10 seconds. If you do nothing, you’ll only receive service messages.',
        },
      ],
      { unsubscribeUrl },
    )
    await sendEmail(payload, {
      to: user.email,
      subject: 'Please confirm your communication preferences',
      html,
      sender: 'club',
      userId: user.id,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
  }
  return { sent: docs.length }
}
