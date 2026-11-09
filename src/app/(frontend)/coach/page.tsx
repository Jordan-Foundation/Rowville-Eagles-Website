import Link from 'next/link'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { coachSessions } from '@/academy/coach-sessions'
import { coachGroups, nextSession } from '@/academy/terms/coach-groups'
import { RoleSwitch, myChildren } from '@/components/dashboard/RoleSwitch'
import { LiveDashboard } from '@/components/dashboard/LiveDashboard'
import { coachAttention } from '@/lib/attention'
import { coachItems } from './items'
import { NextUpCard, type NextUp } from '@/components/coach/NextUpCard'
import { localToUtc, localYmd } from '@/lib/time'
import { weekdayOf } from '@/academy/training-day'

export const dynamic = 'force-dynamic'

export default async function CoachHome() {
  const { coach, user } = await requireCoach('/coach')
  const p = await payload()
  const [kids, counts] = await Promise.all([myChildren(p, user), coachAttention(p, user, coach)])
  const [{ docs: terms }, { docs: mine }] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-terms', where: { status: { in: ['availability', 'open'] } }, sort: 'startDate', depth: 0, limit: 10 }),
    p.find({ pagination: false, collection: 'academy-availability', where: { coach: { equals: coach.id } }, depth: 0, limit: 50, overrideAccess: true }),
  ])
  const now = new Date()
  const [next, groups] = await Promise.all([coachSessions(p, coach.id, { from: now, to: new Date(now.getTime() + 7 * 86_400_000) }), coachGroups(p, coach.id)])
  const nextGroup = groups.map((g) => ({ g, s: nextSession(g, now) })).filter((x) => x.s).sort((a, b) => a.s!.startsAt.localeCompare(b.s!.startsAt))[0]
  // Today / next session: the earliest of my 1-on-1s, group trainings and team trainings
  const soon = new Date(now.getTime() - 60 * 60_000)
  const candidates: NextUp[] = []
  const one = next.find((x) => new Date(x.session.startsAt) > soon)
  if (one) candidates.push({ when: one.session.startsAt, title: `1-on-1 · ${one.booking.player.firstName} ${one.booking.player.lastName}`, players: 1, medical: one.booking.player.medical?.trim() ? 1 : 0, href: `/coach/sessions/${one.session.id}`, hrefLabel: 'Open session', parent: { name: `${one.booking.contact.firstName} ${one.booking.contact.lastName}`, phone: one.booking.contact.mobile, accountId: typeof one.booking.account === 'object' ? one.booking.account?.id : one.booking.account } })
  if (nextGroup) candidates.push({ when: nextGroup.s!.startsAt, title: nextGroup.g.title, subtitle: nextGroup.g.program.title, players: nextGroup.g.players.length, medical: nextGroup.g.players.filter((r) => r.player.medical?.trim()).length, href: `/coach/today?date=${nextGroup.s!.date}`, hrefLabel: 'Training day & attendance' })
  const myTeams = (await p.find({ pagination: false, collection: 'teams', where: { coaches: { in: [user.id] }, archived: { not_equals: true } }, limit: 50, depth: 0, overrideAccess: true })).docs
  for (let d = 0; d < 7 && myTeams.length; d++) {
    const ymd = localYmd(new Date(now.getTime() + d * 86_400_000))
    for (const t of myTeams) for (const tr of (t.training ?? []).filter((x) => x.day === weekdayOf(ymd))) {
      const when = localToUtc(ymd, tr.start)
      if (when > soon) candidates.push({ when: when.toISOString(), title: t.name, subtitle: ['Team training', tr.location].filter(Boolean).join(' · '), players: 0, medical: 0, href: `/coach/today?date=${ymd}`, hrefLabel: 'Training day & attendance', teamId: t.id } as NextUp & { teamId: number })
    }
  }
  candidates.sort((a, b) => a.when.localeCompare(b.when))
  const upNext = candidates[0] ?? null
  if (upNext && 'teamId' in upNext) {
    const { docs: members } = await p.find({ pagination: false, collection: 'team-members', where: { team: { equals: (upNext as NextUp & { teamId: number }).teamId }, active: { equals: true } }, limit: 200, depth: 1, overrideAccess: true })
    upNext.players = members.length
    upNext.medical = members.filter((m) => typeof m.participant === 'object' && m.participant?.medical?.conditions?.trim()).length
  }
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

      <NextUpCard next={upNext} today={localYmd(now)} />

      <LiveDashboard items={coachItems.map((it) =>
        it.key === 'sessions' ? { ...it, hint: [counts.sessions ? `${counts.sessions} new booking${counts.sessions === 1 ? '' : 's'}` : '', next.length ? `${next.length} in the next 7 days` : 'none in the next 7 days'].filter(Boolean).join(' · ') } : it.key === 'groups' && groups.length ? { ...it, hint: `${groups.length} group${groups.length === 1 ? '' : 's'}${nextGroup ? ` · next ${formatDate(nextGroup.s!.startsAt, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}` } : it,
      )} initial={counts} role="coach" />

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

      <section id="availability" className="scroll-mt-24">
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
