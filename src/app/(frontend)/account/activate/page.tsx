import Link from 'next/link'
import type { Metadata } from 'next'
import { Crest } from '@/components/Logos'
import { payload } from '@/lib/payload'
import { checkInvite } from '@/lib/invites'
import { ActivateForm } from '../ActivateForm'
import { CreateAccountForm } from '../CreateAccountForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Create your account', robots: { index: false } }

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string; mode?: string; invite?: string }> }) {
  const { token, mode, invite } = await searchParams
  const reset = mode === 'reset' && token

  let body: React.ReactNode
  let title = 'Create your account'
  let intro = 'Finish setting up your account to see every booking, session and payment in one place.'
  if (reset) {
    title = 'Reset password'
    intro = 'Choose a new password.'
    body = <ActivateForm token={token} />
  } else if (invite) {
    const p = await payload()
    const check = await checkInvite(p, invite, 'create-account')
    if (check.ok) {
      const user = await p.findByID({ collection: 'users', id: check.userId, depth: 0, overrideAccess: true })
      body = user.activated ? (
        <p className="text-center">Your account is already set up. <Link href="/login" className="font-semibold text-brand underline">Log in</Link></p>
      ) : (
        <CreateAccountForm invite={invite} email={user.email} firstName={user.firstName} lastName={user.lastName} mobile={user.phone} />
      )
    } else {
      body = (
        <p className="text-center text-muted">
          {check.reason === 'expired' ? 'This link has expired.' : check.reason === 'used' ? 'This link has already been used.' : 'This link isn’t valid.'}{' '}
          <Link href="/account/forgot" className="font-semibold text-brand underline">Get a new link</Link> or <Link href="/login" className="font-semibold text-brand underline">log in</Link>.
        </p>
      )
    }
  } else if (token) {
    // Links sent before invite tokens existed (Payload reset tokens)
    body = <ActivateForm token={token} />
  } else {
    body = <p className="text-center text-muted">This link is missing its code. Please use the link from your email.</p>
  }

  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-black/5 sm:p-10">
        <Crest className="mx-auto h-16 w-auto" />
        <h1 className="mt-6 text-center font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">{title}</h1>
        <p className="mt-2 text-center text-sm text-muted">{intro}</p>
        <div className="mt-8">{body}</div>
      </div>
    </div>
  )
}
