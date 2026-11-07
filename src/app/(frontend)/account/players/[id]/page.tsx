import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { ageOn, sessionPayment } from '@/academy/session-view'
import type { AcademyBooking, AcademyCoach, Program } from '@/payload-types'
import { PlayerForm } from './PlayerForm'
import { getAgeRules } from '@/lib/age-rules'
import { SelectionList } from '@/selections/SelectionList'
import { myTeams } from '@/teams/service'
import { TeamCards } from '@/teams/TeamCards'
import { TermList } from '@/academy/terms/TermList'
import { foundationSettings, isStaffOrCoach } from '@/academy/pdr/load'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Player', robots: { index: false } }

const tagLabel = { rowville: 'Rowville player', rfa: 'RFA', 'foundation-plus': 'Foundation+ player' } as const
const toneCls = { ok: 'text-muted', pending: 'text-muted', bad: 'font-semibold text-red-600' }

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?next=/account/players/${id}`)
  const p = await payload()
  const kid = await p.findByID({ collection: 'participants', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!kid || (typeof kid.account === 'object' ? kid.account.id : kid.account) !== user.id) notFound()

  const teams = await myTeams(p, user, kid.id)
  const foundation = await foundationSettings(p)
  const showFoundation = foundation.enabled || isStaffOrCoach(user)
  const [{ docs: selections }, rules, { docs: termRegs }] = await Promise.all([
    p.find({ collection: 'selection-entries', where: { participant: { equals: kid.id }, status: { not_in: ['withdrawn', 'closed', 'released'] } }, sort: '-createdAt', depth: 2, limit: 30, overrideAccess: true }),
    getAgeRules(p),
    p.find({ collection: 'academy-registrations', where: { participant: { equals: kid.id }, status: { not_equals: 'cancelled' } }, sort: '-createdAt', depth: 2, limit: 20, overrideAccess: true }),
  ])
  const [{ docs: academyBookings }, { docs: clubBookings }] = await Promise.all([
    p.find({ collection: 'academy-bookings', where: { participant: { equals: kid.id } }, depth: 0, limit: 100, overrideAccess: true }),
    p.find({ collection: 'bookings', where: { participant: { equals: kid.id }, status: { equals: 'paid' } }, depth: 1, limit: 50, sort: '-createdAt', overrideAccess: true }),
  ])
  const byId = new Map(academyBookings.map((b) => [b.id, b]))
  const { docs: sessions } = academyBookings.length
    ? await p.find({
        collection: 'academy-sessions',
        where: { booking: { in: [...byId.keys()] }, status: { in: ['scheduled', 'completed', 'no_show'] } },
        depth: 1,
        sort: 'startsAt',
        limit: 300,
        overrideAccess: true,
        select: { booking: true, coach: true, coverCoach: true, needsCover: true, startsAt: true, status: true, paid: true },
      })
    : { docs: [] }
  const now = Date.now()
  const upcoming = sessions.filter((s) => new Date(s.startsAt).getTime() >= now)
  const past = sessions.filter((s) => new Date(s.startsAt).getTime() < now).reverse()
  const done = past.filter((s) => s.status === 'completed').length

  const row = (s: (typeof sessions)[number]) => {
    const b = byId.get(typeof s.booking === 'object' ? s.booking.id : s.booking) as AcademyBooking
    const coach = s.coach as AcademyCoach
    const cover = s.needsCover ? (s.coverCoach && typeof s.coverCoach === 'object' ? `Cover: ${s.coverCoach.displayName}` : 'Replacement coach being arranged') : null
    const pay = sessionPayment(s, b)
    return (
      <li key={s.id}>
        <Link href={`/account/bookings/${b.reference}`} className="grid gap-1 p-5 transition hover:bg-surface-2 sm:grid-cols-[10rem_1fr_auto] sm:items-center sm:gap-6">
        <p className="font-[family-name:var(--font-barlow)] text-lg font-bold uppercase text-brand">{formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        <div>
          <p className="font-semibold">
            1-on-1 with {coach.displayName} · {formatDate(s.startsAt, { hour: 'numeric', minute: '2-digit' })}
            {s.status === 'no_show' && <span className="ml-2 text-sm font-normal text-red-600">Missed</span>}
            {s.status === 'completed' && <span className="ml-2 text-sm font-normal text-muted">Attended</span>}
          </p>
          <p className="text-sm">
            <span className={toneCls[pay.tone]}>{pay.label}</span>
            {cover && <span className="text-muted"> · {cover}</span>}
            <span className="text-muted"> · {b.reference}</span>
          </p>
        </div>
        <span className="w-fit rounded-full bg-black px-2.5 py-1 text-xs font-semibold text-white">RFA →</span>
        </Link>
      </li>
    )
  }

  return (
    <div className="container-x py-14">
      <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow !text-brand">Player</p>
          <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">{kid.firstName} {kid.lastName}</h1>
          <p className="mt-2 text-muted">
            Age {ageOn(kid.dateOfBirth)} · born {formatDate(kid.dateOfBirth, { day: 'numeric', month: 'long', year: 'numeric' })}
            {kid.football?.position ? ` · ${kid.football.position}` : ''}
            {kid.football?.currentClub ? ` · ${kid.football.currentClub}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(kid.memberships ?? []).map((m) => (
              <span key={m} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m === 'rfa' || m === 'foundation-plus' ? 'bg-black text-white' : 'bg-brand text-white'}`}>{tagLabel[m]}</span>
            ))}
          </div>
        </div>
        <dl className="flex gap-6 text-center">
          <div><dt className="text-xs uppercase tracking-wider text-muted">Upcoming</dt><dd className="font-[family-name:var(--font-barlow)] text-3xl font-bold">{upcoming.length}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-muted">Attended</dt><dd className="font-[family-name:var(--font-barlow)] text-3xl font-bold">{done}</dd></div>
        </dl>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <section>
          {teams.length > 0 && (
            <div className="mb-10">
              <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Teams</h2>
              <TeamCards teams={teams} />
            </div>
          )}
          {termRegs.length > 0 && (
            <div className="mb-10">
              <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Academy training</h2>
              <TermList regs={termRegs} showPlayer={false} />
            </div>
          )}
          {selections.length > 0 && (
            <div className="mb-10">
              <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Trials & selections</h2>
              <SelectionList entries={selections} rules={rules} showPlayer={false} />
            </div>
          )}
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Upcoming 1-on-1s</h2>
          {upcoming.length ? (
            <ol className="mt-4 divide-y divide-line rounded-2xl border border-line">{upcoming.map(row)}</ol>
          ) : (
            <p className="mt-4 rounded-2xl border border-line p-6 text-muted">
              No 1-on-1s booked. <Link href="/academy/1-on-1" className="font-semibold text-brand underline">Book a session</Link>
            </p>
          )}

          {clubBookings.length > 0 && (
            <>
              <h2 className="mt-10 font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Programs & camps</h2>
              <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
                {clubBookings.map((b) => {
                  const prog = b.program as Program
                  return (
                    <li key={b.id}>
                      <Link href={`/account/bookings/${b.reference}`} className="flex flex-wrap items-center justify-between gap-2 p-5 transition hover:bg-surface-2">
                      <div>
                        <p className="font-semibold">{b.bookingType === 'trial' ? `Trial — ${prog.title}` : prog.title}</p>
                        <p className="text-sm text-muted">{[prog.startDate && formatDate(prog.startDate, { day: 'numeric', month: 'short', year: 'numeric' }), prog.location].filter(Boolean).join(' · ')}</p>
                      </div>
                      <span className="text-sm text-muted">{b.reference} →</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {past.length > 0 && (
            <>
              <h2 className="mt-10 font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Past 1-on-1s</h2>
              <ol className="mt-4 divide-y divide-line rounded-2xl border border-line opacity-80">{past.map(row)}</ol>
            </>
          )}

          {showFoundation && (
            <Link href={`/foundation-plus/${kid.id}`} className="mt-10 block rounded-2xl border border-line bg-black p-6 text-white transition hover:brightness-125">
              <p className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{foundation.name}{!foundation.enabled ? ' (staff preview)' : ''}</p>
              <p className="mt-1 text-sm text-white/70">{foundation.tagline || 'Skills, challenges, badges and coach feedback.'}</p>
              <p className="mt-3 text-sm font-semibold">Open {kid.firstName}’s {foundation.name} player page →</p>
            </Link>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-line bg-surface-2 p-6">
          <h2 className="font-semibold">Player details</h2>
          <p className="mt-1 text-sm text-muted">Coaches see these before each session.</p>
          <div className="mt-5">
            <PlayerForm
              id={kid.id}
              values={{
                currentClub: kid.football?.currentClub ?? '',
                position: kid.football?.position ?? '',
                goals: kid.football?.goals ?? '',
                conditions: kid.medical?.conditions ?? '',
                emergencyContact: kid.medical?.emergencyContact ?? '',
                emergencyPhone: kid.medical?.emergencyPhone ?? '',
                photoConsent: Boolean(kid.photoConsent),
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
