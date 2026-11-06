import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { PreferencesForm } from './PreferencesForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Communication preferences', robots: { index: false } }

const channelLabel: Record<string, string> = {
  service: 'Service messages',
  marketing_email: 'Marketing email',
  marketing_sms: 'Marketing SMS',
  sms_all: 'All SMS',
}
const sourceLabel: Record<string, string> = {
  signup: 'Sign-up',
  checkout: 'Checkout',
  profile: 'This page',
  consent_email: 'Confirmation email',
  unsubscribe_link: 'Unsubscribe link',
  stop_reply: 'STOP reply',
  admin: 'Club admin',
}

export default async function PreferencesPage() {
  const me = await currentUser()
  if (!me) redirect('/login?next=/account/preferences')
  const p = await payload()
  const user = await p.findByID({ collection: 'users', id: me.id, depth: 0, overrideAccess: true })
  const history = await p.find({ collection: 'consent-records', where: { user: { equals: user.id } }, sort: '-createdAt', limit: 30, depth: 0, overrideAccess: true })

  return (
    <div className="container-x max-w-3xl py-14">
      <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Communication preferences</h1>

      <section className="mt-10">
        <h2 className="font-semibold">Service messages — always on</h2>
        <p className="mt-2 text-sm text-muted">
          Booking confirmations, session changes and cancellations, payment receipts and failed payments, account and security messages, and important
          club or team updates. We need to send these while your account is active.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-semibold">Programs, offers & rewards — your choice</h2>
        <PreferencesForm marketingEmail={Boolean(user.marketingEmail)} marketingSms={Boolean(user.marketingSms)} smsOptOut={Boolean(user.smsOptOut)} />
      </section>

      {history.docs.length > 0 && (
        <section className="mt-12">
          <h2 className="font-semibold">History</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line text-sm">
            {history.docs.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                <span>
                  {channelLabel[r.channel]}: <strong>{r.action === 'granted' ? 'on' : 'off'}</strong>
                </span>
                <span className="text-muted">
                  {sourceLabel[r.source]} · {formatDate(r.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
