'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { checkInvite } from '@/lib/invites'
import { recordSignupConsent } from '@/lib/consent'
import { BillingError, familyPlayers, startSubscription } from '@/academy/pdr/billing/subscribe'
import { trialEligibility } from '@/academy/pdr/billing/trial'

export type StartState = { error?: string }

async function tokenFor(token: string) {
  const p = await payload()
  for (const purpose of ['fplus-trial', 'fplus-join'] as const) {
    const c = await checkInvite(p, token, purpose)
    if (c.ok) return { p, check: c, purpose }
  }
  return null
}

/** Step 1 for new families: set up the player portal account the link was sent to, then log them in. */
export async function createAccountAction(_prev: StartState, fd: FormData): Promise<StartState> {
  const token = String(fd.get('token') ?? '')
  const t = await tokenFor(token)
  if (!t) return { error: 'This link has expired or was already used — request a new one on the Foundation+ page.' }
  const { p, check } = t
  const firstName = String(fd.get('firstName') ?? '').trim()
  const lastName = String(fd.get('lastName') ?? '').trim()
  const phone = String(fd.get('phone') ?? '').trim()
  const password = String(fd.get('password') ?? '')
  if (!firstName || !lastName) return { error: 'Please enter your name.' }
  if (!/^(\+?61|0)4[\d\s]{8,12}$/.test(phone.replace(/[\s()-]/g, ''))) return { error: 'Please enter an Australian mobile number.' }
  if (password.length < 8) return { error: 'Please choose a password of at least 8 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'The passwords don’t match.' }
  if (fd.get('service') !== 'on') return { error: 'Please agree to receive service messages about your account.' }
  const user = await p.findByID({ collection: 'users', id: check.userId, depth: 0, overrideAccess: true })
  if (user.activated) return { error: 'This account is already set up — please log in.' }
  await p.update({ collection: 'users', id: user.id, overrideAccess: true, data: { firstName, lastName, phone, password, activated: true } })
  const h = await headers()
  await recordSignupConsent(p, { id: user.id, email: user.email, phone }, { marketingOptIn: fd.get('marketing') === 'on' }, { ip: h.get('x-forwarded-for'), userAgent: h.get('user-agent') })
  const login = await p.login({ collection: 'users', data: { email: user.email, password } })
  if (login.token) {
    ;(await cookies()).set(`${p.config.cookiePrefix}-token`, login.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: p.collections.users.config.auth.tokenExpiration,
    })
  }
  redirect(`/foundation-plus/start?token=${encodeURIComponent(token)}`)
}

/** Step 2 (free month): Stripe Checkout for Premium monthly with the trial; card collected up front. */
export async function startTrialAction(_prev: StartState, fd: FormData): Promise<StartState> {
  const token = String(fd.get('token') ?? '')
  const t = await tokenFor(token)
  if (!t || t.purpose !== 'fplus-trial') return { error: 'This link has expired — request a new one on the Foundation+ page.' }
  const user = await currentUser()
  if (!user || user.id !== t.check.userId) return { error: 'Please log in with the account this link was sent to.' }
  const kids = await familyPlayers(t.p, user)
  const kid = kids.find((k) => k.id === Number(fd.get('player'))) ?? null
  if (!kid) return { error: 'Choose a player.' }
  const ok = trialEligibility(kids, kid)
  if (!ok.ok) return { error: ok.reason }
  const s = await t.p.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true })
  let url: string
  try {
    url = await startSubscription(t.p, user, { playerId: kid.id, plan: 'premium_month', trialDays: s.plans?.trialDays ?? 30 })
  } catch (e) {
    if (e instanceof BillingError) return { error: e.message }
    t.p.logger.error({ err: e, msg: 'Starting a Foundation+ free month failed' })
    return { error: 'We couldn’t start checkout. Please try again.' }
  }
  redirect(url)
}
