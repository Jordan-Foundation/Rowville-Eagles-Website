import { nudgeOpenPrograms } from '@/academy/release-service'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Where } from 'payload'
import { payload } from '@/lib/payload'
import { programTypes } from '@/collections/Programs'
import { ProgramCard } from '@/components/ProgramCard'

export const metadata: Metadata = { title: 'Camps & Programs', description: 'Holiday camps, Foundation Academy terms, Mini Ballers (ages 2–5), trials and Friday Community Night at Rowville Eagles FC — see dates and book online.', alternates: { canonical: '/programs' } }

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams
  const listed = programTypes.filter((t) => !['registration', 'academy-trial', 'private-session'].includes(t.value))
  const active = listed.find((t) => t.value === type)?.value
  const where: Where = {
    status: { in: ['open', 'full'] },
    type: active ? { equals: active } : { not_in: ['registration', 'academy-trial', 'private-session'] },
  }
  await nudgeOpenPrograms(await payload())
  const { docs } = await (await payload()).find({ pagination: false, collection: 'programs', where, depth: 0, limit: 100 })

  return (
    <>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x py-16">
          <p className="eyebrow">Book & pay online</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase sm:text-6xl">Camps & Programs</h1>
          <p className="mt-4 max-w-xl text-white/70">Holiday camps, tournaments, 1-on-1 coaching and Rowville Foundation Academy programs. Looking to play for the club? <a href="/join" className="font-semibold text-accent underline">Join us for trials</a>.</p>
        </div>
      </section>
      <div className="container-x py-12">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter programs">
          <Filter href="/programs" label="All" active={!active} />
          {listed.map((t) => (
            <Filter key={t.value} href={`/programs?type=${t.value}`} label={t.label} active={active === t.value} />
          ))}
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {docs.map((p) => <ProgramCard key={p.id} p={p} />)}
        </div>
        {docs.length === 0 && <p className="mt-10 text-muted">Nothing open in this category right now — check back soon.</p>}
      </div>
    </>
  )
}

function Filter({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${active ? 'border-brand bg-brand text-white' : 'border-line hover:border-brand'}`}
    >
      {label}
    </Link>
  )
}
