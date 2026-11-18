import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { templateFor } from '@/selections/service'
import { loadSelection } from '@/selections/board-data'
import { SelectionsNav, Flash } from '../_shared/Nav'
import { href, selectionContext, type Search } from '../_shared/ctx'
import { templatesAction } from '../v2-actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Email templates', robots: { index: false } }

const input = 'w-full border border-line bg-surface px-3 py-2 text-sm'
const FIELDS = '{player} first name · {playerFull} · {parent} parent’s first name · {program} · {ageGroup} · {trialDate} · {deadline} pay-by date · {link} payment link · {siteUrl} website'

/** The round's outcome emails, editable here (merge fields are filled per player). */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireManagement('/management/selections/messages')
  const sp = await searchParams
  const { p, program, rounds, round, age } = await selectionContext(sp)
  const data = round ? await loadSelection(p, round) : null
  const kinds = round?.kind === 'tournament' ? (['selected', 'unsuccessful'] as const) : (['successful', 'unsuccessful'] as const)
  const label = { selected: 'Selected', successful: 'Successful', unsuccessful: 'Unsuccessful' }
  return (
    <div className="space-y-6">
      <SelectionsNav active="messages" program={program} rounds={rounds} round={round} age={age} ages={data?.ages ?? []} queued={(data?.entries ?? []).filter((e) => e.outcomeQueued).length} title="Email templates" intro={<>Merge fields: {FIELDS}. The successful email always ends with a “Complete registration” button.</>} />
      <Flash done={sp.done} error={sp.error} />
      {round && (
        <form action={templatesAction} className="max-w-3xl space-y-8" aria-label="Email templates">
          <input type="hidden" name="back" value={href('/management/selections/messages', { program, round: round.id })} />
          <input type="hidden" name="round" value={round.id} />
          {/* Keep the template that isn't used by this kind of round */}
          {(['selected', 'successful', 'unsuccessful'] as const).filter((k) => !(kinds as readonly string[]).includes(k)).map((k) => {
            const t = templateFor(round, k)
            return <span key={k}><input type="hidden" name={`${k}Subject`} value={t.subject} /><input type="hidden" name={`${k}Body`} value={t.body} /><input type="hidden" name={`${k}Sms`} value={t.sms} /></span>
          })}
          {kinds.map((k) => {
            const t = templateFor(round, k)
            return (
              <fieldset key={k} className="space-y-3 border border-line p-5" data-template={k}>
                <legend className="px-1 font-display text-xl font-semibold uppercase">{label[k]}</legend>
                <label className="grid gap-1 text-sm">Subject<input name={`${k}Subject`} defaultValue={t.subject} className={input} /></label>
                <label className="grid gap-1 text-sm">Email<textarea name={`${k}Body`} defaultValue={t.body} rows={10} className={input} /></label>
                <label className="grid gap-1 text-sm">Text message (leave blank for none)<textarea name={`${k}Sms`} defaultValue={t.sms} rows={2} className={input} /></label>
              </fieldset>
            )
          })}
          <button className="min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.15em] text-black">Save templates</button>
        </form>
      )}
    </div>
  )
}
