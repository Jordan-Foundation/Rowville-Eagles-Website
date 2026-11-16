import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { localYmd } from '@/lib/time'
import { aiConfigured } from '@/reflections/ai'
import { defaultRange, loadDashboard } from '@/reflections/dashboard'
import { PillarBars, PillarTrends, WeekBars } from '@/reflections/Charts'
import { PlayerHistory } from '@/reflections/PlayerHistory'
import { ReportView } from '@/reflections/ReportView'
import { reportPeriod, weekKey } from '@/reflections/rules'
import { pillars, reflectionSettings, reflectionTeams, relId } from '@/reflections/service'
import { regenerateReport, reviewFlag, saveSettings } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Match reflections', robots: { index: false } }

type SP = { tab?: string; from?: string; to?: string; age?: string; team?: string; player?: string; report?: string; week?: string; done?: string; error?: string }
const btn = 'min-h-9 border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em]'
const input = 'min-h-9 border border-line bg-surface px-2 text-sm'
const ymd = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined)
const pct = (v: number | null) => (v == null ? '–' : `${Math.round(v * 100)}%`)
const name = (v: unknown) => (v && typeof v === 'object' ? `${(v as { firstName?: string }).firstName ?? ''} ${(v as { lastName?: string }).lastName ?? ''}`.trim() : '—')

/** Management: overview with filters and charts, players, welfare queue, weekend reports and settings. */
export default async function ReflectionsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await requireManagement('/management/reflections')
  const sp = await searchParams
  const p = await payload()
  const tab = (['overview', 'players', 'welfare', 'reports', 'settings'] as const).find((t) => t === sp.tab) ?? 'overview'
  const openFlags = (await p.count({ collection: 'welfare-flags', where: { status: { equals: 'open' } }, overrideAccess: true })).totalDocs
  const tabCls = (on: boolean) => `min-h-10 border px-3 py-2 text-sm ${on ? 'border-white bg-white text-black' : 'border-line text-muted hover:text-ink'}`
  const range = defaultRange()
  const f = { from: ymd(sp.from) ?? range.from, to: ymd(sp.to) ?? range.to, ageGroup: sp.age || undefined, team: Number(sp.team) || undefined, player: Number(sp.player) || undefined }

  let body: React.ReactNode
  if (tab === 'overview' || tab === 'players') {
    const d = await loadDashboard(p, f)
    const filters = (
      <form className="flex flex-wrap items-end gap-3 text-sm" aria-label="Filters">
        <input type="hidden" name="tab" value={tab} />
        <label className="grid gap-1">From<input type="date" name="from" defaultValue={f.from} className={input} /></label>
        <label className="grid gap-1">To<input type="date" name="to" defaultValue={f.to} className={input} /></label>
        <label className="grid gap-1">Age group<select name="age" defaultValue={f.ageGroup ?? ''} className={input}><option value="">All</option>{d.ageGroups.map((a) => <option key={a}>{a}</option>)}</select></label>
        <label className="grid gap-1">Team<select name="team" defaultValue={f.team ?? ''} className={input}><option value="">All</option>{d.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        {f.player && <input type="hidden" name="player" value={f.player} />}
        <button className={btn}>Apply</button>
        <Link href={`/management/reflections?tab=${tab}`} className="text-xs underline">Reset</Link>
      </form>
    )
    if (tab === 'overview') {
      body = (
        <div className="space-y-8">
          {filters}
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi label="Reflections" value={`${d.stats.submitted}`} sub={`of ${d.stats.expected} possible`} />
            <Kpi label="Completion" value={pct(d.stats.completionRate)} />
            <Kpi label="Average feeling" value={d.stats.feelingAverage == null ? '–' : `${d.stats.feelingAverage} / 5`} sub={`${d.stats.feelingCount} answered`} />
            <Kpi label="Open welfare flags" value={String(openFlags)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="panel border border-line p-5"><PillarBars pillars={d.stats.pillars} caption="Strengths vs things to work on, by pillar" /></div>
            <div className="panel space-y-6 border border-line p-5">
              <WeekBars caption="Completion rate by week" rows={d.weekly.map((w) => ({ week: w.week, value: w.expected ? w.submitted / w.expected : null }))} max={1} format={(v) => `${Math.round(v * 100)}%`} />
              <WeekBars caption="Average feeling by week (1–5)" rows={d.weekly.map((w) => ({ week: w.week, value: w.feeling }))} max={5} format={(v) => v.toFixed(1)} />
            </div>
          </div>
          <section className="panel border border-line p-5">
            <h2 className="mb-3 font-semibold">Pillar trends by week</h2>
            <PillarTrends weeks={d.weeks} series={d.trends} />
          </section>
          <details className="panel border border-line p-5">
            <summary className="cursor-pointer font-semibold">Data table</summary>
            <table className="mt-3 w-full text-sm"><thead><tr className="text-left text-muted"><th>Week of</th><th>Reflections</th><th>Possible</th><th>Avg feeling</th></tr></thead>
              <tbody>{d.weekly.map((w) => <tr key={w.week} className="border-t border-line"><td>{w.week}</td><td>{w.submitted}</td><td>{w.expected}</td><td>{w.feeling ?? '–'}</td></tr>)}</tbody></table>
          </details>
        </div>
      )
    } else {
      // Players: everyone with a reflection in range, with counts; or one player's page
      if (f.player) {
        const kid = await p.findByID({ collection: 'participants', id: f.player, depth: 0, overrideAccess: true, disableErrors: true })
        body = kid ? (
          <div className="space-y-6">
            <Link href={`/management/reflections?tab=players&from=${f.from}&to=${f.to}`} className="text-sm underline">← All players</Link>
            <h2 className="font-display text-3xl font-bold uppercase">{kid.firstName} {kid.lastName}</h2>
            <PlayerHistory p={p} participantId={kid.id} family={false} />
          </div>
        ) : <p>Player not found.</p>
      } else {
        const rows = new Map<number, { name: string; team: string; submitted: number; drafts: number; feeling: number[] }>()
        for (const r of d.reflections) {
          const id = relId(r.participant) as number
          const row = rows.get(id) ?? { name: name(r.participant), team: typeof r.team === 'object' && r.team ? r.team.name : '', submitted: 0, drafts: 0, feeling: [] }
          if (r.status === 'submitted') { row.submitted++; if (r.feeling) row.feeling.push(r.feeling) } else row.drafts++
          rows.set(id, row)
        }
        body = (
          <div className="space-y-6">
            {filters}
            <ul className="panel divide-y divide-line border border-line">
              {[...rows].sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, r]) => (
                <li key={id}><Link href={`/management/reflections?tab=players&player=${id}&from=${f.from}&to=${f.to}`} className="flex flex-wrap justify-between gap-3 p-4 text-sm hover:bg-white/5" data-player-row>
                  <span><strong>{r.name}</strong> <span className="text-muted">· {r.team}</span></span>
                  <span className="text-muted">{r.submitted} reflected{r.drafts ? ` · ${r.drafts} draft` : ''}{r.feeling.length ? ` · feeling ${(r.feeling.reduce((a, b) => a + b, 0) / r.feeling.length).toFixed(1)}` : ''}</span>
                </Link></li>
              ))}
              {!rows.size && <li className="p-4 text-sm text-muted">No reflections in this range.</li>}
            </ul>
          </div>
        )
      }
    }
  } else if (tab === 'welfare') {
    const { docs } = await p.find({ collection: 'welfare-flags', sort: '-createdAt', limit: 200, depth: 1, pagination: false, overrideAccess: true })
    const ordered = [...docs].sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open'))
    body = (
      <div className="space-y-4">
        <p className="text-sm text-muted">Every flag is emailed to the safeguarding contact the moment it’s raised. Follow the club’s safeguarding procedure, then record what was done here. Flags are never only mentioned in the AI report.</p>
        {ordered.map((x) => (
          <article key={x.id} className={`panel border p-5 ${x.status === 'open' ? 'border-red-500/60' : 'border-line'}`} data-flag={x.id}>
            <p className="flex flex-wrap justify-between gap-2 text-sm"><strong>{name(x.participant)} · {typeof x.team === 'object' && x.team ? x.team.name : ''}</strong><span className="text-muted">{x.source === 'ai' ? 'AI check' : 'Keyword'} · {x.severity} · {formatDate(x.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{x.notifiedAt ? ' · emailed' : ' · email not sent'}</span></p>
            <p className="mt-2 text-sm">{x.reason}</p>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-surface-2 p-3 text-sm">{x.excerpt}</pre>
            {x.status === 'open' ? (
              <form action={reviewFlag} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={x.id} />
                <label className="grid flex-1 gap-1 text-sm">What was done<input name="notes" className={input} required placeholder="e.g. Spoke with parent on Monday — no concern" /></label>
                <button className={btn}>Mark reviewed</button>
              </form>
            ) : <p className="mt-3 text-sm text-muted">Reviewed by {name(x.reviewedBy)}{x.reviewedAt ? ` on ${formatDate(x.reviewedAt, { day: 'numeric', month: 'short' })}` : ''}: {x.notes}</p>}
          </article>
        ))}
        {!docs.length && <p className="text-sm text-muted">No welfare flags.</p>}
      </div>
    )
  } else if (tab === 'reports') {
    if (sp.report) {
      const r = await p.findByID({ collection: 'reflection-reports', id: Number(sp.report), depth: 0, overrideAccess: true, disableErrors: true })
      body = r ? <div className="space-y-6"><Link href={`/management/reflections?tab=reports&week=${r.periodFrom}`} className="text-sm underline">← Reports</Link><ReportView r={r} />
        <form action={regenerateReport}><input type="hidden" name="from" value={r.periodFrom} /><input type="hidden" name="scopeType" value={r.scopeType} /><input type="hidden" name="scopeKey" value={r.scopeKey} /><button className={btn}>Regenerate this report</button></form></div> : <p>Report not found.</p>
    } else {
      const thisWeek = reportPeriod(localYmd(new Date())).from
      const mondays = Array.from({ length: 11 }, (_, i) => { const d = new Date(`${weekKey(thisWeek)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 7 * (i - 1)); return d.toISOString().slice(0, 10) })
      const week = ymd(sp.week)
      const { docs } = await p.find({ collection: 'reflection-reports', where: week ? { periodFrom: { equals: week } } : {}, sort: '-periodFrom', limit: 100, depth: 0, pagination: false, overrideAccess: true })
      const order = { club: 0, age_group: 1, team: 2 } as const
      body = (
        <div className="space-y-6">
          {!aiConfigured() && <p className="rounded-xl border border-amber-400/60 bg-amber-400/10 px-4 py-3 text-sm">The AI summary needs <code>ANTHROPIC_API_KEY</code> set in Vercel. Until then reports contain the numbers only.</p>}
          <form action={regenerateReport} className="flex flex-wrap items-end gap-3 text-sm">
            <label className="grid gap-1">Week starting<select name="from" defaultValue={week ?? mondays[1]} className={input}>{mondays.map((m) => <option key={m} value={m}>{formatDate(`${m}T02:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}</select></label>
            <label className="flex items-center gap-2"><input type="checkbox" name="notify" /> Email coaches & Management</label>
            <button className={btn}>Build reports now</button>
          </form>
          <ul className="panel divide-y divide-line border border-line">
            {[...docs].sort((a, b) => b.periodFrom.localeCompare(a.periodFrom) || order[a.scopeType] - order[b.scopeType] || String(a.scopeLabel).localeCompare(String(b.scopeLabel))).map((r) => (
              <li key={r.id}><Link href={`/management/reflections?tab=reports&report=${r.id}`} className="flex flex-wrap justify-between gap-3 p-4 text-sm hover:bg-white/5" data-report-row={r.scopeType}>
                <span><strong>{r.scopeLabel}</strong> <span className="text-muted">· week of {r.periodFrom}</span></span>
                <span className="text-muted">{({ ok: 'Ready', failed: 'Numbers only — AI failed', stats_only: 'Numbers only', empty: 'Too few reflections' } as Record<string, string>)[r.status]}</span>
              </Link></li>
            ))}
            {!docs.length && <li className="p-4 text-sm text-muted">No reports yet. They’re built automatically once each week’s reflection deadline has passed, or use “Build reports now”.</li>}
          </ul>
        </div>
      )
    }
  } else {
    const s = await reflectionSettings(p)
    const [list, { docs: rowville }] = await Promise.all([pillars(p, true), p.find({ collection: 'teams', where: { type: { equals: 'rowville' }, archived: { not_equals: true } }, depth: 0, limit: 200, pagination: false, overrideAccess: true, sort: 'name' })])
    const using = (await reflectionTeams(p, s)).length
    body = (
      <form action={saveSettings} className="max-w-3xl space-y-8 text-sm">
        <fieldset className="space-y-3">
          <legend className="font-semibold">General</legend>
          <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={s.enabled} /> Match Reflections are on</label>
          <div className="flex flex-wrap gap-4">
            <label className="grid gap-1">Opens (hours after kick-off)<input type="number" name="opensAfterHours" min={0} max={48} defaultValue={s.window.opensAfterHours} className={input} /></label>
            <label className="grid gap-1">Closes (days after kick-off, or next game if sooner)<input type="number" name="closesAfterDays" min={1} max={14} defaultValue={s.window.closesAfterDays} className={input} /></label>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" name="remindOnOpen" defaultChecked={s.remindOnOpen} /> Email families when it opens</label>
          <label className="grid max-w-xs gap-1">Reminder before it closes (hours, 0 = off)<input type="number" name="closingReminderHours" min={0} max={96} defaultValue={s.closingReminderHours} className={input} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="showStreak" defaultChecked={s.showStreak} /> Show streaks to players</label>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-semibold">Teams ({s.teams.length ? `${using} chosen` : `all ${using} Rowville club teams`})</legend>
          <p className="text-muted">Tick teams to limit reflections to them. Leave all unticked for every Rowville club team.</p>
          <div className="grid gap-1 sm:grid-cols-2">{rowville.map((t) => <label key={t.id} className="flex items-center gap-2"><input type="checkbox" name="teams" value={t.id} defaultChecked={s.teams.includes(t.id)} /> {t.name}</label>)}</div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-semibold">Pillars</legend>
          {list.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center gap-2">
              <input name={`pillar-${x.id}-order`} type="number" defaultValue={x.sortOrder ?? 0} className={`${input} w-16`} aria-label="Order" />
              <input name={`pillar-${x.id}-name`} defaultValue={x.name} className={input} aria-label="Name" />
              <input name={`pillar-${x.id}-hint`} defaultValue={x.hint ?? ''} className={`${input} flex-1`} aria-label="Hint" placeholder="Hint shown to players" />
              <label className="flex items-center gap-1"><input type="checkbox" name={`pillar-${x.id}-active`} defaultChecked={x.active !== false} /> On</label>
            </div>
          ))}
          <label className="grid max-w-xs gap-1">Add a pillar<input name="newPillar" className={input} placeholder="e.g. Defending" /></label>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-semibold">Weekend AI report</legend>
          <label className="flex items-center gap-2"><input type="checkbox" name="aiReports" defaultChecked={s.aiReports} /> Build an AI summary each week (numbers are always counted)</label>
          <p className="text-muted">Each report is built and emailed automatically once the reflection deadline has passed for every game that week — a team’s report when its games close, the age-group and club reports when all their teams’ games have closed.</p>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-semibold">Safeguarding</legend>
          <label className="grid max-w-md gap-1">Safeguarding contact email<input type="email" name="safeguardingEmail" defaultValue={s.safeguardingEmail ?? ''} className={input} placeholder="Falls back to the club’s contact email" /></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="aiWelfareCheck" defaultChecked={s.aiWelfareCheck} /> AI check on every reflection (anonymised), as well as keywords</label>
          <label className="grid gap-1">Keywords (one per line — a match always alerts the contact)<textarea name="keywords" rows={8} defaultValue={s.keywords} className={`${input} py-2`} /></label>
        </fieldset>
        <button className={btn}>Save settings</button>
      </form>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Match reflections</h1>
        <p className="mt-3 max-w-3xl text-muted">Players reflect after each game: 3 things that went well, 3 to work on, and a focus. Families see their own, coaches see their teams, Management sees everything.</p>
      </div>
      {sp.done && <p role="status" className="border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm">{sp.error}</p>}
      <nav className="flex flex-wrap gap-2" aria-label="Sections">
        {([['overview', 'Overview'], ['players', 'Players'], ['welfare', `Welfare${openFlags ? ` (${openFlags})` : ''}`], ['reports', 'Reports'], ['settings', 'Settings']] as const).map(([k, l]) => <Link key={k} href={`/management/reflections?tab=${k}`} className={tabCls(tab === k)}>{l}</Link>)}
      </nav>
      {body}
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="panel border border-line p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
}
