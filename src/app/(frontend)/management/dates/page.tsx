import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { loadDateIssues, loadDates } from '@/lib/dates-data'
import { DateRowForm } from './DateRowForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Set dates', robots: { index: false } }

export default async function SetDatesPage() {
  await requireManagement('/management/dates')
  const p = await payload()
  const [sections, issues] = await Promise.all([loadDates(p), loadDateIssues(p)])
  return (
    <div className="container-x max-w-5xl py-14">
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Set dates</h1>
      <p className="mt-4 text-muted">Every date that drives bookings, reminders and age groups, in one place. Times are Melbourne time. Each row saves on its own.</p>
      {issues.length > 0 && (
        <section aria-label="Needs attention" className="mt-6 rounded-2xl border border-amber-400 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-semibold">Needs attention ({issues.length})</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{issues.map((i) => <li key={i.text}><a href={i.href} className="underline">{i.text}</a></li>)}</ul>
        </section>
      )}
      <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2 text-sm">
        {sections.map((s) => <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line px-3 py-1 hover:border-ink">{s.title}</a>)}
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-10 scroll-mt-24">
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{s.title}</h2>
          <p className="mt-1 text-sm text-muted">{s.intro}</p>
          <div className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {s.rows.length ? s.rows.map((r) => <DateRowForm key={r.target} row={r} />) : <p className="px-5 py-4 text-sm text-muted">Nothing here yet.</p>}
          </div>
        </section>
      ))}
    </div>
  )
}
