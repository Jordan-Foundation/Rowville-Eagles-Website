import { payload, formatMoney } from '@/lib/payload'
import { programSlots } from '@/academy/terms/service'
import { slotLabel, slotSessions, yearsLabel } from '@/academy/terms/slots'
import { Bar, FilterBar, Heading, KpiTiles, selectCls, thCls } from '../_ui'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))

/** Foundation Academy term programs (and Mini Ballers, which uses the same machinery). */
export async function AcademyView({ q, type = 'academy-term', program: key = 'academy' }: { q: Record<string, string | undefined>; type?: 'academy-term' | 'toddler'; program?: string }) {
  const p = await payload()
  const { docs: programs } = await p.find({ collection: 'programs', where: { type: { equals: type } }, sort: '-startDate', limit: 30, depth: 0, overrideAccess: true })
  const program = programs.find((x) => String(x.id) === q.term) ?? programs.find((x) => x.status === 'open' || x.status === 'full') ?? programs[0]
  const title = type === 'toddler' ? 'Mini Ballers' : 'Foundation Academy'
  if (!program) return <div className="space-y-4"><Heading title={title} /><p className="text-muted">No {type === 'toddler' ? 'Mini Ballers' : 'Academy term'} programs yet — create one in the admin (Programs).</p></div>
  const [slots, { docs: regs }, { docs: coaches }] = await Promise.all([
    programSlots(p, program.id),
    p.find({ collection: 'academy-registrations', where: { program: { equals: program.id } }, limit: 5000, depth: 0, overrideAccess: true }),
    p.find({ collection: 'academy-coaches', depth: 0, limit: 200, overrideAccess: true, sort: 'displayName' }),
  ])
  const coachName = (id: number | null) => coaches.find((c) => c.id === id)?.displayName ?? '—'
  const slotFilter = q.slot ? Number(q.slot) : null
  const coachFilter = q.coach ? Number(q.coach) : null
  const slotCoaches = (s: (typeof slots)[number]) => [...new Set([...(s.coaches ?? []).map(rel), ...(s.groups ?? []).flatMap((g) => (g.coaches ?? []).map(rel))].filter((x): x is number => x != null))]
  const shown = slots.filter((s) => (!slotFilter || s.id === slotFilter) && (!coachFilter || slotCoaches(s).includes(coachFilter)))
  const shownIds = new Set(shown.map((s) => s.id))
  const inScope = regs.filter((r) => (slotFilter || coachFilter ? shownIds.has(rel(r.slot) ?? -1) : true))
  const live = inScope.filter((r) => r.status !== 'cancelled')
  const paid = live.filter((r) => r.status === 'paid')
  const unpaid = live.filter((r) => r.status === 'pending_payment' || r.status === 'offered')
  const waiting = live.filter((r) => r.status === 'interest')
  const revenue = paid.reduce((n, r) => n + (r.amount ?? 0), 0)
  const owed = unpaid.reduce((n, r) => n + (r.amount ?? 0), 0)
  const noCoach = shown.reduce((n, s) => {
    const groups = s.groups ?? []
    if (groups.length) return n + groups.filter((g) => !(g.coaches?.length) && !(s.coaches?.length)).length
    return n + (s.coaches?.length ? 0 : 1)
  }, 0)
  const capacity = shown.reduce((n, s) => n + (s.capacity ?? 0), 0)
  const toddler = type === 'toddler'
  const trials = toddler ? (await p.find({ collection: 'bookings', where: { program: { equals: program.id }, bookingType: { equals: 'trial' }, status: { equals: 'paid' } }, limit: 2000, depth: 0, overrideAccess: true, select: { sessionStart: true } })).docs : []
  const now = Date.now()
  const allSessions = shown.flatMap((s) => slotSessions(s, program).filter((x) => !x.cancelled))
  const done = allSessions.filter((x) => new Date(x.startsAt).getTime() < now).length
  const tiles: [string, string, string?][] = [
    ['Registrations', String(live.length), `${paid.length} paid · ${unpaid.length} unpaid · ${waiting.length} waiting for a place`],
    ['Paid / unpaid', `${paid.length} / ${unpaid.length}`, unpaid.length ? `${formatMoney(owed)} still to come in` : 'everyone has paid'],
    ['Places filled', capacity ? `${paid.length} / ${capacity}` : String(paid.length), capacity ? `${Math.round((paid.length / capacity) * 100)}% of capacity across ${shown.length} time${shown.length === 1 ? '' : 's'}` : 'no capacity set'],
    ['Waitlist', String(waiting.length), waiting.length ? 'offer places from Academy terms' : 'nobody waiting'],
    ['Groups without a coach', String(noCoach), noCoach ? 'set coaches on Academy terms' : 'all covered'],
    ['Net revenue', formatMoney(revenue), `${program.title}`],
    ...(toddler
      ? ([
          ['Sessions this term', String(allSessions.length), `${done} run · ${allSessions.length - done} to go`],
          ['Free trials', String(trials.length), `${trials.filter((t) => t.sessionStart && new Date(t.sessionStart).getTime() > now).length} upcoming`],
        ] as [string, string, string?][])
      : []),
  ]
  return (
    <div className="space-y-10">
      <Heading title={title} sub={`${program.title}${program.status ? ` · ${program.status}` : ''}`} links={[{ href: `/management/academy/terms?program=${program.id}`, label: 'Academy terms board' }, { href: `/programs/${program.slug}`, label: 'Public page' }]} />
      <FilterBar program={key}>
        <select name="term" defaultValue={String(program.id)} className={selectCls}>{programs.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
        <select name="slot" defaultValue={q.slot ?? ''} className={selectCls}><option value="">All training times</option>{slots.map((s) => <option key={s.id} value={s.id}>{slotLabel(s)}</option>)}</select>
        <select name="coach" defaultValue={q.coach ?? ''} className={selectCls}><option value="">All coaches</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select>
      </FilterBar>
      <KpiTiles tiles={tiles} />
      <section>
        <h3 className="font-display text-2xl font-semibold uppercase">Places by training time</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr><th className={thCls}>Training time</th><th className={thCls}>Years of birth</th><th className={`${thCls} w-64`}>Paid / capacity</th><th className={thCls}>Unpaid</th><th className={thCls}>Coaches</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((s) => {
                const r = regs.filter((x) => rel(x.slot) === s.id)
                const pd = r.filter((x) => x.status === 'paid').length
                const coachIds = slotCoaches(s)
                return (
                  <tr key={s.id}>
                    <td className="py-3 pr-4 font-medium">{slotLabel(s)}</td>
                    <td className="pr-4">{toddler ? 'Ages 2–5' : yearsLabel(s.birthYears)}</td>
                    <td className="pr-4"><Bar value={pd} max={s.capacity ?? 0} label={`${pd} of ${s.capacity ?? 'unlimited'} places paid`} /></td>
                    <td className="pr-4 tabular-nums">{r.filter((x) => x.status === 'pending_payment' || x.status === 'offered').length}</td>
                    <td className={coachIds.length ? '' : 'text-amber-300'}>{coachIds.length ? coachIds.map(coachName).join(', ') : 'No coach'}</td>
                  </tr>
                )
              })}
              {shown.length === 0 && <tr><td colSpan={5} className="py-4 text-muted">No training times match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

