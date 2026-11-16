import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { activeMembers, canSeeTeam, fixtureWindow, reflectionSettings, relId, type Fixture } from '@/reflections/service'
import { windowState } from '@/reflections/rules'
import { Summary } from '@/reflections/Summary'
import { FeedbackForm } from '../../FeedbackForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Game reflections', robots: { index: false } }

/** One game: who has and hasn't reflected, each reflection, and Seen + comment. */
export default async function FixtureReflections({ params }: { params: Promise<{ team: string; fixture: string }> }) {
  const { team: teamId, fixture: fixtureId } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?next=/coach/reflections/${teamId}/${fixtureId}`)
  const p = await payload()
  const team = await p.findByID({ collection: 'teams', id: Number(teamId), depth: 0, overrideAccess: true, disableErrors: true })
  if (!team || !canSeeTeam(user, team)) notFound()
  const fixture = (team.fixtures ?? []).find((f) => f.id === fixtureId) as Fixture | undefined
  if (!fixture) notFound()
  const s = await reflectionSettings(p)
  const w = fixtureWindow(team, fixture, s)
  const members = (await activeMembers(p, team.id)).sort((a, b) => a.participant.firstName.localeCompare(b.participant.firstName))
  const { docs } = await p.find({ collection: 'match-reflections', where: { team: { equals: team.id }, fixtureId: { equals: fixture.id } }, depth: 1, limit: 500, pagination: false, overrideAccess: true })
  const by = new Map(docs.map((r) => [relId(r.participant), r]))
  const done = members.filter((m) => by.get(m.participant.id)?.status === 'submitted')
  const notYet = members.filter((m) => by.get(m.participant.id)?.status !== 'submitted')
  return (
    <div className="space-y-8">
      <div>
        <Link href="/coach/reflections" className="text-sm font-semibold underline">← Match reflections</Link>
        <h1 className="mt-4 font-display text-4xl font-semibold uppercase tracking-tight">{team.name} vs {fixture.opponent}</h1>
        <p className="mt-2 text-muted">{formatDate(fixture.startsAt, { weekday: 'long', day: 'numeric', month: 'short' })} · {done.length}/{members.length} reflected · {windowState(w) === 'open' ? `open until ${formatDate(w.closesAt.toISOString(), { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : windowState(w) === 'upcoming' ? 'opens 3 hours after kick-off' : 'closed'}</p>
      </div>
      {notYet.length > 0 && (
        <section>
          <h2 className="font-semibold">Not reflected yet</h2>
          <p className="mt-1 text-sm text-muted" data-not-reflected>{notYet.map((m) => `${m.participant.firstName} ${m.participant.lastName}${by.get(m.participant.id) ? ' (started)' : ''}`).join(', ')}</p>
        </section>
      )}
      <section className="space-y-4">
        {done.map((m) => {
          const r = by.get(m.participant.id)!
          const seen = (r.feedback ?? []).some((f) => relId(f.coach) === user.id)
          return (
            <article key={r.id} className="rounded-2xl border border-line p-5" data-reflection={m.participant.firstName}>
              <h3 className="font-semibold">{m.participant.firstName} {m.participant.lastName} {seen && <span className="text-sm font-normal text-muted">· 👍 you’ve seen this</span>}</h3>
              <div className="mt-3"><Summary r={r} /></div>
              <FeedbackForm reflectionId={r.id} seen={seen} />
            </article>
          )
        })}
      </section>
    </div>
  )
}
