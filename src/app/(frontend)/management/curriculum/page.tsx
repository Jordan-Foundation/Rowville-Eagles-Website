import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { curriculum, standardFor } from '@/academy/curriculum/load'
import { LEVELS, STRANDS, isLevel, type LevelKey } from '@/academy/curriculum/levels'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Curriculum', robots: { index: false } }

/** Read-only map of the Foundation Football Curriculum: one level at a time, every strand's standard and descriptors. */
export default async function CurriculumPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  await requireManagement('/management/curriculum')
  const { level: q } = await searchParams
  const level: LevelKey = isLevel(q) ? q : 'F'
  const all = await curriculum(await payload())
  const info = LEVELS.find((l) => l.key === level)!

  return (
    <div className="container-x max-w-5xl py-14">
      <p className="eyebrow !text-brand">Management</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Curriculum</h1>
      <p className="mt-4 text-muted">
        The Foundation Football Curriculum that player reports are written against. Players are reported on at the level for their age
        (season year − year of birth): Foundation up to age 7, then Ages 8–13. To change the wording, edit it in{' '}
        <Link href="/admin/collections/curriculum-standards" className="underline">Admin → Curriculum</Link>.
      </p>

      <nav aria-label="Level" className="mt-8 flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <Link
            key={l.key}
            href={`/management/curriculum?level=${l.key}`}
            aria-current={l.key === level ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${l.key === level ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}
          >
            {l.name}
          </Link>
        ))}
      </nav>

      <h2 className="mt-10 font-[family-name:var(--font-barlow)] text-3xl font-extrabold uppercase">{info.long}</h2>
      <p className="text-sm text-muted">Phase: {info.phase}</p>

      <div className="mt-6 space-y-6">
        {STRANDS.map((s) => {
          const st = standardFor(all, level, s.key)
          return (
            <section key={s.key} className="rounded-2xl border border-line p-5" aria-labelledby={`strand-${s.key}`}>
              <h3 id={`strand-${s.key}`} className="text-lg font-bold">{s.name} <span className="text-sm font-normal text-muted">({s.key})</span></h3>
              {st ? (
                <>
                  <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm"><strong>Achievement standard:</strong> {st.standard}</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {st.descriptors.map((d) => (
                      <li key={d.code} className="flex gap-3">
                        <span className="shrink-0 font-mono text-xs text-muted">{d.code}</span>
                        <span>{d.text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-red-700">Missing — add it in the admin.</p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
