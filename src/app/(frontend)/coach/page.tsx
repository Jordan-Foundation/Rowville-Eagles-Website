import Link from 'next/link'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { attendanceDue, coachSessions } from '@/academy/coach-sessions'
import { coachGroups, nextSession } from '@/academy/terms/coach-groups'
import { RoleSwitch, myChildren } from '@/components/dashboard/RoleSwitch'

export const dynamic = 'force-dynamic'

export default async function CoachHome() {
  const { coach, user } = await requireCoach('/coach')
  const p = await payload()
  const kids = await myChildren(p, user)
  const [{ docs: terms }, { docs: mine }] = await Promise.all([
    p.find({ collection: 'academy-terms', where: { status: { in: ['availability', 'open'] } }, sort: 'startDate', depth: 0, limit: 10 }),
    p.find({ collection: 'academy-availability', where: { coach: { equals: coach.id } }, depth: 0, limit: 50, overrideAccess: true }),
  ])
  const now = new Date()
  const [next, due, groups] = await Promise.all([coachSessions(p, coach.id, { from: now, to: new Date(now.getTime() + 7 * 86_400_000) }), attendanceDue(p, coach.id, now), coachGroups(p, coach.id)])
  const { totalDocs: toReview } = await p.count({ collection: 'pdr-submissions', where: { status: { equals: 'pending' } }, overrideAccess: true })
  const nextGroup = groups.map((g) => ({ g, s: nextSession(g, now) })).filter((x) => x.s).sort((a, b) => a.s!.startsAt.localeCompare(b.s!.startsAt))[0]
  const byTerm = new Map(mine.map((a) => [typeof a.term === 'object' ? a.term.id : a.term, a]))
  const profileGaps = [!coach.photo && 'a photo', !coach.bio && 'a short bio', !(coach.specialties?.length) && 'your specialties'].filter(Boolean) as string[]

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Hi {coach.displayName}</h1>
          <p className="mt-3 text-muted">Set your 1-on-1 availability for each term and keep your profile up to date — families see it when they book.</p>
        </div>
        <RoleSwitch user={user} current="coach" kids={kids} />
      </div>

      <Link href="/coach/sessions" className="panel gloss-sheen group block border border-line p-6 transition hover:border-white/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl font-semibold uppercase">Sessions</p>
            <p className="mt-1 text-sm text-muted">
              {next.length ? `${next.length} in the next 7 days · next ${formatDate(next[0].session.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} with ${next[0].booking.player.firstName}` : 'Nothing booked in the next 7 days.'}
            </p>
          </div>
          {due.length > 0 && <span className="bg-red-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-red-300">{due.length} to mark</span>}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] transition group-hover:translate-x-1">Open my sessions →</p>
      </Link>

      {toReview > 0 && (
        <Link href="/coach/reviews" className="panel gloss-sheen group block border border-line p-6 transition hover:border-white/40">
          <p className="font-display text-xl font-semibold uppercase">Foundation+ reviews</p>
          <p className="mt-1 text-sm text-muted">{toReview} video{toReview === 1 ? '' : 's'} waiting for a coach</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] transition group-hover:translate-x-1">Review now →</p>
        </Link>
      )}

      {groups.length > 0 && (
        <Link href="/coach/groups" className="panel gloss-sheen group block border border-line p-6 transition hover:border-white/40">
          <p className="font-display text-xl font-semibold uppercase">My groups</p>
          <p className="mt-1 text-sm text-muted">
            {groups.length} group{groups.length === 1 ? '' : 's'} · {groups.reduce((n, g) => n + g.players.length, 0)} players
            {nextGroup ? ` · next ${formatDate(nextGroup.s!.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} (${nextGroup.g.groupName ?? nextGroup.g.title})` : ''}
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] transition group-hover:translate-x-1">Open my groups →</p>
        </Link>
      )}

      {(profileGaps.length > 0 || !coach.active) && (
        <div className="panel gloss-sheen border border-line p-6">
          <p className="font-semibold">Finish your profile</p>
          <p className="mt-1 text-sm text-muted">
            {profileGaps.length > 0 ? `Add ${profileGaps.join(', ')} so families can choose you.` : ''}{' '}
            {!coach.active && 'Your profile is hidden from families until an admin activates it.'}
          </p>
          <Link href="/coach/profile" className="mt-4 inline-block bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.15em] text-black">Edit profile</Link>
        </div>
      )}

      <section>
        <h2 className="font-display text-2xl font-semibold uppercase">Availability</h2>
        {terms.length === 0 ? (
          <p className="mt-4 text-muted">No terms are open for availability right now.</p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {terms.map((t) => {
              const a = byTerm.get(t.id)
              const submitted = Boolean(a?.submittedAt)
              const overdue = !submitted && new Date(t.availabilityDeadline) < new Date()
              return (
                <Link key={t.id} href={`/coach/availability/${t.id}`} className="panel gloss-sheen group block border border-line p-6 transition hover:border-white/40">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-xl font-semibold uppercase">{t.name}</p>
                      <p className="mt-1 text-sm text-muted">{formatDate(t.startDate)} – {formatDate(t.endDate)}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${submitted ? 'bg-white text-black' : overdue ? 'bg-red-500/20 text-red-300' : 'border border-line text-muted'}`}>
                      {submitted ? `${a!.slots?.length ?? 0} slots` : overdue ? 'Overdue' : 'Not submitted'}
                    </span>
                  </div>
                  <p className="mt-4 text-sm">
                    {submitted ? 'Submitted — you can still add or change times.' : `Due ${formatDate(t.availabilityDeadline, { weekday: 'long', day: 'numeric', month: 'long' })}`}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] transition group-hover:translate-x-1">{submitted ? 'Update availability →' : 'Set availability →'}</p>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
