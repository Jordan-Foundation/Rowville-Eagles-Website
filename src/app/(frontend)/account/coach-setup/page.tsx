import Link from 'next/link'
import type { Metadata } from 'next'
import { Crest } from '@/components/Logos'
import { payload } from '@/lib/payload'
import { checkInvite } from '@/lib/invites'
import { CoachSetupForm } from './CoachSetupForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Create your coach account', robots: { index: false } }

/** Private link sent by Management: the coach creates their account and sends their WWCC. */
export default async function CoachSetupPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams
  const p = await payload()
  const check = await checkInvite(p, invite, 'coach-invite')
  let body: React.ReactNode
  if (check.ok) {
    const user = await p.findByID({ collection: 'users', id: check.userId, depth: 0, overrideAccess: true })
    body = <CoachSetupForm invite={invite!} email={user.email} firstName={user.firstName} lastName={user.lastName} mobile={user.phone} existing={Boolean(user.activated)} />
  } else {
    body = (
      <p className="text-center text-muted">
        {check.reason === 'expired' ? 'This link has expired — ask Management to send you a new one.' : check.reason === 'used' ? 'You’ve already used this link.' : 'This link isn’t valid.'}{' '}
        <Link href="/login?next=/coach" className="font-semibold text-brand underline">Log in</Link>
      </p>
    )
  }
  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-16">
      <div className="panel w-full max-w-lg rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-black/5 sm:p-10">
        <Crest className="mx-auto h-16 w-auto" />
        <h1 className="mt-6 text-center font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">Coach sign-up</h1>
        <p className="mt-2 text-center text-sm text-muted">Create your account for the Rowville Eagles and Foundation Academy coach portal.</p>
        <div className="mt-8">{body}</div>
      </div>
    </div>
  )
}
