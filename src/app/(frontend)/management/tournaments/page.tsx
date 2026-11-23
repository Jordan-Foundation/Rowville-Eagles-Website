import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { squadCounts } from '@/tournaments/service'
import { createTournament } from './actions'
import { TournamentFields } from './Fields'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'RFA tournaments', robots: { index: false } }

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireManagement('/management/tournaments')
  const sp = await searchParams
  const p = await payload()
  const { docs: list } = await p.find({ collection: 'rfa-tournaments', sort: '-startDate', limit: 100, depth: 0, overrideAccess: true, pagination: false })
  const { docs: invites } = list.length ? await p.find({ collection: 'tournament-invites', where: { tournament: { in: list.map((t) => t.id) } }, limit: 5000, depth: 0, overrideAccess: true, pagination: false, select: { tournament: true, status: true } }) : { docs: [] }
  return (
    <div className="max-w-4xl space-y-10 pb-12">
      <header>
        <h1 className="font-display text-4xl font-semibold uppercase">RFA tournaments</h1>
        <p className="mt-2 text-sm text-muted">Create a tournament, add squads, and invite RFA players. Families accept or decline by email, phone notification or their account (and pay any fee).</p>
      </header>
      {sp.error && <p role="alert" className="border border-red-500/40 p-3 text-sm text-red-300">{sp.error}</p>}
      <section className="space-y-2">
        {list.length ? (
          <ul className="divide-y divide-line border border-line">
            {list.map((t) => {
              const c = squadCounts(invites.filter((i) => (typeof i.tournament === 'object' ? i.tournament.id : i.tournament) === t.id))
              return (
                <li key={t.id}><Link href={`/management/tournaments/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/5" data-tournament={t.name}>
                  <span><span className="font-semibold">{t.name}</span><span className="block text-xs text-muted">{formatDate(t.startDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}{t.venue ? ` · ${t.venue}` : ''} · RSVP {formatDate(t.rsvpDeadline, { day: 'numeric', month: 'short' })}</span></span>
                  <span className="text-xs text-muted">{c.accepted} accepted · {c.noResponse} waiting · {c.declined} declined →</span>
                </Link></li>
              )
            })}
          </ul>
        ) : <p className="text-sm text-muted">No tournaments yet.</p>}
      </section>
      <section className="border border-line p-5">
        <h2 className="font-display text-xl font-semibold uppercase">New tournament</h2>
        <form action={createTournament} className="mt-4 space-y-4" aria-label="New tournament">
          <TournamentFields />
          <button className="min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black">Create tournament</button>
        </form>
      </section>
    </div>
  )
}
