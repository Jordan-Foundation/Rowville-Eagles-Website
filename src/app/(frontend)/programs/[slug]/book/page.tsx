import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { placesTaken } from '@/lib/payments'
import { defaultPayee, programTypes } from '@/collections/Programs'
import { isPayee, paymentsMode, stripeAccounts } from '@/lib/stripe-accounts'
import { BookingForm } from './BookingForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Book', robots: { index: false } }

const slotLabel = (iso: string) =>
  formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ cancelled?: string }>
}) {
  const [{ slug }, { cancelled }] = await Promise.all([params, searchParams])
  const p = await payload()
  const { docs } = await p.find({ collection: 'programs', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  const program = docs[0]
  if (!program) notFound()

  const academy = program.brand === 'academy'
  const payee = isPayee(program.payee) ? program.payee : defaultPayee(program.type)
  const now = new Date()
  const slots = await Promise.all(
    (program.slots ?? [])
      .filter((s) => new Date(s.start) > now)
      .map(async (s) => ({
        start: s.start,
        label: slotLabel(s.start) + (s.coach ? ` · ${s.coach}` : ''),
        remaining: Math.max(0, (s.capacity ?? 1) - (await placesTaken(p, program.id, s.start))),
      })),
  )
  let paymentsReady = program.price === 0
  try {
    paymentsReady ||= Boolean(paymentsMode(payee))
  } catch {
    /* account not connected yet */
  }
  const full =
    program.status !== 'open' ||
    (program.capacity ? (await placesTaken(p, program.id)) >= program.capacity : false) ||
    ((program.slots?.length ?? 0) > 0 && slots.every((s) => s.remaining === 0))

  return (
    <div data-brand={academy ? 'academy' : undefined} data-page-brand={academy ? 'academy' : undefined} className="min-h-[70vh]">
      <div className="container-x grid gap-12 py-14 lg:grid-cols-[1fr_24rem]">
        <div>
          <Link href={`/programs/${program.slug}`} className="text-sm text-muted hover:text-ink">← Back to program</Link>
          <p className="eyebrow mt-6">{programTypes.find((t) => t.value === program.type)?.label}</p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none sm:text-5xl">{program.type === 'registration' ? 'Register' : 'Book'}: {program.title}</h1>
          {cancelled && (
            <p className="mt-6 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm">Payment was cancelled — nothing was charged. You can try again below.</p>
          )}
          <div className="mt-10">
            {!paymentsReady ? (
              <p className="rounded-2xl border border-line bg-surface-2 p-6">
                Online bookings for this program open soon. In the meantime, please contact the club to book.
              </p>
            ) : full ? (
              <p className="rounded-2xl border border-line bg-surface-2 p-6">
                This program is fully booked. Please check back later or contact the club about the waitlist.
              </p>
            ) : (
              <BookingForm
                slug={program.slug}
                isTeamEntry={program.type === 'tournament'}
                slots={slots}
                priceLabel={formatAUD(program.price)}
                payeeLabel={stripeAccounts[payee].label}
              />
            )}
          </div>
        </div>
        <aside className="h-fit rounded-2xl border border-line bg-surface-2 p-7 lg:sticky lg:top-24">
          <p className="text-sm text-muted">Order summary</p>
          <p className="mt-2 text-xl font-semibold">{program.title}</p>
          <p className="mt-1 text-sm text-muted">{[program.ageRange, program.scheduleNote].filter(Boolean).join(' · ')}</p>
          <div className="mt-6 flex items-baseline justify-between border-t border-line pt-5">
            <span className="text-muted">Total</span>
            <span className="text-3xl font-bold">{formatAUD(program.price)}</span>
          </div>
          {program.priceNote && <p className="mt-3 text-xs text-muted">{program.priceNote}</p>}
        </aside>
      </div>
    </div>
  )
}
