import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import type { Program, Team } from '@/payload-types'
import { LogoutButton } from './LogoutButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My account', robots: { index: false } }

const tagLabel = { rowville: 'Rowville player', rfa: 'RFA' } as const

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await currentUser()
  if (!user) redirect('/login?next=/account')
  const { welcome } = await searchParams
  const p = await payload()
  const [participants, bookings] = await Promise.all([
    p.find({ collection: 'participants', where: { account: { equals: user.id } }, depth: 1, limit: 50, overrideAccess: true }),
    p.find({ collection: 'bookings', where: { account: { equals: user.id }, status: { equals: 'paid' } }, depth: 1, limit: 100, sort: '-createdAt', overrideAccess: true }),
  ])

  const pendingOffers = participants.docs.filter((x) => x.registrationOffer?.status === 'offered' && x.registrationOffer.program)
  const now = Date.now()
  const upcoming = bookings.docs
    .map((b) => {
      const prog = b.program as Program
      const date = b.sessionStart || prog.startDate || null
      return { b, prog, date }
    })
    .filter((x) => !x.date || new Date(x.prog.endDate || x.date).getTime() >= now)
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))

  return (
    <div className="container-x py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow !text-brand">My account</p>
          <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Hi {user.firstName || 'there'}</h1>
        </div>
        <LogoutButton />
      </div>
      {welcome && <p className="mt-6 rounded-xl border border-accent bg-accent/10 px-5 py-4">Your account is ready. Welcome to the Eagles!</p>}

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
                  <p className="text-sm text-muted">{prog.title} · {formatAUD(prog.price)}</p>
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
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-line p-6 text-muted">
              Nothing booked yet. <Link href="/programs" className="font-semibold text-brand underline">Browse camps & programs</Link> or{' '}
              <Link href="/academy/trial" className="font-semibold text-brand underline">book an RFA trial</Link>
            </p>
          ) : (
            <ol className="mt-4 divide-y divide-line rounded-2xl border border-line">
              {upcoming.map(({ b, prog, date }) => (
                <li key={b.id} className="grid gap-1 p-5 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-6">
                  <p className="font-[family-name:var(--font-barlow)] text-lg font-bold uppercase text-brand">
                    {date ? formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Flexible'}
                  </p>
                  <div>
                    <p className="font-semibold">{b.bookingType === 'trial' ? `Trial — ${prog.title}` : prog.title}</p>
                    <p className="text-sm text-muted">
                      {[b.player?.teamName || b.player?.firstName, b.sessionStart && formatDate(b.sessionStart, { hour: 'numeric', minute: '2-digit' }), prog.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${b.payee === 'academy' ? 'bg-black text-white' : 'bg-brand/10 text-brand'}`}>
                    {b.payee === 'academy' ? 'RFA' : 'Club'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface-2 p-6">
            <h2 className="font-semibold">Players</h2>
            <ul className="mt-3 space-y-3">
              {participants.docs.map((x) => (
                <li key={x.id}>
                  <p className="font-medium">{x.firstName} {x.lastName}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(x.memberships ?? []).map((m) => (
                      <span key={m} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m === 'rfa' ? 'bg-black text-white' : 'bg-brand text-white'}`}>{tagLabel[m]}</span>
                    ))}
                    {(x.memberships ?? []).length === 0 && <span className="text-xs text-muted">No registrations yet</span>}
                  </div>
                </li>
              ))}
              {participants.docs.length === 0 && <li className="text-sm text-muted">Players appear here after your first booking or offer.</li>}
            </ul>
          </div>
          <Link href="/shop" className="block rounded-2xl border border-line p-6 font-semibold hover:border-brand">Shop team kit →</Link>
          <Link href="/account/preferences" className="block rounded-2xl border border-line p-6 font-semibold hover:border-brand">Communication preferences →</Link>
          {(user.roles?.includes('admin') || user.roles?.includes('committee')) && (
            <div className="rounded-2xl border border-line p-6">
              <p className="font-semibold">Staff tools</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li><Link href="/admin" className="text-brand underline">Admin</Link></li>
                <li><Link href="/staff/academy" className="text-brand underline">Academy coach availability</Link></li>
                <li><Link href="/staff/consent" className="text-brand underline">Consent review</Link></li>
              </ul>
            </div>
          )}
          {user.roles?.includes('coach') && (
            <Link href="/coach" className="block rounded-2xl bg-black p-6 font-semibold text-white hover:bg-black/85">Coach portal →</Link>
          )}
        </aside>
      </div>
    </div>
  )
}
