import Link from 'next/link'
import { ProgramPicker } from './ProgramPicker'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { OneOnOneView } from './_views/OneOnOne'
import { AcademyView } from './_views/Academy'
import { RowvilleView, TournamentsView } from './_views/Selections'
import { FoundationPlusView } from './_views/FoundationPlus'
import { StoreView } from './_views/Store'
import { CampsView } from './_views/Camps'
import { TimeframesView } from './_views/Timeframes'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Programs Overview', robots: { index: false } }

const PROGRAMS = [
  { key: '1on1', label: '1-on-1s' },
  { key: 'academy', label: 'Foundation Academy' },
  { key: 'rowville', label: 'Rowville Eagles' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'foundation-plus', label: 'Foundation+' },
  { key: 'toddler', label: 'Mini Ballers' },
  { key: 'camps', label: 'Holiday camps' },
  { key: 'timeframes', label: 'Timeframes' },
  { key: 'store', label: 'Store' },
] as const
type Key = (typeof PROGRAMS)[number]['key']

export default async function ProgramsOverview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams
  await requireManagement(`/management/programs${q.program ? `?program=${q.program}` : ''}`)
  const current: Key = (PROGRAMS.find((x) => x.key === q.program)?.key ?? '1on1') as Key
  const i = PROGRAMS.findIndex((x) => x.key === current)
  const prev = PROGRAMS[(i - 1 + PROGRAMS.length) % PROGRAMS.length]
  const next = PROGRAMS[(i + 1) % PROGRAMS.length]
  return (
    <div data-brand="academy" data-page-brand="academy">
      <div className="container-x space-y-10 py-14">
        <div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-muted">Management</p>
          <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Programs Overview</h1>
          <p className="mt-2 text-sm"><Link href="/management/programs/setup" className="underline">Program setup</Link> · <Link href="/management/money" className="underline">Money summary</Link></p>
        </div>

        {/* Switcher: real links, so the address can be bookmarked and Back works */}
        <ProgramPicker programs={PROGRAMS.map((x) => ({ key: x.key, label: x.label }))} current={current} />
        <nav aria-label="Programs" className="hidden items-stretch gap-2 sm:flex">
          <Link href={`/management/programs?program=${prev.key}`} aria-label={`Previous: ${prev.label}`} className="grid w-10 shrink-0 place-items-center border border-line text-lg hover:border-ink">‹</Link>
          <ul className="flex min-w-0 flex-1 snap-x gap-1 overflow-x-auto border border-line p-1">
            {PROGRAMS.map((x) => (
              <li key={x.key} className="snap-start">
                <Link
                  href={`/management/programs?program=${x.key}`}
                  aria-current={x.key === current ? 'page' : undefined}
                  className={`block whitespace-nowrap px-4 py-2 text-sm font-semibold transition ${x.key === current ? 'bg-white text-black' : 'text-muted hover:text-ink'}`}
                >
                  {x.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/management/programs?program=${next.key}`} aria-label={`Next: ${next.label}`} className="grid w-10 shrink-0 place-items-center border border-line text-lg hover:border-ink">›</Link>
        </nav>

        {current === '1on1' && <OneOnOneView q={q} />}
        {current === 'academy' && <AcademyView q={q} />}
        {current === 'rowville' && <RowvilleView q={q} />}
        {current === 'tournaments' && <TournamentsView q={q} />}
        {current === 'foundation-plus' && <FoundationPlusView />}
        {current === 'toddler' && <AcademyView q={q} type="toddler" program="toddler" />}
        {current === 'store' && <StoreView q={q} />}
        {current === 'camps' && <CampsView />}
        {current === 'timeframes' && <TimeframesView />}
      </div>
    </div>
  )
}
