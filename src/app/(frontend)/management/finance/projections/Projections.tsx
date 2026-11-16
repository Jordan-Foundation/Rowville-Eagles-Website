'use client'

import { useMemo, useState, useTransition } from 'react'
import { addDays, applyScenario, headline, PROGRAM_LABEL, PROGRAMS, termTotals, totals, weekRevenue, type Baseline, type Program, type Scenario, type Week } from '@/finance/projection-calc'
import { deleteScenario, saveScenario } from './actions'

const money = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Math.round(n))
const BLUE = '#2a78d6'
const ORANGE = '#eb6834'
const input = 'min-h-9 border border-line bg-surface px-2 text-sm'

function Slider({ label, value, min, max, step = 1, suffix = '', onChange, name }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; name: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="flex justify-between gap-2"><span>{label}</span><strong className="tabular-nums">{value}{suffix}</strong></span>
      <input type="range" name={name} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </label>
  )
}

/** Weekly net result: actual weeks solid, projected weeks lighter with an outline; one hue, legend + labels. */
function Chart({ weeks, compare }: { weeks: Week[]; compare?: Week[] }) {
  const shown = weeks.slice(0, 12 + 26)
  const nets = shown.map((w) => weekRevenue(w) - w.coaching - w.expenses)
  const cmp = compare?.slice(0, shown.length).map((w) => weekRevenue(w) - w.coaching - w.expenses)
  const max = Math.max(1, ...nets.map(Math.abs), ...(cmp ?? []).map(Math.abs))
  const W = 760
  const H = 220
  const mid = H / 2
  const bw = W / shown.length
  const y = (v: number) => mid - (v / max) * (mid - 14)
  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="font-semibold text-ink">Weekly net result (revenue − coaching − expenses)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BLUE }} />Actual</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ borderColor: BLUE, background: `${BLUE}55` }} />Projected</span>
        {cmp && <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: ORANGE }} />Baseline</span>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-auto w-full" role="img" aria-label="Weekly net result, actual and projected">
        <line x1={0} x2={W} y1={mid} y2={mid} stroke="currentColor" strokeOpacity={0.25} />
        {shown.map((w, i) => {
          const v = nets[i]
          const top = Math.min(y(v), mid)
          const h = Math.max(1, Math.abs(y(v) - mid))
          return (
            <g key={w.week}>
              <rect x={i * bw + 1} y={top} width={Math.max(1, bw - 2)} height={h} rx={2} fill={w.actual ? BLUE : `${BLUE}55`} stroke={w.actual ? 'none' : BLUE} strokeWidth={w.actual ? 0 : 1}>
                <title>{`Week of ${w.week}${w.actual ? ' (actual)' : ' (projected)'}: ${money(v)} — revenue ${money(weekRevenue(w))}, coaching ${money(w.coaching)}, expenses ${money(w.expenses)}`}</title>
              </rect>
              {i % 4 === 0 && <text x={i * bw + bw / 2} y={H + 14} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.6}>{w.week.slice(5)}</text>}
            </g>
          )
        })}
        {cmp && <polyline fill="none" stroke={ORANGE} strokeWidth={2} points={cmp.map((v, i) => `${i * bw + bw / 2},${y(v)}`).join(' ')} />}
        <text x={4} y={12} fontSize={10} fill="currentColor" opacity={0.6}>{money(max)}</text>
        <text x={4} y={H - 4} fontSize={10} fill="currentColor" opacity={0.6}>−{money(max)}</text>
      </svg>
    </figure>
  )
}

export function Projections({ baseline, saved }: { baseline: Baseline; saved: { id: number; name: string; inputs: Scenario }[] }) {
  const [s, setS] = useState<Scenario>({ academyPlayers: baseline.academyPlayers, priceChange: {}, extraHoursPerWeek: 0, campAttendancePct: 100, oneOff: null })
  const [oneOffAmount, setOneOffAmount] = useState(0)
  const [oneOffDate, setOneOffDate] = useState(addDays(baseline.today, 30))
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const scenario: Scenario = { ...s, oneOff: oneOffAmount > 0 ? { amount: oneOffAmount, date: oneOffDate } : null }
  const weeks = useMemo(() => applyScenario(baseline, scenario), [baseline, JSON.stringify(scenario)]) // eslint-disable-line react-hooks/exhaustive-deps
  const changed = JSON.stringify(weeks) !== JSON.stringify(baseline.weeks)
  const from = baseline.weeks.find((w) => !w.actual)?.week ?? baseline.today
  const card = (label: string, until: string) => ({ label, cur: totals(weeks, from, until), base: totals(baseline.weeks, from, until) })
  const cards = [card('next 3 months', addDays(from, 91)), card('next 6 months', addDays(from, 182)), card('next 12 months', addDays(from, 364))]
  const term = termTotals(weeks, baseline)
  const termBase = termTotals(baseline.weeks, baseline)
  const byProgram = PROGRAMS.map((k) => ({ k, v: weeks.filter((w) => !w.actual && w.week < addDays(from, 91)).reduce((n, w) => n + w.revenue[k], 0) }))
  const setPrice = (k: Program, v: number) => setS({ ...s, priceChange: { ...s.priceChange, [k]: v } })
  const load = (inputs: Scenario) => { setS({ academyPlayers: inputs.academyPlayers ?? baseline.academyPlayers, priceChange: inputs.priceChange ?? {}, extraHoursPerWeek: inputs.extraHoursPerWeek ?? 0, campAttendancePct: inputs.campAttendancePct ?? 100 }); setOneOffAmount(inputs.oneOff?.amount ?? 0); if (inputs.oneOff?.date) setOneOffDate(inputs.oneOff.date) }
  const reset = () => load({})

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-proj-cards>
        {term && (
          <div className="panel border border-line p-4">
            <p className="text-xs text-muted">{term.name}</p>
            <p className="mt-1 font-semibold" data-headline>{headline(term, 'this term')}</p>
            <p className="mt-1 text-xs text-muted">Revenue {money(term.revenue)} · costs {money(term.costs)}{changed && termBase ? ` · baseline ${money(termBase.profit)}` : ''}</p>
          </div>
        )}
        {cards.map((c) => (
          <div key={c.label} className="panel border border-line p-4">
            <p className="text-xs text-muted">Profit, {c.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{money(c.cur.profit)}</p>
            <p className="text-xs text-muted">Revenue {money(c.cur.revenue)} · costs {money(c.cur.costs)}{changed ? ` · baseline ${money(c.base.profit)}` : ''}</p>
          </div>
        ))}
      </div>

      <div className="panel border border-line p-5"><Chart weeks={weeks} compare={changed ? baseline.weeks : undefined} /></div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel space-y-4 border border-line p-5" aria-label="What if">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">What if…</h2><button type="button" onClick={reset} className="text-xs underline">Back to baseline</button></div>
          <Slider name="academyPlayers" label="Academy players per term" value={s.academyPlayers ?? baseline.academyPlayers} min={0} max={Math.max(50, baseline.academyPlayers * 3)} onChange={(v) => setS({ ...s, academyPlayers: v })} />
          <Slider name="extraHours" label="Extra coaching hours per week" value={s.extraHoursPerWeek ?? 0} min={0} max={40} onChange={(v) => setS({ ...s, extraHoursPerWeek: v })} suffix="h" />
          <Slider name="campAttendance" label="Camp attendance (vs expected)" value={s.campAttendancePct ?? 100} min={0} max={200} step={5} onChange={(v) => setS({ ...s, campAttendancePct: v })} suffix="%" />
          <details>
            <summary className="cursor-pointer text-sm font-semibold">Price change per program</summary>
            <div className="mt-3 space-y-3">{PROGRAMS.map((k) => <Slider key={k} name={`price-${k}`} label={PROGRAM_LABEL[k]} value={s.priceChange?.[k] ?? 0} min={-30} max={50} onChange={(v) => setPrice(k, v)} suffix="%" />)}</div>
          </details>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="grid gap-1">One-off purchase ($)<input type="number" min={0} step={50} value={oneOffAmount || ''} onChange={(e) => setOneOffAmount(Number(e.target.value) || 0)} className={`${input} w-32`} placeholder="e.g. 2500" /></label>
            <label className="grid gap-1">on<input type="date" value={oneOffDate} onChange={(e) => setOneOffDate(e.target.value)} className={input} /></label>
          </div>
          <p className="text-xs text-muted">Nothing here changes real data — it only recalculates the projection.</p>
          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4 text-sm">
            <label className="grid gap-1">Save as<input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="e.g. 60 players + new goals" /></label>
            <button type="button" disabled={pending || !name.trim()} onClick={() => start(async () => { const r = await saveScenario(name, scenario); setMsg('error' in r && r.error ? r.error : 'Scenario saved.'); if (!('error' in r)) setName('') })} className="min-h-9 border border-line px-3 text-xs font-semibold uppercase disabled:opacity-50">Save scenario</button>
            {msg && <span role="status" className="text-xs">{msg}</span>}
          </div>
          {saved.length > 0 && (
            <ul className="divide-y divide-line text-sm" aria-label="Saved scenarios">{saved.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{x.name}</span><span className="flex gap-3"><button type="button" onClick={() => load(x.inputs)} className="text-xs underline">Load &amp; compare</button><button type="button" onClick={() => start(async () => { await deleteScenario(x.id) })} className="text-xs underline">Delete</button></span></li>
            ))}</ul>
          )}
        </section>
        <section className="panel space-y-3 border border-line p-5 text-sm" aria-label="By program">
          <h2 className="font-semibold">Projected revenue by program — next 3 months</h2>
          <ul className="space-y-2">{byProgram.map(({ k, v }) => {
            const max = Math.max(1, ...byProgram.map((x) => x.v))
            return <li key={k} className="grid grid-cols-[9rem_1fr_auto] items-center gap-2"><span>{PROGRAM_LABEL[k]}</span><span className="h-3 rounded-r" style={{ width: `${(v / max) * 100}%`, minWidth: v ? 4 : 0, background: BLUE }} /><span className="tabular-nums text-muted">{money(v)}</span></li>
          })}</ul>
          <p className="text-xs text-muted">Known income (already booked or paid: scheduled sessions, term registrations, camp places) plus recent trends for the rest — about {money(weeks.filter((w) => !w.actual && w.week < addDays(from, 91)).reduce((n, w) => n + w.known, 0))} of the next 3 months is already booked. Costs use each coach’s current rate, scheduled sessions with setup/pack-up and super, and recurring + average expenses.</p>
        </section>
      </div>
    </div>
  )
}
