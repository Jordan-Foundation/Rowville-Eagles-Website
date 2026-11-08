import Link from 'next/link'
import { PromoNotice } from '@/promotions/PromoNotice'
import type { Metadata } from 'next'
import { formatAUD, formatDate } from '@/lib/payload'
import { getAgeRules } from '@/lib/age-rules'
import { fullLabel, groupInfo } from '@/lib/age-groups'
import { awaitingPayment, isOverdue } from '@/selections/payment'
import type { Participant } from '@/payload-types'
import { loadPayable } from './load'
import { PayForm } from './PayForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Complete registration', robots: { index: false } }

export default async function PayPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ ref }, { t }] = await Promise.all([params, searchParams])
  const data = await loadPayable(ref, t)
  if (!data) {
    return (
      <div className="container-x max-w-2xl py-16">
        <h1 className="font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">Link not valid</h1>
        <p className="mt-4 text-muted">Please <Link href={`/login?next=/selections/pay/${ref}`} className="font-semibold text-brand underline">log in to your account</Link> to complete registration, or contact the club.</p>
      </div>
    )
  }
  const { p, entry, round, program, squad, fee } = data
  const rules = await getAgeRules(p)
  const by = entry.playingBirthYear ?? entry.birthYear
  const kid = entry.participant && typeof entry.participant === 'object' ? (entry.participant as Participant) : null
  const event = round.kind === 'tournament' ? (program?.title ?? round.title) : `Rowville Eagles ${round.season}`

  return (
    <div className="container-x grid max-w-5xl gap-10 py-14 lg:grid-cols-[1fr_20rem]">
      <div>
        <p className="eyebrow !text-brand">{entry.status === 'registered' ? 'Registered' : awaitingPayment(entry) ? `${round.kind === 'tournament' ? 'Selected' : 'Successful'} · complete registration` : 'Registration'}</p>
        <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase sm:text-5xl">{entry.player.firstName} {entry.player.lastName}</h1>
        {program && <div className="mt-6"><PromoNotice targets={[round.kind === 'tournament' ? { kind: 'tournament', roundId: round.id } : { kind: 'program', programId: program.id, programType: program.type }]} /></div>}
        {entry.status === 'registered' ? (
          <p className="mt-6 rounded-2xl border border-emerald-600/40 bg-emerald-50 p-6 text-emerald-900">All done — {entry.player.firstName}’s registration is paid. <Link href="/account" className="font-semibold underline">Go to your account</Link></p>
        ) : !awaitingPayment(entry) ? (
          <p className="mt-6 rounded-2xl border border-line p-6 text-muted">This place is no longer available{entry.status === 'released' ? ' — it was released after the payment deadline' : ''}. Please contact us if you have any questions.</p>
        ) : (
          <>
            <p className="mt-3 text-muted">
              Congratulations! {entry.player.firstName} has a place in <strong className="text-ink">{squad?.name ?? event}</strong>. Pay by{' '}
              <strong className={isOverdue(entry) ? 'text-red-600' : 'text-ink'}>{entry.paymentDueAt ? formatDate(entry.paymentDueAt, { weekday: 'long', day: 'numeric', month: 'long' }) : 'soon'}</strong> to confirm it.
            </p>
            <div className="mt-8">
              <PayForm refCode={entry.reference!} token={t} price={formatAUD(fee)} defaults={{ medical: kid?.medical?.conditions ?? '', emergencyName: kid?.medical?.emergencyContact ?? '', emergencyPhone: kid?.medical?.emergencyPhone ?? '', photoConsent: Boolean(kid?.photoConsent) }} />
            </div>
          </>
        )}
      </div>
      <aside className="h-fit rounded-2xl border border-line bg-surface-2 p-6 text-sm">
        <p className="font-semibold">{event}</p>
        <dl className="mt-4 space-y-2">
          <div className="flex justify-between gap-3"><dt className="text-muted">Team</dt><dd className="text-right font-medium">{squad?.name ?? '—'}</dd></div>
          {by && <div className="flex justify-between gap-3"><dt className="text-muted">Age group</dt><dd className="text-right font-medium">{fullLabel(groupInfo(by, rules))}</dd></div>}
          {round.kind === 'tournament' && program?.startDate && <div className="flex justify-between gap-3"><dt className="text-muted">Date</dt><dd className="text-right font-medium">{formatDate(program.startDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>}
          {program?.location && <div className="flex justify-between gap-3"><dt className="text-muted">Where</dt><dd className="text-right font-medium">{program.location}</dd></div>}
          <div className="flex justify-between gap-3 border-t border-line pt-3"><dt className="text-muted">Registration</dt><dd className="font-[family-name:var(--font-barlow)] text-2xl font-bold">{formatAUD(fee)}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-muted">Reference {entry.reference}</p>
      </aside>
    </div>
  )
}
