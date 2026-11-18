import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { getAgeRules } from '@/lib/age-rules'
import { groupInfo, groupLabel } from '@/lib/age-groups'
import { playingYear } from '@/selections/board'
import { isSuccessful, notPaid, prefTags, teamCounts } from '@/selections/flow'
import { loadSelection, nameOf } from '@/selections/board-data'
import type { Squad } from '@/payload-types'
import { SelectionsNav, Flash } from '../_shared/Nav'
import { href, selectionContext, type Search } from '../_shared/ctx'
import { MacroBoard, type MacroCard } from './MacroBoard'
import { MicroBoard, type MicroCard, type MicroTeam } from './MicroBoard'
import { TeamAdmin } from './TeamAdmin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Selected players', robots: { index: false } }

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))

/**
 * Selected players. Macro: every age group side by side — drag players between age groups to balance numbers.
 * Micro: one age group — drag players into teams and position groups.
 */
export default async function SelectedPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireManagement('/management/selections/selected')
  const sp = await searchParams
  const { p, program, rounds, round, age } = await selectionContext(sp)
  const view = sp.view === 'micro' ? 'micro' : 'macro'
  const rules = await getAgeRules(p)
  const data = round ? await loadSelection(p, round) : null
  const selected = (data?.entries ?? []).filter(isSuccessful)
  const ages = [...new Set(selected.map((e) => playingYear(e)))].sort((a, b) => b - a)
  // Macro columns: every age group with players, plus the next group up and down so players can be moved into them
  const span = ages.length ? Array.from({ length: Math.max(...ages) - Math.min(...ages) + 3 }, (_, i) => Math.max(...ages) + 1 - i).filter((y) => groupInfo(y, rules).kind !== 'too-young') : []
  const columns = age ? [age] : span
  const macro: MacroCard[] = selected.map((e) => ({ id: e.id, name: nameOf(e), born: e.birthYear ?? 0, playing: playingYear(e), team: e.squad && typeof e.squad === 'object' ? (e.squad as Squad).name : null }))

  const microAge = age ?? ages[0] ?? null
  const squads = (data?.squads ?? []).filter((s) => microAge && (s.birthYears ?? [])[0] === microAge)
  const { docs: coachUsers } = await p.find({ collection: 'users', where: { roles: { in: ['coach', 'admin', 'committee'] } }, sort: 'firstName', limit: 300, depth: 0, overrideAccess: true, pagination: false, select: { firstName: true, lastName: true, email: true } })
  const coachName = (id: number | null) => { const u = coachUsers.find((c) => c.id === id); return u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : null }
  const inAge = selected.filter((e) => playingYear(e) === microAge)
  const micro: MicroCard[] = inAge.map((e) => ({
    id: e.id,
    name: nameOf(e),
    born: e.birthYear ?? 0,
    playing: playingYear(e),
    squad: rel(e.squad),
    position: e.positionGroup ?? null,
    positionText: e.position || (typeof e.participant === 'object' ? e.participant?.football?.position : null) || null,
    tags: prefTags(e),
    np: notPaid(e),
    offerSent: !e.outcomeQueued,
  }))
  const teams: MicroTeam[] = squads.map((s) => ({
    id: s.id,
    name: s.name,
    coach: coachName(rel(s.coaches?.[0])),
    finalised: Boolean(s.finalisedAt),
    counts: teamCounts(inAge.filter((e) => rel(e.squad) === s.id)),
  }))
  const keep = { program, round: round?.id }
  const back = href('/management/selections/selected', { ...keep, view, age: microAge })

  return (
    <div className="space-y-6">
      <SelectionsNav active="selected" program={program} rounds={rounds} round={round} age={age} ages={ages} queued={(data?.entries ?? []).filter((e) => e.outcomeQueued).length} title="Selected players" intro={view === 'macro' ? 'Every selected player by age group. Drag a player to another age group to play them up or down — it clears their team.' : 'Build teams for one age group: drag players into a team and position, or use “Move to…”. Changes save straight away.'} extra={<input type="hidden" name="view" value={view} />} />
      <Flash done={sp.done} error={sp.error} />
      {round && <p className="text-sm"><a href={`/management/selections/${round.id}/export?tab=selected`} className="underline">Download selected players (CSV, with teams and preferences)</a></p>}
      <div role="tablist" aria-label="View" className="flex gap-2 text-sm">
        <Link role="tab" aria-selected={view === 'macro'} href={href('/management/selections/selected', { ...keep, view: 'macro' })} className={`px-4 py-2 ${view === 'macro' ? 'bg-white text-black' : 'border border-line text-muted hover:text-ink'}`}>Macro · age groups</Link>
        <Link role="tab" aria-selected={view === 'micro'} href={href('/management/selections/selected', { ...keep, view: 'micro', age: microAge })} className={`px-4 py-2 ${view === 'micro' ? 'bg-white text-black' : 'border border-line text-muted hover:text-ink'}`}>Micro · teams</Link>
      </div>
      {!round || !selected.length ? (
        <p className="border border-line p-6 text-muted">No selected players yet. Mark players Successful on the <Link href={href('/management/selections/trialists', keep)} className="underline">Trialists</Link> page.</p>
      ) : view === 'macro' ? (
        <MacroBoard cards={macro} columns={columns.map((y) => ({ year: y, label: groupLabel(y), hint: groupInfo(y, rules).hint }))} />
      ) : (
        <>
          <nav aria-label="Age group" className="flex flex-wrap gap-2 text-sm">
            {ages.map((a) => (
              <Link key={a} href={href('/management/selections/selected', { ...keep, view: 'micro', age: a })} aria-current={a === microAge ? 'page' : undefined} className={`border px-3 py-1.5 ${a === microAge ? 'border-white text-ink' : 'border-line text-muted hover:text-ink'}`}>
                {groupLabel(a)} <span className="text-xs text-muted">({selected.filter((e) => playingYear(e) === a).length})</span>
              </Link>
            ))}
          </nav>
          <MicroBoard key={microAge} cards={micro} teams={teams} unassignedCount={micro.filter((c) => !c.squad).length} />
          <TeamAdmin back={back} round={round.id} ageGroup={microAge!} ageLabel={groupLabel(microAge!)} teams={squads.map((s) => ({ id: s.id, name: s.name, coach: rel(s.coaches?.[0]), finalised: Boolean(s.finalisedAt), players: inAge.filter((e) => rel(e.squad) === s.id).length }))} coaches={coachUsers.map((c) => ({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email }))} unassigned={micro.filter((c) => !c.squad).length} reviewHref={(id) => href(`/management/selections/teams/${id}`, keep)} />
        </>
      )}
    </div>
  )
}
