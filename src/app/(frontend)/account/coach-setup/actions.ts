'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { checkInvite, consumeInvite } from '@/lib/invites'
import { recordSignupConsent } from '@/lib/consent'
import { requestMeta } from '@/lib/request-meta'
import { MOBILE, saveWwcc } from '@/lib/coach-signup'
import { wwccFromForm } from '@/lib/coach-signup-form'

export type CoachSetupState = { error?: string }

/** The coach's sign-up link: create the account (or, for an existing account, just add the WWCC). */
export async function completeCoachSetup(_prev: CoachSetupState, fd: FormData): Promise<CoachSetupState> {
  const s = (k: string) => String(fd.get(k) ?? '').trim()
  const p = await payload()
  const check = await checkInvite(p, s('invite'), 'coach-invite')
  if (!check.ok) return { error: check.reason === 'expired' ? 'This link has expired — ask Management to send a new one.' : 'This link is no longer valid. If you’ve already signed up, log in instead.' }
  const user = await p.findByID({ collection: 'users', id: check.userId, depth: 0, overrideAccess: true })
  const isNew = !user.activated
  const password = String(fd.get('password') ?? '')
  if (isNew) {
    if (!s('firstName') || !s('lastName')) return { error: 'Please enter your first and last name.' }
    const mobile = s('mobile').replace(/\s+/g, '')
    if (!MOBILE.test(mobile)) return { error: 'Please enter an Australian mobile number, e.g. 0412 345 678.' }
    if (password.length < 8) return { error: 'Please choose a password of at least 8 characters.' }
    if (password !== String(fd.get('confirm') ?? '')) return { error: 'The passwords don’t match.' }
    if (fd.get('serviceConsent') !== 'on') return { error: 'Please agree to receive service messages — we use these for your sessions, cover requests and reminders.' }
  }
  const w = await wwccFromForm(fd)
  if ('error' in w) return { error: w.error }

  let fresh = user
  if (isNew) {
    fresh = await p.update({ collection: 'users', id: user.id, overrideAccess: true, data: { password, firstName: s('firstName'), lastName: s('lastName'), phone: s('mobile').replace(/\s+/g, ''), activated: true } })
    await recordSignupConsent(p, fresh, { marketingOptIn: false }, await requestMeta())
  }
  try {
    await saveWwcc(p, fresh, w)
  } catch {
    return { error: 'We couldn’t read that card photo — please try a clearer photo (JPG or PNG) or a PDF.' }
  }
  await consumeInvite(p, check.invite.id)
  if (!isNew) redirect('/login?next=/coach&coach=1')
  const { token } = await p.login({ collection: 'users', data: { email: fresh.email, password } })
  if (token) {
    ;(await cookies()).set(`${p.config.cookiePrefix}-token`, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: p.collections.users.config.auth.tokenExpiration })
  }
  redirect('/coach/profile?welcome=1')
}
