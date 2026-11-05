import Link from 'next/link'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { Crest } from '@/components/Logos'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Log in', robots: { index: false } }

export default async function LoginPage() {
  if (await currentUser()) redirect('/account')
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-black/5 sm:p-10">
        <Crest className="mx-auto h-16 w-auto" />
        <h1 className="mt-6 text-center font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">Member login</h1>
        <p className="mt-2 text-center text-sm text-muted">Players and families — view bookings, pay registration and shop team kit.</p>
        <div className="mt-8">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-8 border-t border-line pt-6 text-center text-sm text-muted">
          New to the club? <Link href="/join" className="font-semibold text-brand underline">Join us for trials</Link>
        </p>
      </div>
    </div>
  )
}
