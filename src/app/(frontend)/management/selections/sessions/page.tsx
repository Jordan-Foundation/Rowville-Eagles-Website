import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { formatDate } from '@/lib/format'
import { getAgeRules } from '@/lib/age-rules'
import { groupInfo, groupLabel } from '@/lib/age-groups'
import { loadSelection } from '@/selections/board-data'
import { isTrialist } from '@/selections/flow'
import { SelectionsNav, Flash } from '../_shared/Nav'
import { href, selectionContext, type Search } from '../_shared/ctx'
import { trialSessionAction } from '../v2-actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Trial sessions', robots: { index: false } }

const input = 'min-h-10 border border-line bg-surface px-2 text-sm'

/** Trial sessions for the program: add one, see who's invited, and open the attendance tick list on the day. */
export default async function SessionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireManagement('/management/selections/sessions')
  const sp = await searchParams
  const { p, program, rounds, round, age } = await selectionContext(sp)
  const rules = await getAgeRules(p)
  const data = round ? await loadSelection(p, round) : null
  const { docs: sessions } = await p.find({ collection: 'trial-sessions', where: { or: [{ program: { equals: program } }, ...(program === 'eagles' ? [{ program: { exists: false } }] : [])] }, sort: '-start', limit: 300, depth: 0, overrideAccess: true, pagination: false })
  const { docs: invites } = sessions.length ? await p.find({ collection: 'trial-invites', where: { session: { in: sessions.map((s) => s.id) } }, limit: 20000, depth: 0, overrideAccess: true, pagination: false, select: { session: true, attended: true } }) : { docs: [] }
  const count = (id: number, attended?: boolean) => invites.filter((i) => (typeof i.session === 'object' ? i.session.id : i.session) === id && (attended === undefined || Boolean(i.attended) === attended)).length
  const list = sessions.filter((s) => !age || (s.birthYears ?? []).includes(age))
  // Age groups to offer: MiniRoos up to juniors for this season
  const years = Array.from({ length: 14 }, (_, i) => rules.season - rules.miniMin - i).filter((y) => groupInfo(y, rules).kind !== 'too-young')
  const back = href('/management/selections/sessions', { program, round: round?.id, age })
  return (
    <div className="space-y-8">
      <SelectionsNav active="sessions" program={program} rounds={rounds} round={round} age={age} ages={years} queued={(data?.entries ?? []).filter((e) => e.outcomeQueued).length} title="Trial sessions" intro="Add trials, see who’s invited, and tick attendance on the day (works on a phone)." />
      <Flash done={sp.done} error={sp.error} />
      <ul className="divide-y divide-line border border-line" aria-label="Trial sessions">
        {list.map((s) => {
          const past = new Date(s.start).getTime() < Date.now()
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm" data-session={s.id}>
              <span>
                <strong>{formatDate(s.start, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</strong>
                <span className="block text-muted">{s.title} · {(s.birthYears ?? []).map((y) => groupLabel(y)).join(', ')} · {s.location || '208 Dandelion Drive, Rowville'}{s.status === 'published' ? ' · open for bookings' : s.status === 'draft' ? ' · invite only' : ' · closed'}</span>
              </span>
              <span className="flex items-center gap-4">
                <span className="text-muted">{count(s.id)} invited · {count(s.id, true)} attended</span>
                <Link href={href(`/management/selections/sessions/${s.id}`, { program, round: round?.id })} className="min-h-10 border border-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]">{past ? 'Attendance' : 'Invited & attendance'}</Link>
                <a href={`/selections/sheet/${s.id}?back=${encodeURIComponent(back)}`} data-print-sheet className="min-h-10 border border-line px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Print sheet</a>
              </span>
            </li>
          )
        })}
        {list.length === 0 && <li className="p-4 text-muted">No trial sessions yet.</li>}
      </ul>

      <form action={trialSessionAction} className="panel max-w-3xl space-y-4 border border-line p-5" aria-label="Add a trial session">
        <h2 className="font-display text-2xl font-semibold uppercase">Add a trial session</h2>
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="program" value={program} />
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-sm">Date<input type="date" name="date" required className={input} /></label>
          <label className="grid gap-1 text-sm">Start<input type="time" name="start" required className={input} /></label>
          <label className="grid gap-1 text-sm">End<input type="time" name="end" className={input} /></label>
          <label className="grid flex-1 gap-1 text-sm">Venue<input name="location" defaultValue="208 Dandelion Drive, Rowville" className={input} /></label>
        </div>
        <fieldset className="text-sm">
          <legend className="mb-1">Age groups</legend>
          <div className="flex flex-wrap gap-3">
            {years.map((y) => <label key={y} className="flex items-center gap-1.5"><input type="checkbox" name="years" value={y} defaultChecked={age === y} /> {groupLabel(y)} <span className="text-xs text-muted">({groupInfo(y, rules).hint})</span></label>)}
          </div>
        </fieldset>
        <label className="grid gap-1 text-sm">Name (optional)<input name="title" placeholder="e.g. Second-chance trial" className={input} /></label>
        <label className="grid gap-1 text-sm">What to bring<textarea name="whatToBring" rows={2} defaultValue="Boots, shin pads, water bottle and a ball if you have one. Please arrive 10 minutes early." className={input} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="publish" className="mt-1" /> <span>Open for bookings on the website now — this emails every family waiting for trial dates in these age groups. Leave unticked to invite players yourself from the Trialists page.</span></label>
        <button className="min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.15em] text-black">Add trial</button>
      </form>
      {data && <p className="text-sm text-muted">{data.entries.filter(isTrialist).length} trialists in {round?.title}.</p>}
    </div>
  )
}
