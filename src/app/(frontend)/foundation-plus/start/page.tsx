import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { checkInvite } from '@/lib/invites'
import { CONSENT_WORDING } from '@/lib/consent-wording'
import { formatAUD } from '@/lib/format'
import { foundationSettings, isStaffOrCoach } from '@/academy/pdr/load'
import { familyPlayers } from '@/academy/pdr/billing/subscribe'
import { trialEligibility } from '@/academy/pdr/billing/trial'
import { displayPrices } from '@/academy/pdr/billing/stripe'
import { FoundationPlusLogo } from '@/components/FoundationPlusLogo'
import { AddPlayer } from '../subscribe/Forms'
import { CreateAccount, StartTrial } from './Forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Get started with Foundation+', robots: { index: false } }

const LIVE = new Set(['active', 'trialing', 'past_due'])

export default async function StartPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams
  const p = await payload()
  const [settings, user] = await Promise.all([foundationSettings(p), currentUser()])
  if (!settings.enabled && !isStaffOrCoach(user)) redirect('/foundation-plus')
  let purpose: 'fplus-trial' | 'fplus-join' | null = null
  let check: Awaited<ReturnType<typeof checkInvite>> | null = null
  for (const pu of ['fplus-trial', 'fplus-join'] as const) {
    const c = await checkInvite(p, token, pu)
    if (c.ok) {
      purpose = pu
      check = c
      break
    }
  }
  const trial = purpose === 'fplus-trial'
  const shell = (title: string, body: React.ReactNode) => (
    <div data-page-brand="fplus" className="bg-white text-[#0b0b0c]">
      <div className="fp-ink"><div className="container-x py-10"><FoundationPlusLogo variant="horizontal" tone="white" height={40} /><h1 className="fp-heading mt-6 text-4xl sm:text-5xl">{title}</h1></div></div>
      <div className="container-x max-w-2xl py-12">{body}</div>
    </div>
  )
  if (!check?.ok) {
    return shell('Link expired', <p>This link has expired or was already used. <Link href="/foundation-plus#free-month" className="font-semibold underline">Request a new one</Link>.</p>)
  }
  const owner = (await p.findByID({ collection: 'users', id: check.userId, depth: 0, overrideAccess: true }))
  const title = trial ? 'Your free month of Premium' : 'Your free Foundation+ account'
  // 1 · Account
  if (!owner.activated) {
    return shell(title, (
      <>
        <p className="fp-label text-xs text-[#0b0b0c]/60">Step 1 of 2 · Create your player portal account</p>
        <p className="mt-2 mb-6 text-[#0b0b0c]/70">Foundation+ lives in your Rowville / Foundation Academy player portal — one login for everything.</p>
        <CreateAccount token={token} email={owner.email} service={CONSENT_WORDING.service} marketing={CONSENT_WORDING.marketingSignupOptIn} />
      </>
    ))
  }
  if (!user || user.id !== owner.id) {
    return shell(title, (
      <>
        <p>{user ? `You’re logged in as ${user.email}, but this link is for ${owner.email}. ` : ''}Please log in as <strong>{owner.email}</strong> to continue.</p>
        <Link href={`/login?next=${encodeURIComponent(`/foundation-plus/start?token=${token}`)}`} className="fp-label mt-6 inline-block bg-[#0b0b0c] px-6 py-4 text-xs text-white">Log in</Link>
      </>
    ))
  }
  // 2 · Player
  const kids = await familyPlayers(p, user)
  const prices = await displayPrices(p)
  const s = await p.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true })
  return shell(title, (
    <>
      <p className="fp-label text-xs text-[#0b0b0c]/60">{trial ? 'Step 2 of 2 · Choose the player' : 'Choose the player'}</p>
      {kids.length === 0 && <p className="mt-2 text-sm">Add the player who’ll be training:</p>}
      {trial && kids.length > 0 && (
        <div className="mt-4">
          <StartTrial
            token={token}
            trialDays={s.plans?.trialDays ?? 30}
            price={formatAUD(prices.premium_month)}
            players={kids.map((k) => {
              const e = trialEligibility(kids, k)
              return { id: k.id, name: `${k.firstName} ${k.lastName}`, ok: e.ok, note: e.ok ? 'Free month of Premium' : LIVE.has(k.pdr?.subscriptionStatus ?? '') ? `Already on ${k.pdr?.tier}` : 'Free month already used' }
            })}
          />
        </div>
      )}
      {!trial && kids.length > 0 && (
        <div className="mt-4 grid gap-2">
          {kids.map((k) => (
            <Link key={k.id} href={`/foundation-plus/${k.id}`} className="fp-label flex justify-between border border-[#0b0b0c] px-5 py-4 text-xs hover:bg-[#0b0b0c] hover:text-white">
              <span>Open {k.firstName}’s player page</span><span aria-hidden>→</span>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-8"><AddPlayer /></div>
    </>
  ))
}
