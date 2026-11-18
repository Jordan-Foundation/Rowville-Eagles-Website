import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { loadAudience, matches, summarise, SOURCES, type Source } from '@/lib/audience'
import { heardFromLabel } from '@/tracking/heard'
import { groupLabel } from '@/lib/age-groups'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Audience', robots: { index: false } }

const PAGE = 50
const input = 'min-h-10 border border-line bg-surface px-2 text-sm'
const monthName = (m: string) => new Intl.DateTimeFormat('en-AU', { month: 'short', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`))

function Bars({ title, rows, href }: { title: string; rows: { label: string; count: number; key?: string }[]; href?: (key: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <section className="panel border border-line p-5" aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(8rem,12rem)_1fr_auto] items-center gap-2">
            {href && r.key ? <Link href={href(r.key)} className="truncate underline-offset-2 hover:underline">{r.label}</Link> : <span className="truncate">{r.label}</span>}
            <span className="h-2.5 rounded-r bg-[#2a78d6]" style={{ width: `${(r.count / max) * 100}%`, minWidth: 3 }} />
            <span className="tabular-nums text-muted">{r.count}</span>
          </li>
        ))}
        {!rows.length && <li className="text-muted">Nothing yet.</li>}
      </ul>
    </section>
  )
}

/** Communication → Audience: how big the audience is, where it comes from, and a search across everyone. */
export default async function AudiencePage({ searchParams }: { searchParams: Promise<{ q?: string; source?: string; opted?: string; page?: string }> }) {
  await requireManagement('/management/audience')
  const sp = await searchParams
  const all = await loadAudience(await payload())
  const s = summarise(all)
  const filters = { q: sp.q, source: sp.source && sp.source in SOURCES ? sp.source : undefined, optedIn: sp.opted === '1' }
  const found = all.filter((c) => matches(c, filters))
  const page = Math.max(1, Number(sp.page) || 1)
  const shown = found.slice((page - 1) * PAGE, page * PAGE)
  const qs = (o: Record<string, string | undefined>) => '?' + new URLSearchParams(Object.entries({ q: filters.q, source: filters.source, opted: filters.optedIn ? '1' : undefined, ...o }).filter(([, v]) => v) as [string, string][]).toString()
  const maxMonth = Math.max(1, ...s.months.map((m) => m.count))
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Audience</h1>
          <p className="mt-2 max-w-3xl text-muted">Everyone we hold contact details for — EOIs and trials, bookings, camps, Academy terms, shop orders, the Foundation+ waitlist and family accounts — one row per family. Only families who opted in can be sent marketing; everyone else only hears about what they signed up for.</p>
        </div>
        <a href="/management/audience/export" className="inline-flex min-h-10 items-center border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em]">Download opted-in (CSV)</a>
      </div>

      <dl className="panel grid grid-cols-2 gap-4 border border-line p-5 text-sm sm:grid-cols-3 lg:grid-cols-6" data-audience-kpis>
        {[['Families', s.total], ['New in 30 days', s.new30], ['Players', s.players], ['Marketing email OK', s.marketingEmail], ['Marketing texts OK', s.marketingSms], ['With an account', s.accounts]].map(([l, v]) => (
          <div key={l as string}><dt className="text-muted">{l}</dt><dd className="font-display text-2xl font-semibold tabular-nums">{v}</dd></div>
        ))}
      </dl>

      <section className="panel border border-line p-5" aria-label="New families per month">
        <h2 className="font-semibold">New families per month</h2>
        <div className="mt-4 flex h-32 items-end gap-1.5">
          {s.months.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${monthName(m.month)}: ${m.count}`}>
              <span className="text-[10px] tabular-nums text-muted">{m.count || ''}</span>
              <span className="w-full rounded-t bg-[#2a78d6]" style={{ height: `${(m.count / maxMonth) * 88}px`, minHeight: m.count ? 3 : 1, opacity: m.count ? 1 : 0.25 }} />
              <span className="text-[10px] text-muted">{monthName(m.month)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bars title="Where they came from" rows={s.sources} href={(k) => `/management/audience${qs({ source: k, page: undefined })}`} />
        <Bars title="How they heard about us" rows={s.heard} />
        <Bars title="Players by age group" rows={s.groups.slice(0, 14)} />
      </div>

      <section className="space-y-3" aria-label="Find a family">
        <form className="flex flex-wrap items-end gap-2" role="search">
          <label className="grid gap-1 text-sm">Search<input name="q" defaultValue={filters.q ?? ''} placeholder="Name, email, mobile or player" className={`${input} w-72`} /></label>
          <label className="grid gap-1 text-sm">Came from<select name="source" defaultValue={filters.source ?? ''} className={input}><option value="">Anywhere</option>{(Object.keys(SOURCES) as Source[]).map((k) => <option key={k} value={k}>{SOURCES[k]}</option>)}</select></label>
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="opted" value="1" defaultChecked={filters.optedIn} />Opted in to marketing</label>
          <button className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">Search</button>
          {(filters.q || filters.source || filters.optedIn) && <Link href="/management/audience" className="min-h-10 px-2 py-2.5 text-sm underline">Clear</Link>}
        </form>
        <p className="text-sm text-muted" data-audience-count>{found.length} famil{found.length === 1 ? 'y' : 'ies'}{found.length > PAGE ? ` · showing ${(page - 1) * PAGE + 1}–${Math.min(found.length, page * PAGE)}` : ''}</p>
        <ul className="divide-y divide-line border border-line" aria-label="Families">
          {shown.map((c) => (
            <li key={c.email} className="grid gap-2 p-4 text-sm md:grid-cols-[1.2fr_1.3fr_auto] md:items-start" data-contact={c.email}>
              <div>
                <p className="font-semibold">{c.name || c.email}</p>
                <p className="text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                {c.players.length > 0 && <p className="mt-1">{c.players.map((x) => `${x.name}${x.birthYear ? ` (${groupLabel(x.birthYear)})` : ''}`).join(', ')}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.sources.map((k) => <span key={k} className="border border-line px-2 py-0.5 text-xs">{SOURCES[k]}</span>)}
                {c.heardFrom.map((h) => <span key={h} className="px-2 py-0.5 text-xs text-muted">Heard: {heardFromLabel(h)}</span>)}
              </div>
              <div className="text-right text-xs text-muted md:min-w-40">
                <p className={c.marketingEmail || c.marketingSms ? 'font-semibold text-emerald-300' : ''}>{c.marketingEmail && c.marketingSms ? 'Marketing: email + text' : c.marketingEmail ? 'Marketing: email' : c.marketingSms ? 'Marketing: text' : 'No marketing'}</p>
                <p>First seen {formatDate(c.firstSeen, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <p>Last {formatDate(c.lastSeen, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <Link href={`/management/search?q=${encodeURIComponent(c.email)}`} className="underline">Open family</Link>
              </div>
            </li>
          ))}
          {!shown.length && <li className="p-4 text-sm text-muted">No families match.</li>}
        </ul>
        {found.length > PAGE && (
          <nav className="flex gap-3 text-sm" aria-label="Pages">
            {page > 1 && <Link href={`/management/audience${qs({ page: String(page - 1) })}`} className="underline">← Previous</Link>}
            {page * PAGE < found.length && <Link href={`/management/audience${qs({ page: String(page + 1) })}`} className="underline">Next →</Link>}
          </nav>
        )}
      </section>
    </div>
  )
}
