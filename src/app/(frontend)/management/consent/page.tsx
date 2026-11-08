import { requireManagement } from '@/lib/management'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { hasRole } from '@/access'
import { SendButton } from './SendButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Consent review', robots: { index: false } }

const statuses = [
  { value: 'pending', label: 'Existing members — not yet emailed' },
  { value: 'sent', label: 'Emailed, waiting for answer' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'new', label: 'New accounts (chose on sign-up)' },
] as const

export default async function ConsentReviewPage() {
  const user = await requireManagement('/management/consent')
  const p = await payload()
  const counts = await Promise.all(
    statuses.map(async (s) => ({ ...s, n: (await p.count({ collection: 'users', where: { consentReviewStatus: { equals: s.value } }, overrideAccess: true })).totalDocs })),
  )
  const [optedInEmail, optedInSms] = await Promise.all([
    p.count({ collection: 'users', where: { marketingEmail: { equals: true } }, overrideAccess: true }),
    p.count({ collection: 'users', where: { marketingSms: { equals: true }, smsOptOut: { not_equals: true } }, overrideAccess: true }),
  ])
  const pending = counts.find((c) => c.value === 'pending')!.n

  return (
    <div className="container-x max-w-3xl py-14">
      <p className="eyebrow !text-brand">Management</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Consent review</h1>
      <p className="mt-4 text-muted">
        Existing members are treated as opted out of marketing until they confirm. This sends them a one-time email asking for their preferences.
      </p>
      <dl className="mt-8 divide-y divide-line rounded-2xl border border-line">
        {counts.map((c) => (
          <div key={c.value} className="flex justify-between px-5 py-3">
            <dt className="text-muted">{c.label}</dt>
            <dd className="font-semibold">{c.n}</dd>
          </div>
        ))}
        <div className="flex justify-between px-5 py-3">
          <dt className="text-muted">Can receive marketing email / SMS right now</dt>
          <dd className="font-semibold">{optedInEmail.totalDocs} / {optedInSms.totalDocs}</dd>
        </div>
      </dl>
      <div className="mt-8">
        {hasRole(user, 'admin') ? <SendButton pending={pending} /> : <p className="text-sm text-muted">Only admins can send the email.</p>}
      </div>
    </div>
  )
}
