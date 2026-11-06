'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { checkInvite, consumeInvite } from '@/lib/invites'
import { recordConsent, recordSignupConsent, updateMarketingPreferences } from '@/lib/consent'
import { CONSENT_WORDING } from '@/lib/consent-wording'
import { requestMeta } from '@/lib/request-meta'

export type ConsentFormState = { error?: string; saved?: boolean }

const MOBILE = /^(\+?61|0)4\d{8}$/

/** "Create your account" from an invite link: password + required service consent + marketing opt-outs. */
export async function createAccountFromInvite(_prev: ConsentFormState, fd: FormData): Promise<ConsentFormState> {
  const s = (k: string) => String(fd.get(k) ?? '').trim()
  const password = String(fd.get('password') ?? '')
  if (fd.get('serviceConsent') !== 'on') return { error: 'Please agree to receive service messages — we need these to manage your bookings and account.' }
  if (password.length < 8) return { error: 'Please choose a password of at least 8 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'The passwords don’t match.' }
  const mobile = s('mobile').replace(/\s+/g, '')
  if (mobile && !MOBILE.test(mobile)) return { error: 'Please enter an Australian mobile number, e.g. 0412 345 678.' }

  const p = await payload()
  const check = await checkInvite(p, s('invite'), 'create-account')
  if (!check.ok) {
    return { error: check.reason === 'expired' ? 'This link has expired — use “Forgot password” on the login page to get a new one.' : 'This link is no longer valid. If you already created your account, log in instead.' }
  }

  const user = await p.update({
    collection: 'users',
    id: check.userId,
    overrideAccess: true,
    data: {
      password,
      firstName: s('firstName') || undefined,
      lastName: s('lastName') || undefined,
      phone: mobile || undefined,
      activated: true,
    },
  })
  await recordSignupConsent(p, user, { optOutEmail: fd.get('optOutEmail') === 'on', optOutSms: fd.get('optOutSms') === 'on' }, await requestMeta())
  await consumeInvite(p, check.invite.id)

  const { token } = await p.login({ collection: 'users', data: { email: user.email, password } })
  if (token) {
    ;(await cookies()).set(`${p.config.cookiePrefix}-token`, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: p.collections.users.config.auth.tokenExpiration,
    })
  }
  redirect('/account?welcome=1')
}

/** Logged-in member changes marketing email / SMS separately. Service messages can't be turned off. */
export async function savePreferences(_prev: ConsentFormState, fd: FormData): Promise<ConsentFormState> {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' }
  const p = await payload()
  const fresh = await p.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
  await updateMarketingPreferences(p, fresh, { email: fd.get('marketingEmail') === 'on', sms: fd.get('marketingSms') === 'on' }, 'profile', await requestMeta())
  if (fresh.consentReviewStatus === 'pending' || fresh.consentReviewStatus === 'sent') {
    await p.update({ collection: 'users', id: fresh.id, data: { consentReviewStatus: 'confirmed' }, overrideAccess: true })
  }
  return { saved: true }
}

/** Existing members, from the one-time "confirm your preferences" email (no login needed). Opt-in, unticked by default. */
export async function confirmPreferencesFromEmail(_prev: ConsentFormState, fd: FormData): Promise<ConsentFormState> {
  if (fd.get('serviceConsent') !== 'on') return { error: 'Please agree to receive service messages so we can keep managing your bookings and account.' }
  const p = await payload()
  const check = await checkInvite(p, String(fd.get('invite') ?? ''), 'confirm-consent')
  if (!check.ok) return { error: check.reason === 'used' ? 'You’ve already confirmed your preferences — log in to change them any time.' : 'This link is no longer valid. Log in to set your preferences.' }
  const meta = await requestMeta()
  const user = await p.findByID({ collection: 'users', id: check.userId, depth: 0, overrideAccess: true })
  await recordConsent(p, user, { channel: 'service', action: 'granted', wording: CONSENT_WORDING.service, source: 'consent_email', basis: 'express' }, meta)
  const refreshed = await p.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
  await updateMarketingPreferences(p, refreshed, { email: fd.get('marketingEmail') === 'on', sms: fd.get('marketingSms') === 'on' }, 'consent_email', meta)
  await p.update({ collection: 'users', id: user.id, data: { consentReviewStatus: 'confirmed' }, overrideAccess: true })
  await consumeInvite(p, check.invite.id)
  return { saved: true }
}
