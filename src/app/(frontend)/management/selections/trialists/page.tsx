import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { formatDate } from '@/lib/format'
import { groupLabel } from '@/lib/age-groups'
import { playingYear } from '@/selections/board'
import { isTrialist, PROGRAMS, STAGE_LABEL, trialistStage } from '@/selections/flow'
import { loadSelection, matchesSearch, nameOf } from '@/selections/board-data'
import { SelectionsNav, Flash } from '../_shared/Nav'
import { href, selectionContext, type Search } from '../_shared/ctx'
import { trialistAction } from '../v2-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 120
export const metadata: Metadata = { title: 'Trialists', robots: { index: false } }

const sel = 'min-h-10 border border-line bg-surface px-2 text-sm'
const btn = 'min-h-9 border px-2.5 text-xs font-semibold uppercase tracking-[0.08em]'
const day = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })

/** Everyone who's registered for a trial and hasn't had an outcome marked — mark them Successful, Unsuccessful or Needs another trial. */
export default async function TrialistsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireManagement('/management/selections/trialists')
  const sp = await searchParams
  const { p, program, rounds, round, age } = await selectionContext(sp)
  const data = round ? await loadSelection(p, round) : null
  const { docs: sessions } = await p.find({ collection: 'trial-sessions', where: { or: [{ program: { equals: program } }, ...(program === 'eagles' ? [{ program: { exists: false } }] : [])] }, sort: 'start', limit: 300, depth: 0, overrideAccess: true, pagination: false })
  const upcoming = sessions.filter((s) => new Date(s.start).getTime() > Date.now() && s.status !== 'closed')
  const sessionId = Number(sp.session) || null
  const stage = sp.stage && sp.stage in STAGE_LABEL ? (sp.stage as keyof typeof STAGE_LABEL) : null
  const rows = (data?.entries ?? [])
    .filter(isTrialist)
    .map((e) => ({ e, invites: data!.invitesOf(e.id) }))
    .map((r) => ({ ...r, stage: trialistStage(r.e, r.invites), by: playingYear(r.e) }))
    .filter((r) => (!age || r.by === age) && (!sessionId || r.invites.some((i) => i.session === sessionId)) && (!stage || r.stage === stage) && matchesSearch(r.e, sp.q))
    .sort((a, b) => b.by - a.by || nameOf(a.e).localeCompare(nameOf(b.e)))
  const queued = (data?.entries ?? []).filter((e) => e.outcomeQueued).length
  const back = href('/management/selections/trialists', { program, round: round?.id, age, session: sessionId, stage, q: sp.q })
  const progLabel = PROGRAMS.find((x) => x.key === program)!.label

  return (
    <div className="space-y-6">
      <SelectionsNav
        active="trialists"
        program={program}
        rounds={rounds}
        round={round}
        age={age}
        ages={data?.ages ?? []}
        queued={queued}
        title="Trialists"
        intro="Everyone registered for a trial without an outcome yet. Marking an outcome sends nothing — emails go when you press Send outcome emails."
        extra={
          <>
            <label className="grid gap-1 text-xs text-muted">Trial
              <select name="session" defaultValue={sessionId ?? ''} className={sel}>
                <option value="">All trials</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{day(s.start)} · {s.title}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted">Status
              <select name="stage" defaultValue={stage ?? ''} className={sel}>
                <option value="">Any</option>
                {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted">Search
              <input name="q" defaultValue={sp.q ?? ''} placeholder="Player or parent name" className={sel} />
            </label>
          </>
        }
      />
      <Flash done={sp.done} error={sp.error} />
      {!round && <p className="text-muted">No {progLabel} rounds yet — they’re created when the first family registers.</p>}
      {round && (
        <form action={trialistAction} aria-label="Trialists">
          <input type="hidden" name="back" value={back} />
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-surface py-3 text-sm">
            <span className="text-muted" data-count={rows.length}>{rows.length} trialist{rows.length === 1 ? '' : 's'} · with ticked:</span>
            <button name="outcome" value="successful" className={`${btn} border-emerald-400/60 text-emerald-200`}>Successful</button>
            <button name="outcome" value="unsuccessful" className={`${btn} border-red-400/50 text-red-200`}>Unsuccessful</button>
            <button name="outcome" value="another" className={`${btn} border-amber-400/60 text-amber-200`}>Needs another trial</button>
            {upcoming.length > 0 && (
              <span className="flex flex-wrap items-center gap-2">
                <select name="session" aria-label="Invite ticked players to" className={sel} defaultValue="">
                  <option value="">Invite to trial…</option>
                  {upcoming.map((s) => <option key={s.id} value={s.id}>{day(s.start)} · {(s.birthYears ?? []).map((y) => groupLabel(y)).join(', ')}</option>)}
                </select>
                <button name="invite" value="bulk" className={`${btn} border-line`}>Invite</button>
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="w-8 py-2"><span className="sr-only">Select</span></th>
                  {['Player', 'Age group', 'Trials', 'Position / notes', 'Status', 'Outcome'].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ e, invites, stage: st, by }) => {
                  const next = upcoming.filter((s) => (s.birthYears ?? []).includes(by) && !invites.some((i) => i.session === s.id))
                  return (
                    <tr key={e.id} data-trialist={nameOf(e)} data-stage={st} className="align-top">
                      <td className="py-2"><input type="checkbox" name="ids" value={e.id} aria-label={`Select ${nameOf(e)}`} /></td>
                      <td className="px-2 py-2">
                        <span className="font-semibold">{nameOf(e)}</span>
                        <span className="block text-xs text-muted">{e.contact.firstName} {e.contact.lastName} · {e.contact.phone}</span>
                      </td>
                      <td className="px-2 py-2">{groupLabel(by)}{e.birthYear && e.birthYear !== by ? <span className="block text-xs text-amber-300">born {e.birthYear}</span> : <span className="block text-xs text-muted">born {e.birthYear ?? '?'}</span>}<span className="block text-xs text-muted">{progLabel}</span></td>
                      <td className="px-2 py-2 text-xs" data-trials>
                        {invites.length ? invites.map((i) => <span key={i.id} className="block">{i.attended ? '✓' : '·'} {day(i.start)}{i.attended ? '' : new Date(i.start).getTime() < Date.now() ? ' (didn’t attend)' : ' (invited)'}</span>) : <span className="text-muted">Not invited yet</span>}
                      </td>
                      <td className="px-2 py-2 text-xs">{e.position || (typeof e.participant === 'object' && e.participant?.football?.position) || ''}{e.player.notes ? <span className="block text-muted">{e.player.notes.slice(0, 120)}</span> : null}</td>
                      <td className="px-2 py-2 text-xs"><span className={st === 'another_trial' ? 'text-amber-300' : st === 'attended' ? 'text-emerald-300' : 'text-muted'}>{STAGE_LABEL[st]}</span></td>
                      <td className="px-2 py-2">
                        <span className="flex flex-wrap gap-1.5">
                          <button name="one" value={`${e.id}:successful`} aria-label={`${nameOf(e)}: successful`} className={`${btn} border-emerald-400/60 text-emerald-200`}>Successful</button>
                          <button name="one" value={`${e.id}:unsuccessful`} aria-label={`${nameOf(e)}: unsuccessful`} className={`${btn} border-red-400/50 text-red-200`}>Unsuccessful</button>
                          {st !== 'another_trial' && <button name="one" value={`${e.id}:another`} aria-label={`${nameOf(e)}: needs another trial`} className={`${btn} border-amber-400/60 text-amber-200`}>Another trial</button>}
                        </span>
                        {st === 'another_trial' && (
                          <details className="mt-2 text-xs" data-invite-next>
                            <summary className="cursor-pointer font-semibold underline">Invite to next trial</summary>
                            {next.length ? (
                              <span className="mt-2 flex flex-wrap gap-2">
                                <select name={`session-${e.id}`} aria-label={`Next trial for ${nameOf(e)}`} className={sel}>
                                  {next.map((s) => <option key={s.id} value={s.id}>{day(s.start)} {formatDate(s.start, { hour: 'numeric', minute: '2-digit' })} · {s.location ?? ''}</option>)}
                                </select>
                                <button name="invite" value={e.id} className={`${btn} border-white`}>Send invite</button>
                              </span>
                            ) : (
                              <span className="mt-2 block text-muted">No upcoming trials for {groupLabel(by)}. <Link href={href('/management/selections/sessions', { program, round: round.id })} className="underline">Add one</Link>.</span>
                            )}
                          </details>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-muted">No trialists match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </form>
      )}
      <p className="flex flex-wrap gap-4 text-sm"><Link href="/management/selections/import" className="underline">Import EOIs or a trial list →</Link><Link href="/management/selections/trial-invites" className="underline">Send trial dates to waiting families →</Link></p>
    </div>
  )
}
