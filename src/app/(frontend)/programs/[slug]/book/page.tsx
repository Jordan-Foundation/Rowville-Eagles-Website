import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { placesTaken } from '@/lib/payments'
import { defaultPayee, programTypes } from '@/collections/Programs'
import { isPayee, paymentsMode, stripeAccounts } from '@/lib/stripe-accounts'
import { BookingForm } from './BookingForm'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { TermBookingForm, type TermSlotOption } from './TermBookingForm'
import { programSlots, slotTaken } from '@/academy/terms/service'
import { slotLabel as termSlotLabel, spotsLeft, upcomingSessions, yearsLabel } from '@/academy/terms/slots'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Book', robots: { index: false } }

const slotLabel = (iso: string) =>
  formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ cancelled?: string; participant?: string }>
}) {
  const [{ slug }, { cancelled, participant: participantParam }] = await Promise.all([params, searchParams])
  const p = await payload()
  const { docs } = await p.find({ collection: 'programs', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  const program = docs[0]
  if (!program) notFound()

  // Tournaments are by selection: register interest instead
  if (program.type === 'tournament') redirect(`/programs/${slug}/interest`)
  const academy = program.brand === 'academy'

  // Team registrations: only logged-in families with an offer for this program
  let offered: { id: number; label: string }[] = []
  if (program.type === 'registration') {
    const user = await currentUser()
    if (!user) redirect(`/login?next=${encodeURIComponent(`/programs/${slug}/book${participantParam ? `?participant=${participantParam}` : ''}`)}`)
    const { docs: kids } = await p.find({ collection: 'participants', where: { account: { equals: user.id } }, depth: 1, overrideAccess: true })
    offered = kids
      .filter((k) => k.registrationOffer?.status === 'offered' && (typeof k.registrationOffer.program === 'object' ? k.registrationOffer.program?.id : k.registrationOffer.program) === program.id)
      .map((k) => ({ id: k.id, label: `${k.firstName} ${k.lastName}${k.team && typeof k.team === 'object' ? ` — ${k.team.name}` : ''}` }))
    if (offered.length === 0) {
      return (
        <div className="container-x max-w-2xl py-20 text-center">
          <h1 className="font-display text-4xl font-bold uppercase">Registration is by invitation</h1>
          <p className="mt-4 text-muted">Team registrations open for players who receive an offer after trials. If you’ve received an offer, it will appear in your account.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/account" className="rounded-full bg-brand px-6 py-3 font-semibold text-white">My account</Link>
            <Link href="/join" className="rounded-full border border-line px-6 py-3 font-semibold">Join us for trials</Link>
          </div>
        </div>
      )
    }
  }
  const payee = isPayee(program.payee) ? program.payee : defaultPayee(program.type)
  const now = new Date()

  // Academy terms with training times: the player's year of birth picks the slot
  let termSlots: TermSlotOption[] | null = null
  let prefill: Record<string, string> | undefined
  if (program.type === 'academy-term') {
    const slots = (await programSlots(p, program.id)).filter((s) => s.active !== false)
    if (slots.length) {
      const taken = await slotTaken(p, program.id)
      termSlots = slots.map((s) => {
        const sessions = upcomingSessions(s, program)
        return {
          id: s.id,
          label: termSlotLabel(s),
          years: yearsLabel(s.birthYears),
          birthYears: (s.birthYears ?? []) as number[],
          remaining: spotsLeft(s, taken.get(s.id) ?? 0),
          sessions: sessions.length ? `${sessions.length} sessions from ${formatDate(sessions[0].startsAt, { day: 'numeric', month: 'short' })}` : 'Term finished',
        }
      })
      const user = await currentUser()
      if (user) prefill = { contactFirstName: user.firstName ?? '', contactLastName: user.lastName ?? '', contactEmail: user.email, contactPhone: user.phone ?? '' }
    }
  }
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
    (!termSlots && (program.slots?.length ?? 0) > 0 && slots.every((s) => s.remaining === 0))

  return (
    <div data-brand={academy ? 'academy' : undefined} data-page-brand={academy ? 'academy' : undefined} className="relative min-h-[70vh] overflow-hidden">
      {academy && <AcademyBackdrop />}
      <div className="container-x relative grid gap-12 py-14 lg:grid-cols-[1fr_24rem]">
        <div>
          <Link href={`/programs/${program.slug}`} className="text-sm text-muted hover:text-ink">← Back to program</Link>
          <p className="eyebrow mt-6">{programTypes.find((t) => t.value === program.type)?.label}</p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">{program.type === 'registration' ? 'Register' : 'Book'}: {program.title}</h1>
          {cancelled && (
            <p className="mt-6 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm">Payment was cancelled — nothing was charged. You can try again below.</p>
          )}
          <div className="mt-10">
            {!paymentsReady ? (
              <p className="panel rounded-2xl border border-line bg-surface-2 p-6">
                Online bookings for this program open soon. In the meantime, please contact the club to book.
              </p>
            ) : full ? (
              <p className="panel rounded-2xl border border-line bg-surface-2 p-6">
                This program is fully booked. Please check back later or contact the club about the waitlist.
              </p>
            ) : termSlots ? (
              <TermBookingForm slug={program.slug} slots={termSlots} priceLabel={formatAUD(program.price)} payeeLabel={stripeAccounts[payee].label} prefill={prefill} />
            ) : (
              <BookingForm
                slug={program.slug}
                isTeamEntry={false}
                offeredPlayers={offered}
                defaultPlayer={participantParam}
                slots={slots}
                priceLabel={formatAUD(program.price)}
                payeeLabel={stripeAccounts[payee].label}
              />
            )}
          </div>
        </div>
        <aside className={`panel h-fit border border-line bg-surface-2 p-7 lg:sticky lg:top-24 ${academy ? 'gloss-sheen rounded-sm' : 'rounded-2xl'}`}>
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
