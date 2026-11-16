import type { ReflectionReport } from '@/payload-types'
import { formatDate } from '@/lib/payload'
import { PillarBars } from './Charts'
import type { ReportSummary } from './ai'
import type { ReportStats } from './reports'

const pct = (v: number | null | undefined) => (v == null ? '–' : `${Math.round(v * 100)}%`)

/** One weekend report: exact numbers from the database, then the AI's summary of the (anonymous) comments. */
export function ReportView({ r }: { r: ReflectionReport }) {
  const st = r.stats as unknown as ReportStats | null
  const sm = r.summary as unknown as ReportSummary | null
  return (
    <article className="space-y-6" data-report={r.id}>
      <header>
        <p className="text-sm text-muted">Week of {r.periodFrom}</p>
        <h2 className="font-display text-2xl font-bold uppercase">{r.scopeLabel}</h2>
      </header>
      {st && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Games" value={String(st.games)} />
          <Kpi label="Reflections" value={`${st.submitted} / ${st.expected}`} />
          <Kpi label="Completion" value={pct(st.completionRate)} />
          <Kpi label="Average feeling" value={st.feelingAverage == null ? '–' : `${st.feelingAverage} / 5`} />
        </div>
      )}
      {st && st.submitted > 0 && <div className="rounded-2xl border border-line p-5"><PillarBars pillars={st.pillars} caption="By skill area" /></div>}
      {r.status === 'empty' && <p className="text-sm text-muted">Fewer than 3 reflections — no written summary (too few to stay anonymous).</p>}
      {(r.status === 'failed' || r.status === 'stats_only') && <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">Numbers only{r.error ? ` — ${r.error}` : ''}.</p>}
      {sm && (
        <div className="space-y-5">
          <p className="text-lg font-semibold" data-headline>{sm.headline}</p>
          <Themes title="What went well" items={sm.strength_themes} />
          <Themes title="What players want to work on" items={sm.improvement_themes} />
          {sm.focus_themes.length > 0 && <section><h3 className="font-semibold">Focus for next game</h3><ul className="mt-1 list-disc pl-5 text-sm">{sm.focus_themes.map((f, i) => <li key={i}>{f.theme} <span className="text-muted">({f.players} player{f.players === 1 ? '' : 's'})</span></li>)}</ul></section>}
          {sm.coach_suggestions.length > 0 && <section><h3 className="font-semibold">Ideas for training</h3><ul className="mt-1 list-disc pl-5 text-sm">{sm.coach_suggestions.map((c, i) => <li key={i}>{c}</li>)}</ul></section>}
          {sm.notable_examples.length > 0 && <section><h3 className="font-semibold">In their words</h3><ul className="mt-1 space-y-1 text-sm">{sm.notable_examples.map((e, i) => <li key={i}>“{e.quote}” <span className="text-muted">— {e.player} · {e.why}</span></li>)}</ul></section>}
        </div>
      )}
      <p className="text-xs text-muted">
        Numbers are counted exactly. The written summary is AI-generated from anonymous comments (no names are sent) and describes themes only — it isn’t a judgement of any player. Welfare concerns are never left to this report: they go straight to the safeguarding contact.
        {r.generatedAt ? ` Generated ${formatDate(r.generatedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}{r.model ? ` · ${r.model}` : ''}{r.promptVersion ? ` · ${r.promptVersion}` : ''}.
      </p>
    </article>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>
}

function Themes({ title, items }: { title: string; items: ReportSummary['strength_themes'] }) {
  if (!items.length) return null
  return (
    <section>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-1 space-y-1 text-sm">{items.map((t, i) => <li key={i}><span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold">{t.pillar}</span> {t.theme} <span className="text-muted">({t.players} player{t.players === 1 ? '' : 's'})</span></li>)}</ul>
    </section>
  )
}
