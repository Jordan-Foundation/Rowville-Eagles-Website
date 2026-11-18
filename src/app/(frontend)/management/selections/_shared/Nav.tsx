import Link from 'next/link'
import type { SelectionRound } from '@/payload-types'
import { groupLabel } from '@/lib/age-groups'
import { PROGRAMS, type ProgramKey } from '@/selections/flow'
import { href } from './ctx'

const TABS = [
  { key: 'trialists', label: 'Trialists' },
  { key: 'selected', label: 'Selected' },
  { key: 'sessions', label: 'Trial sessions' },
  { key: 'unsuccessful', label: 'Unsuccessful' },
  { key: 'outcomes', label: 'Send outcome emails' },
  { key: 'messages', label: 'Email templates' },
] as const

/**
 * Header for every selections page: program (Eagles / RFA), round, age group filter and the section tabs.
 * `extra` adds page-specific fields to the same filter form (kept as plain GET so it works without JavaScript).
 */
export function SelectionsNav({ active, program, rounds, round, age, ages, queued, extra, title, intro }: {
  active: (typeof TABS)[number]['key']
  program: ProgramKey
  rounds: SelectionRound[]
  round: SelectionRound | null
  age: number | null
  ages: number[]
  queued?: number
  extra?: React.ReactNode
  title: string
  intro?: React.ReactNode
}) {
  const keep = { program, round: round?.id }
  const sel = 'min-h-10 border border-line bg-surface px-2 text-sm'
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">{title}</h1>
        {intro && <p className="mt-2 max-w-3xl text-muted">{intro}</p>}
      </div>
      <nav aria-label="Program" className="flex flex-wrap gap-2 text-sm">
        {PROGRAMS.map((p) => (
          <Link key={p.key} href={href(`/management/selections/${active}`, { program: p.key })} aria-current={p.key === program ? 'page' : undefined} className={`border px-3 py-1.5 ${p.key === program ? 'border-white text-ink' : 'border-line text-muted hover:text-ink'}`} data-program={p.key}>
            {p.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Selections" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-line text-sm">
        {TABS.map((t) => (
          <Link key={t.key} href={href(`/management/selections/${t.key}`, { ...keep, age })} aria-current={t.key === active ? 'page' : undefined} className={`-mb-px border-b-2 pb-2 ${t.key === active ? 'border-white font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
            {t.label}
            {t.key === 'outcomes' && queued ? <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-xs font-bold text-black" data-queued={queued}>{queued}</span> : null}
          </Link>
        ))}
      </nav>
      <form className="flex flex-wrap items-end gap-3" aria-label="Filters">
        <input type="hidden" name="program" value={program} />
        {rounds.length > 1 && (
          <label className="grid gap-1 text-xs text-muted">{program === 'rfa' ? 'Tournament' : 'Season'}
            <select name="round" defaultValue={round?.id} className={sel}>{rounds.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
          </label>
        )}
        {rounds.length === 1 && <input type="hidden" name="round" value={rounds[0].id} />}
        <label className="grid gap-1 text-xs text-muted">Age group
          <select name="age" defaultValue={age ?? ''} className={sel} aria-label="Age group">
            <option value="">All age groups</option>
            {ages.map((a) => <option key={a} value={a}>{groupLabel(a)}</option>)}
          </select>
        </label>
        {extra}
        <button className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Filter</button>
      </form>
    </div>
  )
}

export function Flash({ done, error }: { done?: string; error?: string }) {
  if (!done && !error) return null
  return <p role={error ? 'alert' : 'status'} className={`border p-3 text-sm ${error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{error ?? done}</p>
}
