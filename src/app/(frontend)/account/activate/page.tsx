import Link from 'next/link'
import type { Metadata } from 'next'
import { Crest, RfaLogo } from '@/components/Logos'
import { accountBenefits } from '@/lib/account-reminders'
import { payload } from '@/lib/payload'
import { checkInvite } from '@/lib/invites'
import { ActivateForm } from '../ActivateForm'
import { CreateAccountForm } from '../CreateAccountForm'
import { newLinkAction } from './actions'

function NewLink({ invite, code, used, error }: { invite?: string; code?: string; used?: boolean; error?: string }) {
  return (
    <form action={newLinkAction} className="space-y-3 text-center" data-new-link>
      {invite && <input type="hidden" name="invite" value={invite} />}
      {code && <input type="hidden" name="code" value={code} />}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110">Email me a new link</button>
      <p className="text-sm text-muted">{used ? 'Already set up? ' : 'Or '}<Link href="/login" className="font-semibold text-brand underline">log in</Link>.</p>
    </form>
  )
}

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Create your account', robots: { index: false } }

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string; mode?: string; invite?: string; next?: string; expired?: string; code?: string; sent?: string; error?: string }> }) {
  const { token, mode, invite, next, expired, code, sent, error } = await searchParams
  const reset = mode === 'reset' && token

  let body: React.ReactNode
  let academy = false
  let benefits = false
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
      // Families who've only booked with Foundation Academy see the Academy look
      const [a, c] = await Promise.all([
        p.count({ collection: 'academy-bookings', where: { or: [{ account: { equals: user.id } }, { 'contact.email': { equals: user.email } }] }, overrideAccess: true }),
        p.count({ collection: 'bookings', where: { account: { equals: user.id } }, overrideAccess: true }),
      ])
      academy = a.totalDocs > 0 && c.totalDocs === 0
      benefits = !user.activated
      body = user.activated ? (
        <p className="text-center">Your account is already set up. <Link href="/login" className="font-semibold text-brand underline">Log in</Link></p>
      ) : (
        <CreateAccountForm invite={invite} email={user.email} firstName={user.firstName} lastName={user.lastName} mobile={user.phone} next={next} />
      )
    } else {
      title = check.reason === 'used' ? 'Link already used' : 'This link has expired'
      intro = check.reason === 'used' ? 'If you’ve already set up your account, just log in.' : 'Links are personal and work for 14 days.'
      body = <NewLink invite={invite} used={check.reason === 'used'} />
    }
  } else if (sent) {
    title = 'Check your email'
    intro = 'If that link was yours, we’ve emailed you a fresh one. It works for 14 days.'
    body = <p className="text-center"><Link href="/login" className="font-semibold text-brand underline">Log in</Link></p>
  } else if (expired) {
    title = 'This link has expired'
    intro = 'Links are personal and work for 14 days.'
    body = <NewLink code={code} error={error} />
  } else if (token) {
    // Links sent before invite tokens existed (Payload reset tokens)
    body = <ActivateForm token={token} />
  } else {
    body = <p className="text-center text-muted">This link is missing its code. Please use the link from your email.</p>
  }

  return (
    <div {...(academy ? { 'data-brand': 'academy', 'data-page-brand': 'academy' } : {})} className="container-x grid min-h-[70vh] place-items-center py-16">
      <div className="panel w-full max-w-lg rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-black/5 sm:p-10 [[data-brand=academy]_&]:rounded-sm">
        {academy ? <RfaLogo className="mx-auto h-12 w-auto" /> : <Crest className="mx-auto h-16 w-auto" />}
        <h1 className="mt-6 text-center font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">{title}</h1>
        <p className="mt-2 text-center text-sm text-muted">{intro}</p>
        {benefits && (
          <ul className="mt-6 grid gap-x-4 gap-y-1.5 rounded-xl border border-line p-4 text-sm sm:grid-cols-2 [[data-brand=academy]_&]:rounded-none">
            {accountBenefits.map((b) => <li key={b} className="flex gap-2"><span aria-hidden className="text-brand [[data-brand=academy]_&]:text-white">✓</span>{b}</li>)}
          </ul>
        )}
        <div className="mt-8">{body}</div>
      </div>
    </div>
  )
}
