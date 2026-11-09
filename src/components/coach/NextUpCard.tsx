import Link from 'next/link'
import { formatDate } from '@/lib/payload'
import { ContactButtons } from './ContactButtons'

export type NextUp = {
  when: string
  title: string
  subtitle?: string
  players: number
  medical: number
  href: string
  hrefLabel: string
  parent?: { name: string; phone?: string | null; accountId?: number | null }
}

/** Top of the coach dashboard: what's on today, or the next session — who, when, medical flags, call. */
export function NextUpCard({ next, today }: { next: NextUp | null; today: string }) {
  if (!next) return <section className="panel border border-line p-6 text-muted">Nothing coming up in the next week.</section>
  const isToday = formatDate(next.when, { year: 'numeric', month: '2-digit', day: '2-digit' }) === formatDate(`${today}T02:00:00Z`, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return (
    <section aria-label="Next session" className="panel gloss-sheen border-2 border-white/60 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted">{isToday ? 'Today' : 'Next up'}</p>
      <p className="mt-1 font-display text-3xl font-semibold uppercase leading-tight">
        {formatDate(next.when, isToday ? { hour: 'numeric', minute: '2-digit' } : { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {next.title}
      </p>
      {next.subtitle && <p className="mt-1 text-sm text-muted">{next.subtitle}</p>}
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span>{next.players} player{next.players === 1 ? '' : 's'}</span>
        {next.medical > 0 && <span className="bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">{next.medical} medical</span>}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={next.href} className="min-h-11 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black">{next.hrefLabel}</Link>
        {next.parent && <ContactButtons compact name={next.parent.name} phone={next.parent.phone} accountId={next.parent.accountId} />}
      </div>
    </section>
  )
}
