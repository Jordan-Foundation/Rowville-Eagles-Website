import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { formatDate } from '@/lib/format'
import { groupLabel } from '@/lib/age-groups'
import { playingYear } from '@/selections/board'
import { isUnsuccessful } from '@/selections/flow'
import { loadSelection, matchesSearch, nameOf } from '@/selections/board-data'
import { SelectionsNav, Flash } from '../_shared/Nav'
import { href, selectionContext, type Search } from '../_shared/ctx'
import { trialistAction } from '../v2-actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Unsuccessful', robots: { index: false } }

/** Players marked unsuccessful — kept, never deleted. Until the email goes, they can be moved back to the trialist list. */
export default async function UnsuccessfulPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireManagement('/management/selections/unsuccessful')
  const sp = await searchParams
  const { p, program, rounds, round, age } = await selectionContext(sp)
  const data = round ? await loadSelection(p, round) : null
  const rows = (data?.entries ?? []).filter((e) => isUnsuccessful(e) && (!age || playingYear(e) === age) && matchesSearch(e, sp.q))
  const back = href('/management/selections/unsuccessful', { program, round: round?.id, age, q: sp.q })
  return (
    <div className="space-y-6">
      <SelectionsNav active="unsuccessful" program={program} rounds={rounds} round={round} age={age} ages={data?.ages ?? []} queued={(data?.entries ?? []).filter((e) => e.outcomeQueued).length} title="Unsuccessful" intro="Everyone marked unsuccessful this season. Records are kept." extra={<label className="grid gap-1 text-xs text-muted">Search<input name="q" defaultValue={sp.q ?? ''} className="min-h-10 border border-line bg-surface px-2 text-sm" /></label>} />
      <Flash done={sp.done} error={sp.error} />
      <form action={trialistAction}>
        <input type="hidden" name="back" value={back} />
        <ul className="divide-y divide-line border border-line">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm" data-unsuccessful={nameOf(e)}>
              <span><strong>{nameOf(e)}</strong> <span className="text-muted">· {groupLabel(playingYear(e))} · born {e.birthYear}</span></span>
              {e.outcomeQueued ? (
                <span className="flex items-center gap-3"><span className="text-amber-300">Email not sent yet</span><button name="one" value={`${e.id}:clear`} className="text-xs underline">Back to trialists</button></span>
              ) : (
                <span className="text-muted">Told {e.outcomeSentAt ? formatDate(e.outcomeSentAt, { day: 'numeric', month: 'short' }) : ''}{e.outcomeEmail === false ? ' (no email)' : ''}</span>
              )}
            </li>
          ))}
          {rows.length === 0 && <li className="p-4 text-muted">Nobody here.</li>}
        </ul>
      </form>
    </div>
  )
}
