'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { rateLimit } from '@/lib/form-guard'
import { sendEmail } from '@/lib/email'
import { emailLayout } from '@/lib/email-templates'
import { siteUrl } from '@/lib/payments'
import { createLoginLink, LOGIN_LINK_MINUTES, useLoginLink } from '@/lib/login-link'
import { homeFor } from '@/lib/home'

export type LinkState = { error?: string; done?: boolean }

/** Email a one-use login link. Not for admin accounts (they use their password). Same answer whether or not the email has an account. */
export async function requestLoginLink(_prev: LinkState, fd: FormData): Promise<LinkState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email.' }
  const p = await payload()
  const limited = await rateLimit(p, 'login-link', { email })
  if (limited) return { error: limited }
  const { docs } = await p.find({ pagination: false, collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
  const user = docs[0]
  if (user && !user.roles?.includes('admin')) {
    const token = await createLoginLink(p, user.id)
    const next = String(fd.get('next') ?? '')
    const html = emailLayout('club', [
      {
        heading: 'Your login link',
        intro: `Tap the button to log in to your Rowville Eagles account. The link works once and expires in ${LOGIN_LINK_MINUTES} minutes. If you didn’t ask for it, you can ignore this email.`,
        cta: { label: 'Log me in', href: `${siteUrl()}/login/link?token=${token}${next.startsWith('/') && !next.startsWith('//') ? `&next=${encodeURIComponent(next)}` : ''}` },
      },
    ])
    await sendEmail(p, { to: email, subject: 'Your Rowville Eagles login link', html, sender: 'club' })
  }
  return { done: true }
}

/** Used from the link page's button (a GET would let email scanners use the link up). */
export async function loginWithLink(fd: FormData) {
  const token = String(fd.get('token') ?? '')
  const next = String(fd.get('next') ?? '')
  const p = await payload()
  const user = await useLoginLink(p, token)
  if (!user) redirect('/login/link?expired=1')
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : homeFor(user))
}
