import Link from 'next/link'
import type { Metadata } from 'next'
import { Crest } from '@/components/Logos'
import { payload } from '@/lib/payload'
import { checkInvite } from '@/lib/invites'
import { ConfirmForm } from './ConfirmForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Confirm your preferences', robots: { index: false } }

export default async function ConfirmPreferencesPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams
  const check = await checkInvite(await payload(), invite, 'confirm-consent')
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-black/5 sm:p-10">
        <Crest className="mx-auto h-16 w-auto" />
        <h1 className="mt-6 text-center font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">Your preferences</h1>
        <p className="mt-2 text-center text-sm text-muted">Choose how Rowville Eagles and Foundation Academy can contact you.</p>
        <div className="mt-8">
          {check.ok ? (
            <ConfirmForm invite={invite!} />
          ) : (
            <p className="text-center text-muted">
              {check.reason === 'used' ? 'You’ve already confirmed your preferences.' : 'This link isn’t valid any more.'}{' '}
              <Link href="/account/preferences" className="font-semibold text-brand underline">Log in to manage them</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
