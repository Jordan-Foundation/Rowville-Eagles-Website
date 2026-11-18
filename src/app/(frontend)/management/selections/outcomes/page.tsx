import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { getAgeRules } from '@/lib/age-rules'
import { groupLabel } from '@/lib/age-groups'
import { playingYear } from '@/selections/board'
import { lastTrialDates, renderOutcome } from '@/selections/service'
import { loadSelection, nameOf } from '@/selections/board-data'
import { SelectionsNav, Flash } from '../_shared/Nav'
import { href, selectionContext, type Search } from '../_shared/ctx'
import { sendOutcomesAction } from '../v2-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const metadata: Metadata = { title: 'Send outcome emails', robots: { index: false } }

const KIND = { successful: 'Successful', selected: 'Selected', unsuccessful: 'Unsuccessful' } as const

/** Review & send: a summary of the outcomes waiting, a preview of each email, then one confirmed send. */
export default async function OutcomesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireManagement('/management/selections/outcomes')
  const sp = await searchParams
  const { p, program, rounds, round, age } = await selectionContext(sp)
  const data = round ? await loadSelection(p, round) : null
  const rules = await getAgeRules(p)
  const queued = (data?.entries ?? []).filter((e) => e.outcomeQueued)
  const dates = await lastTrialDates(p, queued.map((e) => e.id))
  const previews = round ? queued.map((e) => ({ e, r: renderOutcome(e, round, rules, { trialDate: dates.get(e.id) }) })) : []
  const kinds = (['successful', 'selected', 'unsuccessful'] as const).filter((k) => previews.some((x) => x.r.kind === k))
  const noProgram = round && !round.program && previews.some((x) => x.r.kind !== 'unsuccessful')
  const back = href('/management/selections/outcomes', { program, round: round?.id })
  return (
    <div className="space-y-6">
      <SelectionsNav active="outcomes" program={program} rounds={rounds} round={round} age={age} ages={data?.ages ?? []} queued={queued.length} title="Send outcome emails" intro="Nothing goes to families until you confirm below." />
      <Flash done={sp.done} error={sp.error} />
      {!queued.length && <p className="border border-line p-6 text-muted">No outcomes waiting. Mark players on the <Link href={href('/management/selections/trialists', { program, round: round?.id })} className="underline">Trialists</Link> page first.</p>}
      {queued.length > 0 && round && (
        <>
          <p className="font-display text-2xl font-semibold uppercase" data-summary>
            {kinds.map((k) => `${previews.filter((x) => x.r.kind === k).length} ${KIND[k].toLowerCase()}`).join(' · ')}
          </p>
          {noProgram && <p role="alert" className="border border-red-400/40 p-3 text-sm text-red-200">This round has no registration program, so successful players would have nothing to pay. Set it in Admin → Selection rounds → {round.title} → Program.</p>}
          {kinds.map((k) => {
            const items = previews.filter((x) => x.r.kind === k)
            const sample = items[0].r
            return (
              <section key={k} className="space-y-3 border border-line p-5" aria-label={KIND[k]} data-kind={k}>
                <h2 className="font-display text-xl font-semibold uppercase">{KIND[k]} · {items.length}</h2>
                <p className="text-sm text-muted">{items.map((x) => `${nameOf(x.e)} (${groupLabel(playingYear(x.e))})`).join(', ')}</p>
                <div className="border border-line bg-white/5 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wider text-muted">Example — {nameOf(items[0].e)}</p>
                  <p className="mt-2 font-semibold">{sample.subject}</p>
                  <div className="mt-2 space-y-2" dangerouslySetInnerHTML={{ __html: sample.bodyHtml }} />
                  {k !== 'unsuccessful' && <p className="mt-3 text-xs text-muted">Includes a “Complete registration” button with their payment link.</p>}
                  {sample.sms && <p className="mt-3 text-xs"><strong>Text:</strong> {sample.sms}</p>}
                  {sample.missing.length > 0 && <p className="mt-2 text-xs text-amber-300">Unknown merge fields: {sample.missing.join(' ')}</p>}
                </div>
              </section>
            )
          })}
          <form action={sendOutcomesAction} className="border-2 border-amber-400/70 p-5" aria-label="Send outcome emails">
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="round" value={round.id} />
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirm" className="mt-1" /> <span>I’ve checked these {queued.length} outcomes — send the emails now. Families receive them straight away; this can’t be undone.</span></label>
            <button disabled={Boolean(noProgram)} className="mt-4 min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-40">Send {queued.length} outcome email{queued.length === 1 ? '' : 's'}</button>
          </form>
          <p className="text-sm"><Link href={href('/management/selections/messages', { program, round: round.id })} className="underline">Edit the email templates →</Link></p>
        </>
      )}
    </div>
  )
}
