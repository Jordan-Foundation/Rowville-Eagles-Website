import Link from 'next/link'
import type { Metadata } from 'next'
import { formatAUD, formatDate } from '@/lib/payload'
import { groupLabel } from '@/lib/age-groups'
import { slotLabel, termQuote, yearsLabel } from '@/academy/terms/slots'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { loadTermRegistration } from './load'
import { PayButton } from './PayButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Confirm your place', robots: { index: false } }

export default async function TermPayPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string; cancelled?: string }> }) {
  const [{ ref }, { t, cancelled }] = await Promise.all([params, searchParams])
  const data = await loadTermRegistration(ref, t)
  const shell = (body: React.ReactNode) => (
    <div data-brand="academy" data-page-brand="academy" className="relative min-h-[70vh] overflow-hidden">
      <AcademyBackdrop />
      <div className="container-x relative max-w-4xl py-14">{body}</div>
    </div>
  )
  if (!data) {
    return shell(
      <>
        <h1 className="font-display text-4xl font-bold uppercase">Link not valid</h1>
        <p className="mt-4 text-muted">Please <Link href={`/login?next=/academy/terms/pay/${ref}`} className="font-semibold underline">log in to your account</Link>, or contact us.</p>
      </>,
    )
  }
  const { reg, program, slot } = data
  const quote = slot ? termQuote(slot, program, program) : null
  const sessions = quote?.sessions ?? []
  const by = reg.playingBirthYear ?? reg.birthYear
  const payable = slot && quote?.bookable && (reg.status === 'offered' || reg.status === 'pending_payment')

  return shell(
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div>
        <p className="eyebrow">{program.title}</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase sm:text-5xl">{reg.player.firstName} {reg.player.lastName}</h1>
        {cancelled && <p className="mt-6 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm">Payment was cancelled — nothing was charged.</p>}
        {reg.status === 'paid' ? (
          <p className="mt-6 rounded-sm border border-line bg-surface-2 p-6">All done — {reg.player.firstName}’s place is paid. <Link href="/account" className="font-semibold underline">Go to your account</Link></p>
        ) : !payable ? (
          <p className="mt-6 rounded-sm border border-line bg-surface-2 p-6 text-muted">
            {slot && quote && !quote.bookable && reg.status !== 'interest' ? 'This term is nearly over, so this place can’t be booked now. Please contact us about next term.' : reg.status === 'interest' ? 'We have your interest — we’ll email you as soon as a place is available.' : 'This place is no longer available. Please contact us if you have any questions.'}
          </p>
        ) : (
          <div className="mt-8 space-y-6">
            <dl className="panel grid gap-3 rounded-sm border border-line bg-surface-2 p-6 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Training</dt><dd className="font-semibold">{slotLabel(slot!)}</dd></div>
              <div><dt className="text-muted">Age group</dt><dd className="font-semibold">{by ? groupLabel(by) : ''} · slot for {yearsLabel(slot!.birthYears)}</dd></div>
              {reg.status === 'offered' && reg.offerExpiresAt && <div><dt className="text-muted">Place held until</dt><dd className="font-semibold">{formatDate(reg.offerExpiresAt, { weekday: 'long', day: 'numeric', month: 'long' })}</dd></div>}
            </dl>
            <div>
              <h2 className="font-display text-xl font-semibold uppercase">{sessions.length} sessions left</h2>
              <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                {sessions.map((s) => (
                  <li key={s.date}>{formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{s.moved ? ' (changed time)' : ''}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      {payable && (
        <aside className="panel gloss-sheen h-fit rounded-sm border border-line bg-surface-2 p-7">
          {quote!.perSession !== null && <p className="text-sm text-muted">{quote!.count} sessions × {formatAUD(quote!.perSession)}</p>}
          <p className="text-sm text-muted">Total</p>
          <p className="mt-1 text-3xl font-bold">{formatAUD(quote!.total)}</p>
          <div className="mt-6"><PayButton refCode={reg.reference ?? ref} token={t} label={`Confirm and pay · ${formatAUD(quote!.total)}`} /></div>
          <p className="mt-3 text-center text-xs text-muted">Secure payment by Stripe</p>
        </aside>
      )}
    </div>,
  )
}
