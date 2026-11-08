'use server'

import { headers } from 'next/headers'
import { payload } from '@/lib/payload'
import { checkStamp, clientIp, hashKey, normaliseEmail, throttle, validEmail } from '@/lib/form-guard'
import { sendEmail } from '@/lib/email'
import { emailLayout } from '@/lib/email-templates'
import { siteUrl } from '@/lib/payments'

export type WaitlistState = { done?: boolean; error?: string }
const WAITLIST_WORDING = 'Email me when Foundation+ launches, with a link to claim a free month of Premium.'

/**
 * Coming-soon sign-up. Always answers the same way for new and existing emails (never reveals who's on the
 * list); silently ignores bots (honeypot / impossible timing); rate-limited per IP and per email.
 */
export async function joinWaitlist(_prev: WaitlistState, fd: FormData): Promise<WaitlistState> {
  const email = normaliseEmail(String(fd.get('email') ?? ''))
  if (String(fd.get('website') ?? '')) return { done: true } // honeypot
  const stamp = checkStamp(String(fd.get('stamp') ?? ''))
  if (stamp === 'forged' || stamp === 'missing') return { done: true }
  if (stamp === 'too_fast') return { error: 'Please try again.' }
  if (stamp === 'expired') return { error: 'This page has been open a while — please refresh and try again.' }
  if (!validEmail(email)) return { error: 'Please enter a valid email address.' }
  const p = await payload()
  const h = await headers()
  const ok = await throttle(p, 'fplus-waitlist', [{ key: hashKey('ip', clientIp(h)), limit: 5 }, { key: hashKey('email', email), limit: 3 }])
  if (!ok) return { error: 'Too many attempts — please try again later.' }
  // Live: email a secure link instead (free month, or a free account)
  const { foundationSettings } = await import('@/academy/pdr/load')
  if ((await foundationSettings(p)).enabled) {
    const { emailLink } = await import('@/academy/pdr/billing/trial')
    try {
      await emailLink(p, email, fd.get('mode') === 'join' ? 'join' : 'trial')
    } catch {
      return { error: 'We couldn’t send the email just now — please try again in a minute.' }
    }
    return { done: true }
  }
  const { totalDocs } = await p.count({ collection: 'fplus-waitlist', where: { email: { equals: email } }, overrideAccess: true })
  if (!totalDocs) {
    await p.create({ collection: 'fplus-waitlist', overrideAccess: true, data: { email, source: String(fd.get('source') ?? 'foundation-plus').slice(0, 40), wording: WAITLIST_WORDING } })
    const html = emailLayout('academy', [
      {
        heading: 'You’re on the list',
        intro: 'Thanks for your interest in Foundation+, Foundation Academy’s online training platform. We’ll email you as soon as it launches, with a link to claim a <strong>free month of Premium</strong>.',
        cta: { label: 'See what’s coming', href: `${siteUrl()}/foundation-plus` },
        after: 'Didn’t sign up? You can ignore this email — we won’t contact you again unless you ask.',
      },
    ])
    await sendEmail(p, { to: email, subject: 'You’re on the Foundation+ waitlist', html, sender: 'academy' })
  }
  return { done: true }
}
