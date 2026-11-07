import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { formStamp } from '@/lib/form-guard'
import { foundationSettings } from '@/academy/pdr/load'
import { FoundationPlusLogo } from '@/components/FoundationPlusLogo'
import { WaitlistForm } from '../_parts/WaitlistForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Start Foundation+ free', description: 'Create a free Foundation+ account: Level 1 of every area, video challenges, leaderboards and badges.' }

/** Free plan sign-up: we email a secure link to create the player portal account. */
export default async function JoinPage() {
  const p = await payload()
  if (!(await foundationSettings(p)).enabled) redirect('/foundation-plus#free-month')
  return (
    <div data-page-brand="fplus" className="fp-ink">
      <div className="container-x max-w-2xl py-16">
        <FoundationPlusLogo variant="horizontal" tone="white" height={44} />
        <h1 className="fp-heading mt-8 text-4xl sm:text-5xl">Start free</h1>
        <p className="mt-4 text-white/75">Level 1 of every area — 24 drills, video challenges, leaderboards and badges. Enter your email and we’ll send you a secure link to create your player portal account.</p>
        <div className="relative mt-8"><WaitlistForm stamp={formStamp()} live mode="join" source="join" /></div>
        <p className="mt-4 text-xs text-white/50">Already have an account? <a href="/login?next=/foundation-plus" className="underline">Log in</a> — Foundation+ is on your player page.</p>
      </div>
    </div>
  )
}
