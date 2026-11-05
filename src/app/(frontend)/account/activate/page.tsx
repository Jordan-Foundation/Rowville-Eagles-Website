import type { Metadata } from 'next'
import { Crest } from '@/components/Logos'
import { ActivateForm } from '../ActivateForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Set your password', robots: { index: false } }

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string; mode?: string }> }) {
  const { token, mode } = await searchParams
  const reset = mode === 'reset'
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-black/5 sm:p-10">
        <Crest className="mx-auto h-16 w-auto" />
        <h1 className="mt-6 text-center font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">{reset ? 'Reset password' : 'Create your account'}</h1>
        <p className="mt-2 text-center text-sm text-muted">{reset ? 'Choose a new password.' : 'Choose a password to finish setting up your Rowville Eagles account.'}</p>
        <div className="mt-8">{token ? <ActivateForm token={token} /> : <p className="text-center text-muted">This link is missing its code. Please use the link from your email.</p>}</div>
      </div>
    </div>
  )
}
