import Link from 'next/link'
import type { Metadata } from 'next'
import { EmailLinkForm } from './EmailLinkForm'

export const metadata: Metadata = { title: 'Log in with an email link', robots: { index: false } }

export default async function EmailLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-line p-8 sm:p-10">
        <h1 className="text-center font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">Log in by email</h1>
        <p className="mt-2 text-center text-sm text-muted">No password needed — we’ll email you a link that logs you straight in.</p>
        <div className="mt-8"><EmailLinkForm next={next} /></div>
        <p className="mt-6 text-center text-sm"><Link href="/login" className="text-muted underline hover:text-ink">Log in with my password</Link></p>
      </div>
    </div>
  )
}
