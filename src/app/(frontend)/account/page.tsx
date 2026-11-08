import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import type { AcademyBooking, AcademyCoach, Program, Team } from '@/payload-types'
import { LogoutButton } from './LogoutButton'
import { sessionPayment } from '@/academy/session-view'
import { creditStateFor } from '@/academy/credits'
import { getAgeRules } from '@/lib/age-rules'
import { SelectionList } from '@/selections/SelectionList'
import { TermList } from '@/academy/terms/TermList'
import { myTeams } from '@/teams/service'
import { TeamCards } from '@/teams/TeamCards'
import { inbox } from '@/messaging/service'
import { homeFor } from '@/lib/home'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My account', robots: { index: false } }

const tagLabel = { rowville: 'Rowville player', rfa: 'RFA', 'foundation-plus': 'Foundation+ player' } as const

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string; view?: string }> }) {
  const user = await currentUser()
  if (!user) redirect('/login?next=/account')
  const { welcome, view } = await searchParams
  // Management and coaches land on their own dashboard; their family page is one click away (?view=family)
  const home = homeFor(user)
  if (home !== '/account' && view !== 'family') redirect(home)
  const p = await payload()
  const familyUnread = (await inbox(p, { user, side: 'family' })).filter((x) => x.unread).length
  const [participants, bookings, academy, plans] = await Promise.all([
    p.find({ collection: 'participants', where: { account: { equals: user.id } }, depth: 1, limit: 50, overrideAccess: true }),
    p.find({ collection: 'bookings', where: { account: { equals: user.id }, status: { equals: 'paid' } }, depth: 1, limit: 100, sort: '-createdAt', overrideAccess: true }),
    // Foundation Academy 1-on-1 sessions (one row per session)
    p.find({ collection: 'academy-sessions', where: { account: { equals: user.id }, status: { in: ['scheduled', 'completed', 'no_show'] } }, depth: 2, limit: 300, sort: 'startsAt', overrideAccess: true }),
    // Weekly payment plans that need attention
    p.find({ collection: 'academy-bookings', where: { account: { equals: user.id }, paymentMode: { equals: 'weekly' }, status: { equals: 'payment_failed' } }, depth: 1, limit: 20, overrideAccess: true }),
  ])

  const credits = await creditStateFor(p, user.id)
  const teams = await myTeams(p, user)
  const [{ docs: selections }, rules, { docs: termRegs }] = await Promise.all([
    p.find({ collection: 'selection-entries', where: { account: { equals: user.id }, status: { not_in: ['withdrawn', 'closed', 'released'] } }, sort: '-createdAt', depth: 2, limit: 50, overrideAccess: true }),
    getAgeRules(p),
    p.find({ collection: 'academy-registrations', where: { account: { equals: user.id }, status: { not_equals: 'cancelled' } }, sort: '-createdAt', depth: 2, limit: 50, overrideAccess: true }),
  ])
  const credit = credits.available
  // Rowville offers that came through selections show in "Trials & selections" with their own button
  const offeredBySelection = new Set(selections.filter((e) => e.status === 'offered').map((e) => (typeof e.participant === 'object' ? e.participant?.id : e.participant)))
  const pendingOffers = participants.docs.filter((x) => x.registrationOffer?.status === 'offered' && x.registrationOffer.program && !offeredBySelection.has(x.id))
  const now = Date.now()
  type Item = { key: string; date: string | null; title: string; detail: string; badge: 'RFA' | 'Club'; status?: string; href?: string }
  const clubItems: Item[] = bookings.docs
    .map((b) => {
      const prog = b.program as Program
      const date = b.sessionStart || prog.startDate || null
      return { b, prog, date }
    })
    .filter((x) => !x.date || new Date(x.prog.endDate || x.date).getTime() >= now)
    .map(({ b, prog, date }) => ({
      key: `b${b.id}`,
      date,
      title: b.bookingType === 'trial' ? `Trial — ${prog.title}` : prog.title,
      detail: [b.player?.teamName || b.player?.firstName, b.sessionStart && formatDate(b.sessionStart, { hour: 'numeric', minute: '2-digit' }), prog.location].filter(Boolean).join(' · '),
      badge: b.payee === 'academy' ? 'RFA' : 'Club',
      href: b.reference ? `/account/bookings/${b.reference}` : undefined,
    }))
  const sessionItems = academy.docs.map((s) => {
    const booking = s.booking as AcademyBooking
    const coach = s.coach as AcademyCoach
    const cover = s.needsCover ? (s.coverCoach && typeof s.coverCoach === 'object' ? ` · cover: ${s.coverCoach.displayName}` : ' · replacement coach being arranged') : ''
    const paid = sessionPayment(s, booking).label.toLowerCase()
    return {
      key: `s${s.id}`,
      date: s.startsAt,
      title: `1-on-1 with ${coach.displayName}`,
      detail: [booking.player.firstName, formatDate(s.startsAt, { hour: 'numeric', minute: '2-digit' }), paid].join(' · ') + cover,
      badge: 'RFA' as const,
      status: s.status,
      href: `/account/bookings/${booking.reference}`,
    }
  })
  const upcoming = [...clubItems, ...sessionItems.filter((i) => new Date(i.date).getTime() >= now)].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  const past = sessionItems.filter((i) => new Date(i.date).getTime() < now).reverse()

  return (
    <div className="container-x py-14">
      {home !== '/account' && (
        <p className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-5 py-3 text-sm">
          <span>You’re viewing your family’s page.</span>
          <Link href={home} className="font-semibold underline">← Back to my {home === '/management' ? 'Management' : 'Coach'} dashboard</Link>
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow !text-brand">My account</p>
          <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Hi {user.firstName || 'there'}</h1>
        </div>
        <LogoutButton />
      </div>
      {welcome && <p className="mt-6 rounded-xl border border-accent bg-accent/10 px-5 py-4">Your account is ready. Welcome to the Eagles!</p>}

      {plans.docs.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Payment needed</h2>
          {plans.docs.map((b) => {
            const failed = (b.payments ?? []).filter((x) => x.status === 'failed')
            const payUrl = failed.at(-1)?.payUrl
            const owed = failed.reduce((n, x) => n + (x.amount ?? 0), 0)
            return (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-red-500/60 bg-red-500/5 p-6">
                <div>
                  <p className="font-semibold">{b.player.firstName}’s weekly 1-on-1s with {(b.coach as AcademyCoach).displayName}</p>
                  <p className="text-sm text-muted">
                    The automatic {formatAUD(owed)} payment didn’t go through · {b.sessionsPaid ?? 0} of {b.sessionsTotal} sessions paid · {b.reference}
                  </p>
                </div>
                {payUrl ? (
                  <a href={payUrl} className="rounded-full bg-black px-6 py-3 font-semibold text-white hover:bg-black/85">Pay now →</a>
                ) : (
                  <span className="text-sm text-muted">We’ll retry automatically — or call 0451 525 684</span>
                )}
              </div>
            )
          })}
        </section>
      )}

      {pendingOffers.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Action needed</h2>
          {pendingOffers.map((x) => {
            const prog = x.registrationOffer!.program as Program
            const team = x.team as Team | undefined
            return (
              <div key={x.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-accent p-6">
                <div>
                  <p className="font-semibold">Accept {x.firstName}’s place{team ? ` in ${team.name}` : ''}</p>
                  <p className="text-sm text-muted">{prog.title} · {formatAUD(prog.price ?? 0)}</p>
                </div>
                <Link href={`/programs/${prog.slug}/book?participant=${x.id}`} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink hover:brightness-110">
                  Pay registration →
                </Link>
              </div>
            )
          })}
        </section>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section>
          {teams.length > 0 && (
            <div className="mb-10">
              <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">My teams</h2>
              <TeamCards teams={teams} />
            </div>
          )}
          {termRegs.length > 0 && (
            <div className="mb-10">
              <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Training groups</h2>
              <TermList regs={termRegs} />
            </div>
          )}
          {selections.length > 0 && (
            <div className="mb-10">
              <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Trials & selections</h2>
              <SelectionList entries={selections} rules={rules} />
            </div>
          )}
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-line p-6 text-muted">
              Nothing booked yet. <Link href="/programs" className="font-semibold text-brand underline">Browse camps & programs</Link> or{' '}
              <Link href="/academy/trial" className="font-semibold text-brand underline">book an RFA trial</Link>
            </p>
          ) : (
            <ItemList items={upcoming} />
          )}
          {past.length > 0 && (
            <>
              <h2 className="mt-10 font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Past sessions</h2>
              <ItemList items={past} muted />
            </>
          )}
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface-2 p-6">
            <h2 className="font-semibold">Players</h2>
            <ul className="mt-3 space-y-3">
              {participants.docs.map((x) => (
                <li key={x.id}>
                  <Link href={`/account/players/${x.id}`} className="font-medium hover:text-brand hover:underline">{x.firstName} {x.lastName} →</Link>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(x.memberships ?? []).map((m) => (
                      <span key={m} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m === 'rfa' || m === 'foundation-plus' ? 'bg-black text-white' : 'bg-brand text-white'}`}>{tagLabel[m]}</span>
                    ))}
                    {(x.memberships ?? []).length === 0 && <span className="text-xs text-muted">No registrations yet</span>}
                  </div>
                </li>
              ))}
              {participants.docs.length === 0 && <li className="text-sm text-muted">Players appear here after your first booking or offer.</li>}
            </ul>
          </div>
          {credit > 0 && (
            <Link href="/academy/1-on-1" className="block rounded-2xl border-2 border-accent p-6 hover:brightness-105">
              <p className="font-semibold">{credit} free 1-on-1 session{credit === 1 ? '' : 's'}</p>
              <p className="mt-1 text-sm text-muted">
                Session credit{credit === 1 ? '' : 's'}, used automatically next time you book a 1-on-1.
                {credits.nextExpiry && ` ${credits.nextExpiry.sessions === credit ? (credit === 1 ? 'Expires' : 'Expire') : `${credits.nextExpiry.sessions} expire${credits.nextExpiry.sessions === 1 ? 's' : ''}`} ${formatDate(credits.nextExpiry.at, { day: 'numeric', month: 'short', year: 'numeric' })}.`} Book now →
              </p>
            </Link>
          )}
          <Link href="/shop" className="block rounded-2xl border border-line p-6 font-semibold hover:border-brand">Shop team kit →</Link>
          <Link href="/account/messages" className="block rounded-2xl border border-line p-6 font-semibold hover:border-brand">
            Messages{familyUnread > 0 && <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{familyUnread} new</span>} →
            <span className="mt-1 block text-sm font-normal text-muted">Message your Foundation Academy coach.</span>
          </Link>
          <Link href="/account/preferences" className="block rounded-2xl border border-line p-6 font-semibold hover:border-brand">Communication preferences →</Link>
        </aside>
      </div>
    </div>
  )
}

function ItemList({ items, muted }: { items: { key: string; date: string | null; title: string; detail: string; badge: 'RFA' | 'Club'; status?: string; href?: string }[]; muted?: boolean }) {
  return (
    <ol className={`mt-4 divide-y divide-line rounded-2xl border border-line ${muted ? 'opacity-70' : ''}`}>
      {items.map((i) => (
        <li key={i.key}>
          <Row href={i.href}>
          <p className="font-[family-name:var(--font-barlow)] text-lg font-bold uppercase text-brand">
            {i.date ? formatDate(i.date, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Flexible'}
          </p>
          <div>
            <p className="font-semibold">{i.title}{i.status === 'no_show' ? ' (missed)' : ''}</p>
            <p className="text-sm text-muted">{i.detail}</p>
          </div>
          <span className="flex items-center gap-3">
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${i.badge === 'RFA' ? 'bg-black text-white' : 'bg-brand/10 text-brand'}`}>{i.badge}</span>
            {i.href && <span aria-hidden className="text-muted">→</span>}
          </span>
          </Row>
        </li>
      ))}
    </ol>
  )
}

function Row({ href, children }: { href?: string; children: React.ReactNode }) {
  const cls = 'grid gap-1 p-5 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-6'
  return href ? <Link href={href} className={`${cls} transition hover:bg-surface-2`}>{children}</Link> : <div className={cls}>{children}</div>
}
