import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { birthYearOf, groupLabel } from '@/lib/age-groups'
import { openPlaces, rfaPlayers, squadCounts, squadLimit } from '@/tournaments/service'
import type { TournamentSquad } from '@/payload-types'
import { addSquad, invite, updateTournament, withdrawInvite } from '../actions'
import { TournamentFields } from '../Fields'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'RFA tournament', robots: { index: false } }

const input = 'min-h-10 border border-line bg-surface px-2 text-sm'
const btn = 'min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black'
const LABEL: Record<string, string> = { invited: 'No response yet', accepted: 'Accepted — fee unpaid', paid: 'Confirmed', declined: 'Declined', expired: 'Expired', withdrawn: 'Withdrawn' }

export default async function TournamentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ squad?: string; years?: string; q?: string; done?: string; error?: string }> }) {
  const { id } = await params
  await requireManagement(`/management/tournaments/${id}`)
  const sp = await searchParams
  const p = await payload()
  const t = await p.findByID({ collection: 'rfa-tournaments', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!t) notFound()
  const [{ docs: squads }, { docs: invites }] = await Promise.all([
    p.find({ collection: 'tournament-squads', where: { tournament: { equals: t.id } }, sort: 'name', limit: 50, depth: 0, overrideAccess: true, pagination: false }),
    p.find({ collection: 'tournament-invites', where: { tournament: { equals: t.id } }, sort: 'playerName', limit: 2000, depth: 0, overrideAccess: true, pagination: false }),
  ])
  const active = (squads.find((s) => String(s.id) === sp.squad) ?? squads[0]) as TournamentSquad | undefined
  const inSquad = (s: TournamentSquad) => invites.filter((i) => (typeof i.squad === 'object' ? i.squad.id : i.squad) === s.id)
  const years = sp.years !== undefined ? sp.years.split(/[\s,]+/).map(Number).filter(Boolean) : ((active?.birthYears ?? []) as number[])
  const invitedIds = new Set(invites.map((i) => (typeof i.participant === 'object' ? i.participant.id : i.participant)))
  const players = active ? (await rfaPlayers(p, { birthYears: years, q: sp.q })).filter((k) => !inSquad(active).some((i) => (typeof i.participant === 'object' ? i.participant.id : i.participant) === k.id)) : []
  return (
    <div className="max-w-5xl space-y-10 pb-16">
      <header>
        <p><Link href="/management/tournaments" className="text-sm text-muted underline">← RFA tournaments</Link></p>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase">{t.name}</h1>
        <p className="mt-1 text-sm text-muted">{formatDate(t.startDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{t.venue ? ` · ${t.venue}` : ''} · RSVP by {formatDate(t.rsvpDeadline, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{t.fee ? ` · $${t.fee.toFixed(2)} fee` : ' · no fee'}</p>
      </header>
      {sp.done && <p role="status" className="border border-emerald-500/40 p-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/40 p-3 text-sm text-red-300">{sp.error}</p>}

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold uppercase">Squads</h2>
        {squads.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {squads.map((s) => {
              const c = squadCounts(inSquad(s))
              return (
                <Link key={s.id} href={`/management/tournaments/${t.id}?squad=${s.id}#squad-${s.id}`} aria-current={active?.id === s.id ? 'page' : undefined} className={`border p-4 ${active?.id === s.id ? 'border-mgmt-tint' : 'border-line'}`} data-squad={s.name}>
                  <p className="font-semibold">{s.name}</p>
                  <p className="mt-1 text-xs text-muted" data-counts={`${c.invited}|${c.accepted}|${c.declined}|${c.noResponse}`}>{c.invited} invited · {c.accepted} accepted{c.paid !== c.accepted ? ` (${c.paid} paid)` : ''} · {c.declined} declined · {c.noResponse} no response{c.expired ? ` · ${c.expired} expired` : ''}</p>
                  <p className="text-xs text-muted">{c.accepted} of {squadLimit(t, s)} places filled</p>
                </Link>
              )
            })}
          </div>
        )}
        <form action={addSquad} className="flex flex-wrap items-end gap-2 border border-line p-4" aria-label="Add a squad">
          <input type="hidden" name="tournament" value={t.id} />
          <label className="grid gap-1 text-xs text-muted">Squad name<input name="name" required placeholder="U11 Squad A" className={input} /></label>
          <label className="grid gap-1 text-xs text-muted">Years of birth<input name="birthYears" placeholder="2016, 2017" className={`${input} w-32`} /></label>
          <label className="grid gap-1 text-xs text-muted">Size (blank = {t.squadSize})<input name="limit" type="number" min={1} max={40} className={`${input} w-24`} /></label>
          <button className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em]">Add squad</button>
        </form>
      </section>

      {active && (() => {
        const list = inSquad(active)
        const room = openPlaces(squadLimit(t, active), list)
        return (
          <section id={`squad-${active.id}`} className="space-y-5" aria-label={active.name}>
            <h2 className="font-display text-2xl font-semibold uppercase">{active.name}</h2>
            <div className="overflow-x-auto border border-line">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Player</th><th className="px-3 py-2 font-medium">Born</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium" /></tr></thead>
                <tbody className="divide-y divide-line">
                  {list.length ? list.map((i) => (
                    <tr key={i.id} data-invite={i.playerName} data-status={i.status}>
                      <td className="px-3 py-2">{i.playerName}</td>
                      <td className="px-3 py-2">{i.birthYear ?? ''}</td>
                      <td className="px-3 py-2">{LABEL[i.status] ?? i.status}{i.reminderAt && i.status === 'invited' ? ' · reminded' : ''}</td>
                      <td className="px-3 py-2 text-right">{['invited', 'accepted'].includes(i.status) && <form action={withdrawInvite}><input type="hidden" name="tournament" value={t.id} /><input type="hidden" name="squad" value={active.id} /><input type="hidden" name="invite" value={i.id} /><button className="text-xs underline">Withdraw</button></form>}</td>
                    </tr>
                  )) : <tr><td colSpan={4} className="px-3 py-3 text-muted">Nobody invited yet.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="border border-line p-4">
              <h3 className="font-semibold">Invite RFA players <span className="text-sm font-normal text-muted">· {room} place{room === 1 ? '' : 's'} left to invite{list.some((i) => i.status === 'declined' || i.status === 'expired') ? ' (declined and expired places are free again)' : ''}</span></h3>
              <form className="mt-3 flex flex-wrap items-end gap-2" aria-label="Filter players">
                <input type="hidden" name="squad" value={active.id} />
                <label className="grid gap-1 text-xs text-muted">Years of birth<input name="years" defaultValue={years.join(', ')} placeholder="any" className={`${input} w-36`} /></label>
                <label className="grid gap-1 text-xs text-muted">Name<input name="q" defaultValue={sp.q ?? ''} className={input} /></label>
                <button className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em]">Filter</button>
              </form>
              <form action={invite} className="mt-4 space-y-3" aria-label="Invite players">
                <input type="hidden" name="tournament" value={t.id} />
                <input type="hidden" name="squad" value={active.id} />
                {players.length ? (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {players.map((k) => {
                      const by = birthYearOf(k.dateOfBirth)
                      return (
                        <li key={k.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="player" value={k.id} aria-label={`Invite ${k.firstName} ${k.lastName}`} /> {k.firstName} {k.lastName} <span className="text-xs text-muted">{by ? `${by} · ${groupLabel(by)}` : ''}{invitedIds.has(k.id) ? ' · in another squad' : ''}</span></label></li>
                      )
                    })}
                  </ul>
                ) : <p className="text-sm text-muted">No RFA players match.</p>}
                <button className={btn} disabled={!players.length || !room}>Invite ticked players</button>
              </form>
            </div>
          </section>
        )
      })()}

      <section className="border border-line p-5">
        <h2 className="font-display text-xl font-semibold uppercase">Tournament details</h2>
        <form action={updateTournament} className="mt-4 space-y-4" aria-label="Tournament details">
          <input type="hidden" name="id" value={t.id} />
          <TournamentFields t={t} />
          <button className={btn}>Save</button>
        </form>
      </section>
    </div>
  )
}
