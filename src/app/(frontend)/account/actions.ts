'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { sendEmail } from '@/lib/email'
import { emailLayout } from '@/lib/email-templates'
import { siteUrl } from '@/lib/payments'

export type FormState = { error?: string; done?: boolean }

export async function activateAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get('token') ?? '')
  const password = String(fd.get('password') ?? '')
  if (password.length < 8) return { error: 'Please choose a password of at least 8 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'The passwords don’t match.' }

  const p = await payload()
  let result
  try {
    result = await p.resetPassword({ collection: 'users', data: { token, password }, overrideAccess: true })
  } catch {
    return { error: 'This link has expired or was already used. Use “Forgot password” to get a new one.' }
  }
  if (!result.token || !result.user) return { error: 'Something went wrong — please try again.' }
  await p.update({ collection: 'users', id: (result.user as { id: number }).id, data: { activated: true }, overrideAccess: true })

  const authCfg = p.collections.users.config.auth
  ;(await cookies()).set(`${p.config.cookiePrefix}-token`, result.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: authCfg.tokenExpiration,
  })
  redirect('/account?welcome=1')
}

export async function requestReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email.' }
  const p = await payload()
  const { docs } = await p.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
  if (docs[0]) {
    const token = await p.forgotPassword({ collection: 'users', data: { email }, disableEmail: true })
    const html = emailLayout('club', [
      {
        heading: 'Reset your password',
        intro: 'Use the button below to choose a new password for your Rowville Eagles account. If you didn’t ask for this, you can ignore this email.',
        cta: { label: 'Choose a new password', href: `${siteUrl()}/account/activate?token=${encodeURIComponent(String(token))}&mode=reset` },
      },
    ])
    await sendEmail(p, { to: email, subject: 'Reset your Rowville Eagles password', html, sender: 'club' })
  }
  // Same response either way — never reveal which emails have accounts.
  return { done: true }
}
