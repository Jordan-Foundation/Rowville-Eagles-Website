import Link from 'next/link'
import type { Payload } from 'payload'
import { formatDate } from '@/lib/payload'
import { computeStats } from './rules'
import { familyLink, pillars, playerGames, playerStreak, reflectionSettings, relId } from './service'
import { PillarBars } from './Charts'
import { Summary } from './Summary'

/** A player's season: streak, strengths vs things to work on by pillar, and every game's reflection with coach notes. */
export async function PlayerHistory({ p, participantId, family }: { p: Payload; participantId: number; family: boolean }) {
  const [games, list, s] = await Promise.all([playerGames(p, participantId), pillars(p, true), reflectionSettings(p)])
  const season = new Date().getFullYear()
  const seasonGames = games.filter((g) => new Date(g.fixture.startsAt).getFullYear() === season && g.state !== 'upcoming')
  const done = seasonGames.filter((g) => g.reflection?.status === 'submitted')
  const stats = computeStats(done.map((g) => ({ participant: participantId, status: 'submitted', feeling: g.reflection!.feeling, fixtureAt: g.fixture.startsAt, moments: (g.reflection!.moments ?? []).map((m) => ({ type: m.type, pillar: relId(m.pillar), pillarName: m.pillarName })) })), list.map((x) => ({ id: x.id, name: x.name })), seasonGames.length)
  const run = playerStreak(games)
  const shown = games.filter((g) => g.state !== 'upcoming')
  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line p-5"><p className="text-sm text-muted">Reflections this season</p><p className="mt-1 text-3xl font-bold tabular-nums">{done.length}<span className="text-base font-normal text-muted"> / {seasonGames.length} games</span></p></div>
        {s.showStreak && <div className="rounded-2xl border border-line p-5" data-streak={run}><p className="text-sm text-muted">Streak</p><p className="mt-1 text-3xl font-bold">{run > 0 ? `🔥 ${run}` : '–'}</p><p className="text-xs text-muted">{run >= 3 ? 'games in a row — keep it going!' : run > 0 ? 'in a row' : 'Reflect after your next game to start one'}</p></div>}
        <div className="rounded-2xl border border-line p-5"><p className="text-sm text-muted">Average feeling</p><p className="mt-1 text-3xl font-bold tabular-nums">{stats.feelingAverage ?? '–'}<span className="text-base font-normal text-muted"> / 5</span></p></div>
      </div>
      {done.length > 0 && <div className="rounded-2xl border border-line p-5"><PillarBars pillars={stats.pillars} caption={`${season} season by skill area`} /></div>}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold uppercase">Games</h2>
        {shown.length === 0 && <p className="text-muted">No games to reflect on yet.</p>}
        {shown.map((g) => (
          <details key={g.fixture.id} className="rounded-2xl border border-line p-5" open={g.state === 'open'}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{g.team.name} vs {g.fixture.opponent} <span className="font-normal text-muted">· {formatDate(g.fixture.startsAt, { day: 'numeric', month: 'short' })}</span></span>
              <span className="text-sm">{g.reflection?.status === 'submitted' ? '✅ Reflected' : g.state === 'open' ? (g.reflection ? '✏️ Draft' : '🕒 Open') : 'Missed'}{(g.reflection?.feedback ?? []).some((f) => f.comment) ? ' · 💬 coach note' : (g.reflection?.feedback ?? []).length ? ' · 👍 seen' : ''}</span>
            </summary>
            <div className="mt-4">
              {g.reflection?.status === 'submitted' && <Summary r={g.reflection} />}
              {family && g.state === 'open' && <Link href={familyLink(participantId, g.team.id, g.fixture.id)} className="mt-3 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">{g.reflection?.status === 'submitted' ? 'Edit' : 'Reflect now'}</Link>}
            </div>
          </details>
        ))}
      </section>
    </div>
  )
}
