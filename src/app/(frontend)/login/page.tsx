import Link from 'next/link'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { Crest, RfaLogo } from '@/components/Logos'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Log in', robots: { index: false } }

export default async function LoginPage() {
  if (await currentUser()) redirect('/account')
  return (
    <div className="container-x flex min-h-[70vh] flex-col items-center justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-black/5 sm:p-10">
        <Crest className="mx-auto h-16 w-auto" />
        <h1 className="mt-6 text-center font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">Member login</h1>
        <p className="mt-2 text-center text-sm text-muted">
          For Rowville Eagles and Rowville Foundation Academy families — view bookings, pay registration and shop team kit.
        </p>
        <div className="mt-8">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
      <div className="mt-6 w-full max-w-md">
        <p className="mb-3 text-center text-sm text-muted">New here? Choose where to start — players can join the club, the Academy, or both.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/join" className="group rounded-2xl bg-[#0f2a55] p-5 text-white transition hover:-translate-y-0.5">
            <Crest className="h-9 w-auto" />
            <p className="mt-3 font-[family-name:var(--font-barlow)] text-xl font-bold uppercase">Play for the club</p>
            <p className="mt-1 text-sm text-white/70">MiniRoos, juniors & seniors trials</p>
            <p className="mt-3 text-sm font-semibold text-accent">Join us →</p>
          </Link>
          <Link href="/academy/trial" className="gloss gloss-sheen group rounded-2xl p-5 text-white transition hover:-translate-y-0.5">
            <RfaLogo className="h-7 w-auto" ink="#fff" paper="#000" />
            <p className="mt-4 font-[family-name:var(--font-grotesk)] text-xl font-semibold uppercase tracking-tight">Train with RFA</p>
            <p className="mt-1 text-sm text-white/60">Elite development, term programs & 1-on-1s</p>
            <p className="mt-3 text-sm font-semibold">Book a trial →</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
