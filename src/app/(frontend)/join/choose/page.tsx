import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { clubTrialOptions } from '@/lib/trial-options'
import { ChooseForm } from './ChooseForm'
import { groupLabel } from '@/lib/age-groups'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Choose a trial night', robots: { index: false } }

export default async function ChoosePage({ searchParams }: { searchParams: Promise<{ ref?: string; token?: string }> }) {
  const { ref, token } = await searchParams
  const p = await payload()
  const reg = ref
    ? (await p.find({ collection: 'trial-registrations', where: { reference: { equals: ref } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })).docs[0]
    : undefined
  const valid = reg && token && reg.token === token
  const options = valid && reg.birthYear ? (await clubTrialOptions(p)).filter((o) => o.birthYears.includes(reg.birthYear!)) : []
  const label = reg?.birthYear ? groupLabel(reg.birthYear) : 'this age group'

  return (
    <div className="container-x max-w-2xl py-16">
      <h1 className="font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Choose a trial night</h1>
      {!valid ? (
        <p className="mt-6 text-muted">This link isn’t valid. <Link href="/join" className="font-semibold underline">Register here</Link> or contact the club.</p>
      ) : reg.status !== 'interested' ? (
        <p className="mt-6 text-muted">A trial is already booked for {reg.player.firstName} — check your email for the details.</p>
      ) : options.length === 0 ? (
        <p className="mt-6 text-muted">There are no open trial nights for {label} right now. We’ll email you when more are added.</p>
      ) : (
        <>
          <p className="mt-4 text-muted">For {reg.player.firstName} {reg.player.lastName} · {label}</p>
          <div className="mt-8"><ChooseForm refCode={reg.reference ?? ''} token={token!} birthYear={reg.birthYear!} options={options} /></div>
        </>
      )}
    </div>
  )
}
