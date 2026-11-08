import { payload, formatMoney } from '@/lib/payload'
import { getAgeRules } from '@/lib/age-rules'
import { groupLabel } from '@/lib/age-groups'
import { awaitingPayment, isOverdue } from '@/selections/payment'
import type { SelectionEntry } from '@/payload-types'
import { Bar, FilterBar, Heading, KpiTiles, selectCls, thCls } from '../_ui'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))
const EOI = ['interested', 'trial-booked', 'attended']
const playing = (e: Pick<SelectionEntry, 'playingBirthYear' | 'birthYear'>) => e.playingBirthYear ?? e.birthYear ?? null

/** Rowville Eagles club registrations (trials → offers → paid) for a season. */
export async function RowvilleView({ q }: { q: Record<string, string | undefined> }) {
  const p = await payload()
  const rules = await getAgeRules(p)
  const season = Number(q.season) || rules.season
  const [{ docs: rounds }, { docs: teams }] = await Promise.all([
    p.find({ pagination: false, collection: 'selection-rounds', where: { kind: { equals: 'rowville' } }, sort: '-season', limit: 50, depth: 0, overrideAccess: true }),
    p.find({ pagination: false, collection: 'teams', where: { type: { equals: 'rowville' }, archived: { not_equals: true } }, sort: 'name', limit: 200, depth: 0, overrideAccess: true }),
  ])
  const seasons = [...new Set([season, ...rounds.map((r) => r.season)])].sort((a, b) => b - a)
  const seasonRounds = rounds.filter((r) => r.season === season)
  const { docs: entriesAll } = seasonRounds.length
    ? await p.find({ pagination: false, collection: 'selection-entries', where: { round: { in: seasonRounds.map((r) => r.id) } }, limit: 5000, depth: 0, overrideAccess: true })
    : { docs: [] as SelectionEntry[] }
  const teamFilter = q.team ? Number(q.team) : null
  const yearFilter = q.age ? Number(q.age) : null
  const entries = entriesAll.filter((e) => (!teamFilter || rel(e.offeredTeam) === teamFilter) && (!yearFilter || playing(e) === yearFilter))
  const seasonTeams = teams.filter((t) => !t.season || t.season === season)
  const { docs: members } = seasonTeams.length
    ? await p.find({ pagination: false, collection: 'team-members', where: { team: { in: seasonTeams.map((t) => t.id) }, active: { equals: true } }, limit: 5000, depth: 0, overrideAccess: true, select: { team: true } })
    : { docs: [] }
  const years = [...new Set(entriesAll.map(playing).filter((y): y is number => y != null))].sort((a, b) => b - a)
  const count = (s: string[]) => entries.filter((e) => s.includes(e.status)).length
  const unpaid = entries.filter((e) => e.status === 'offered' && !e.paidAt)
  const tiles: [string, string, string?][] = [
    ['Expressions of interest', String(entries.length), `${count(['interested'])} new · ${count(['trial-booked'])} trial booked · ${count(['attended'])} trialled`],
    ['Trial outcomes pending', String(count(['trial-booked', 'attended'])), 'decide on the Selections board'],
    ['Offered a place', String(count(['offered'])), `${unpaid.length} not yet paid`],
    ['Registered & paid', String(count(['registered'])), `${count(['unsuccessful'])} unsuccessful · ${count(['withdrawn'])} withdrawn`],
    ['Unpaid', String(unpaid.length), unpaid.filter((e) => isOverdue(e)).length ? `${unpaid.filter((e) => isOverdue(e)).length} past the pay-by date` : 'none overdue'],
    ['Spots released', String(count(['released'])), 'offers that lapsed unpaid'],
  ]
  return (
    <div className="space-y-10">
      <Heading title="Rowville Eagles" sub={`${season} season · ${seasonRounds.length} trial round${seasonRounds.length === 1 ? '' : 's'}`} links={[{ href: '/management/selections', label: 'Selections board' }, { href: '/management/teams', label: 'Team pages' }]} />
      <FilterBar program="rowville">
        <select name="season" defaultValue={String(season)} className={selectCls}>{seasons.map((s) => <option key={s} value={s}>{s} season</option>)}</select>
        <select name="team" defaultValue={q.team ?? ''} className={selectCls}><option value="">All teams</option>{seasonTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select name="age" defaultValue={q.age ?? ''} className={selectCls}><option value="">All age groups</option>{years.map((y) => <option key={y} value={y}>{groupLabel(y)}</option>)}</select>
      </FilterBar>
      <KpiTiles tiles={tiles} />
      <section>
        <h3 className="font-display text-2xl font-semibold uppercase">Players per team</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted"><tr><th className={thCls}>Team</th><th className={thCls}>Age group</th><th className={`${thCls} w-64`}>Registered & paid</th><th className={thCls}>Offered, unpaid</th></tr></thead>
            <tbody className="divide-y divide-line">
              {seasonTeams.filter((t) => !teamFilter || t.id === teamFilter).map((t) => {
                const onTeam = members.filter((m) => rel(m.team) === t.id).length
                const offered = entriesAll.filter((e) => rel(e.offeredTeam) === t.id && e.status === 'offered' && !e.paidAt).length
                return (
                  <tr key={t.id}>
                    <td className="py-3 pr-4 font-medium">{t.name}</td>
                    <td className="pr-4">{t.ageGroup ?? '—'}</td>
                    <td className="pr-4"><Bar value={onTeam} max={0} label={`${onTeam} players registered`} /></td>
                    <td className={`tabular-nums ${offered ? 'text-amber-300' : ''}`}>{offered}</td>
                  </tr>
                )
              })}
              {seasonTeams.length === 0 && <tr><td colSpan={4} className="py-4 text-muted">No teams for this season yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/** Tournaments: expressions of interest → selected → paid, per tournament and squad. */
export async function TournamentsView({ q }: { q: Record<string, string | undefined> }) {
  const p = await payload()
  const { docs: rounds } = await p.find({ pagination: false, collection: 'selection-rounds', where: { kind: { equals: 'tournament' } }, sort: '-createdAt', limit: 50, depth: 0, overrideAccess: true })
  const round = rounds.find((r) => String(r.id) === q.tournament) ?? null
  const scope = round ? [round] : rounds.filter((r) => r.status !== 'closed')
  const ids = scope.map((r) => r.id)
  const [{ docs: entriesAll }, { docs: squads }] = ids.length
    ? await Promise.all([
        p.find({ pagination: false, collection: 'selection-entries', where: { round: { in: ids } }, limit: 5000, depth: 0, overrideAccess: true }),
        p.find({ pagination: false, collection: 'squads', where: { round: { in: ids } }, sort: 'name', limit: 300, depth: 0, overrideAccess: true }),
      ])
    : [{ docs: [] as SelectionEntry[] }, { docs: [] as { id: number; name: string; capacity?: number | null; fee?: number | null; round: unknown }[] }]
  const squadFilter = q.squad ? Number(q.squad) : null
  const entries = entriesAll.filter((e) => !squadFilter || rel(e.squad) === squadFilter)
  const selected = entries.filter((e) => ['selected', 'registered'].includes(e.status) || (e.status === 'offered'))
  const paid = entries.filter((e) => e.paidAt)
  const waitingPay = entries.filter((e) => awaitingPayment(e))
  const overdue = waitingPay.filter((e) => isOverdue(e))
  const feeOf = (e: SelectionEntry) => {
    const sq = squads.find((s) => s.id === rel(e.squad))
    return sq?.fee ?? scope.find((r) => r.id === rel(e.round))?.fee ?? 0
  }
  const tiles: [string, string, string?][] = [
    ['Tournaments', String(scope.length), round ? round.title : 'open or selecting'],
    ['Expressions of interest', String(entries.length), `${entries.filter((e) => EOI.includes(e.status)).length} awaiting a decision`],
    ['Selected', String(selected.length), `${entries.filter((e) => e.status === 'unsuccessful').length} unsuccessful`],
    ['Paid', String(paid.length), formatMoney(paid.reduce((n, e) => n + feeOf(e), 0))],
    ['Unpaid', String(waitingPay.length), formatMoney(waitingPay.reduce((n, e) => n + feeOf(e), 0)) + ' to come in'],
    ['Overdue', String(overdue.length), overdue.length ? 'past the pay-by date' : 'none'],
  ]
  return (
    <div className="space-y-10">
      <Heading title="Tournaments" sub={round ? round.title : 'All open tournaments'} links={[{ href: '/management/selections', label: 'Selections board' }]} />
      <FilterBar program="tournaments">
        <select name="tournament" defaultValue={q.tournament ?? ''} className={selectCls}><option value="">All open tournaments</option>{rounds.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
        <select name="squad" defaultValue={q.squad ?? ''} className={selectCls}><option value="">All teams</option>{squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </FilterBar>
      <KpiTiles tiles={tiles} />
      <section>
        <h3 className="font-display text-2xl font-semibold uppercase">Paid / unpaid per team</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted"><tr><th className={thCls}>Team</th><th className={`${thCls} w-64`}>Selected / places</th><th className={thCls}>Paid</th><th className={thCls}>Unpaid</th><th className={thCls}>Overdue</th></tr></thead>
            <tbody className="divide-y divide-line">
              {squads.filter((s) => !squadFilter || s.id === squadFilter).map((s) => {
                const e = entriesAll.filter((x) => rel(x.squad) === s.id)
                const sel = e.filter((x) => ['selected', 'offered', 'registered'].includes(x.status)).length
                return (
                  <tr key={s.id}>
                    <td className="py-3 pr-4 font-medium">{s.name}</td>
                    <td className="pr-4"><Bar value={sel} max={s.capacity ?? 0} label={`${sel} selected`} /></td>
                    <td className="pr-4 tabular-nums">{e.filter((x) => x.paidAt).length}</td>
                    <td className="pr-4 tabular-nums">{e.filter((x) => awaitingPayment(x)).length}</td>
                    <td className={`tabular-nums ${e.some((x) => isOverdue(x)) ? 'text-red-300' : ''}`}>{e.filter((x) => isOverdue(x)).length}</td>
                  </tr>
                )
              })}
              {squads.length === 0 && <tr><td colSpan={5} className="py-4 text-muted">No teams set up for these tournaments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
