import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Unsubscribed', robots: { index: false } }

export default async function UnsubscribedPage({ searchParams }: { searchParams: Promise<{ invalid?: string }> }) {
  const { invalid } = await searchParams
  return (
    <div className="container-x max-w-xl py-24 text-center">
      <h1 className="font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">{invalid ? 'Link not recognised' : 'You’re unsubscribed'}</h1>
      <p className="mt-4 text-muted">
        {invalid
          ? 'We couldn’t match this link to an account. Log in to manage your preferences instead.'
          : 'You won’t receive any more programs, offers or rewards emails from us. You’ll still get service messages about your bookings, payments and account.'}
      </p>
      <p className="mt-8">
        <Link href="/account/preferences" className="font-semibold text-brand underline">Manage preferences</Link>
      </p>
    </div>
  )
}
