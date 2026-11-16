import type { Payload } from 'payload'
import { formatDate } from '@/lib/payload'
import { Summary } from '@/reflections/Summary'
import { findReflection, kidLink, pillars, playerGames, relId, type GameContext } from '@/reflections/service'
import { ShareLink } from '../account/referrals/Forms'
import { ReflectForm } from './ReflectForm'
import type { ReflectAuth } from './actions'

const when = (d: Date | string) => formatDate(new Date(d).toISOString(), { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** The reflection page for one player and game — the same for the family account and the player's private link. */
export async function ReflectView({ p, g, auth, family }: { p: Payload; g: GameContext; auth: ReflectAuth; family: boolean }) {
  const [list, reflection, games] = await Promise.all([pillars(p), findReflection(p, g.participant.id, g.fixture.id, 1), playerGames(p, g.participant.id)])
  // The focus they set after their previous game — shown at the top as a reminder
  const prev = games.filter((x) => x.fixture.startsAt < g.fixture.startsAt && x.reflection?.status === 'submitted' && x.reflection.focus).sort((a, b) => b.fixture.startsAt.localeCompare(a.fixture.startsAt))[0]
  const kid = g.participant.firstName
  return (
    <div className="container-x max-w-2xl py-12">
      <p className="eyebrow !text-brand">Match reflection</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase">{kid}: {g.team.name} vs {g.fixture.opponent}</h1>
      <p className="mt-2 text-sm text-muted">{when(g.fixture.startsAt)}{g.fixture.result ? ` · ${g.fixture.result}` : ''}{g.state === 'open' ? ` · closes ${when(g.window.closesAt)}` : ''}</p>
      {prev && <p className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">Your focus for this game was: <strong>{prev.reflection!.focus}</strong></p>}

      <div className="mt-8">
        {g.state === 'upcoming' && <p className="rounded-xl border border-line px-5 py-4">Reflections open {when(g.window.opensAt)} — come back after the game.</p>}
        {g.state === 'closed' && (reflection?.status === 'submitted' ? <Summary r={reflection} /> : <p className="rounded-xl border border-line px-5 py-4">This reflection has closed. There’ll be another after the next game.</p>)}
        {g.state === 'open' && (
          <ReflectForm
            auth={auth}
            pillars={list.map((x) => ({ id: x.id, name: x.name, hint: x.hint }))}
            playerName={kid}
            submittedBefore={reflection?.status === 'submitted'}
            initial={{
              feeling: reflection?.feeling ?? null,
              focus: reflection?.focus ?? '',
              moments: (reflection?.moments ?? []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((m) => ({ type: m.type, pillar: relId(m.pillar), comment: m.comment ?? '' })),
            }}
          />
        )}
      </div>

      {family && g.state === 'open' && reflection?.status !== 'submitted' && (
        <section className="mt-12 rounded-2xl border border-line p-5">
          <h2 className="font-semibold">Let {kid} do it on their own device</h2>
          <p className="mt-1 text-sm text-muted">This private link opens only {kid}’s reflection for this game — no login, and it stops working when the reflection closes. Their answers and yours are the same reflection.</p>
          <div className="mt-3"><ShareLink link={kidLink(g)} text={`${kid}, here’s your match reflection:`} /></div>
        </section>
      )}
    </div>
  )
}
