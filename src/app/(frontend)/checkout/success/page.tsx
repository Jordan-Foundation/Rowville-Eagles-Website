import { BookingNextSteps } from '@/components/BookingNextSteps'
import { programPlace } from '@/lib/place'
import { groupLabel } from '@/lib/age-groups'
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { discountLine } from '@/promotions/service'
import { confirmPayment } from '@/lib/payments'
import { isPayee, paymentsMode, stripeAccounts, stripeFor } from '@/lib/stripe-accounts'
import type { Program } from '@/payload-types'
import { ClearCart } from './ClearCart'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Thank you', robots: { index: false } }

type Search = { kind?: string; ref?: string; session_id?: string; simulated?: string }

export default async function SuccessPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { kind: rawKind, ref, session_id, simulated } = await searchParams
  const kind = rawKind === 'order' ? 'order' : 'booking'
  const p = await payload()
  const collection = kind === 'order' ? 'orders' : 'bookings'
  const doc = ref ? (await p.find({ pagination: false, collection, where: { reference: { equals: ref } }, limit: 1, depth: 1 })).docs[0] : undefined
  if (!doc) return <Shell title="Booking not found">We couldn’t find that reference. If you were charged, please contact the club.</Shell>

  // Confirm payment here as well as in the webhook, so the page is correct even if the webhook is delayed.
  let status = doc.status
  if (status === 'pending' && isPayee(doc.payee)) {
    try {
      const mode = paymentsMode(doc.payee)
      if (mode === 'simulate' && simulated) {
        status = ((await confirmPayment(p, kind, doc.reference ?? '')) as typeof doc | undefined)?.status ?? status
      } else if (mode === 'stripe' && session_id) {
        const session = await stripeFor(doc.payee).checkout.sessions.retrieve(session_id)
        if (session.metadata?.reference === doc.reference && session.payment_status === 'paid') {
          status = ((await confirmPayment(p, kind, doc.reference ?? '')) as typeof doc | undefined)?.status ?? status
        }
      }
    } catch (e) {
      p.logger.error(e)
    }
  }

  const paid = status === 'paid'
  const promoLine = await discountLine(p, doc as { discount?: number | null; promotion?: unknown })
  const payeeLabel = isPayee(doc.payee) ? stripeAccounts[doc.payee].label : ''

  if ('program' in doc) {
    const program = doc.program as Program
    // Brothers and sisters booked in the same checkout
    const group = doc.checkoutGroup
      ? (await p.find({ pagination: false, collection: 'bookings', where: { checkoutGroup: { equals: doc.checkoutGroup } }, sort: 'id', limit: 10, depth: 0, overrideAccess: true })).docs
      : [doc]
    const names = group.map((b) => b.player?.firstName).filter(Boolean).join(', ')
    const paidTotal = group.reduce((n, b) => n + (b.amount ?? 0), 0)
    const academy = program.brand === 'academy'
    const settings = await p.findGlobal({ slug: 'site-settings' })
    return (
      <div data-brand={academy ? 'academy' : undefined} data-page-brand={academy ? 'academy' : undefined} className="relative overflow-hidden">
        {academy && <AcademyBackdrop />}
        <Shell title={paid ? (doc.bookingType === 'trial' ? 'Trial booked!' : 'You’re booked in!') : 'Payment processing'} reference={doc.reference ?? undefined}>
          <dl className={`panel mt-8 space-y-3 border border-line bg-surface-2 p-6 text-left text-sm ${academy ? 'gloss-sheen rounded-sm' : 'rounded-2xl'}`}>
            <Row k="Program" v={program.title} />
            <Row k={doc.player?.teamName ? 'Team' : group.length > 1 ? 'Players' : 'Player'} v={doc.player?.teamName || names} />
            {doc.birthYear && <Row k="Age group" v={groupLabel(doc.birthYear)} />}
            {doc.sessionStart && <Row k="Time" v={formatDate(doc.sessionStart, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} />}
            {!doc.sessionStart && program.startDate && <Row k="Starts" v={formatDate(program.startDate)} />}
            {promoLine && <Row k={promoLine[0]} v={promoLine[1]} />}
            {paidTotal > 0 && <Row k="Paid" v={`${formatAUD(paidTotal)} to ${payeeLabel}`} />}
          </dl>
          {paid && doc.reference && (
            <BookingNextSteps
              reference={doc.reference}
              academy={academy}
              directions={program.type === 'registration' ? null : programPlace(program.location, settings.ground?.address).directions}
              whatToBring={program.whatToBring}
              dropOffPickUp={program.dropOffPickUp}
            />
          )}
          {!paid && <p className="mt-6 text-sm text-muted">Your payment is still being confirmed. This page will update shortly — refresh in a minute.</p>}
          {paid && program.type === 'registration' && (
            <div className="mt-8 rounded-2xl border-2 border-accent p-6 text-left">
              <p className="font-semibold">One more step: Football Victoria registration</p>
              <p className="mt-2 text-sm text-muted">
                Your club fee is paid. To be eligible to play, complete the Football Victoria section in PlayFootball and select Rowville Eagles FC.
              </p>
              {settings.links?.playFootball && (
                <a href={settings.links.playFootball} target="_blank" rel="noopener" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
                  Complete in PlayFootball →
                </a>
              )}
            </div>
          )}
          <p className="mt-8 text-sm text-muted">We’ve emailed you a confirmation{doc.amount > 0 ? ' — Stripe will send your receipt separately' : ''}.</p>
          <Link href={academy ? '/academy' : '/programs'} className="mt-6 inline-block font-semibold underline">Back to {academy ? 'the Academy' : 'programs'}</Link>
        </Shell>
      </div>
    )
  }

  return (
    <Shell title={paid ? 'Order confirmed' : 'Payment processing'} reference={doc.reference ?? undefined}>
      {paid && <ClearCart />}
      <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface-2 px-6 text-left text-sm">
        {doc.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4 py-3">
            <span>{i.quantity} × {i.name} ({i.size})</span>
            <span>{formatAUD((i.unitPrice ?? 0) * (i.quantity ?? 0))}</span>
          </li>
        ))}
        {doc.postage ? <li className="flex justify-between gap-4 py-3"><span>Postage</span><span>{formatAUD(doc.postage)}</span></li> : null}
        {promoLine && <li className="flex justify-between gap-4 py-3 text-emerald-700"><span>{promoLine[0]}</span><span>{promoLine[1]}</span></li>}
        <li className="flex justify-between py-3 font-semibold"><span>Total</span><span>{formatAUD(doc.total)}</span></li>
      </ul>
      <p className="mt-6 text-sm text-muted">
        {doc.fulfilment === 'pickup' ? 'We’ll email you when your order is ready to collect from the club.' : 'We’ll email you when your order has been posted.'}
      </p>
      <Link href="/shop" className="mt-6 inline-block font-semibold underline">Continue shopping</Link>
    </Shell>
  )
}

function Shell({ title, reference, children }: { title: string; reference?: string; children: React.ReactNode }) {
  return (
    <div className="container-x relative max-w-2xl py-20 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl text-accent-ink">✓</div>
      <h1 className="mt-6 font-display text-4xl font-bold uppercase">{title}</h1>
      {reference && <p className="mt-2 text-sm text-muted">Reference <span className="font-mono font-semibold text-ink">{reference}</span></p>}
      <div>{children}</div>
    </div>
  )
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-muted">{k}</dt>
    <dd className="text-right font-medium">{v}</dd>
  </div>
)
