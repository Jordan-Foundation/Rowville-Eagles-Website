import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { programTypes } from '@/collections/Programs'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Program setup', robots: { index: false } }

const TYPE = Object.fromEntries(programTypes.map((t) => [t.value, t.label]))

/** Every program, camp and term — open one to change its details. */
export default async function ProgramSetupList() {
  await requireManagement('/management/programs/setup')
  const { docs } = await (await payload()).find({ pagination: false, collection: 'programs', where: { type: { not_equals: 'private-session' } }, sort: '-startDate', limit: 200, depth: 0, overrideAccess: true })
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Program setup</h1>
        <p className="mt-2 text-muted">Names, status, places, ages, what to bring and drop-off details. <Link href="/admin/collections/programs/create" className="underline">Create a new program</Link> in the admin.</p>
      </div>
      <ul className="divide-y divide-line border border-line">
        {docs.map((p) => (
          <li key={p.id}>
            <Link href={`/management/programs/setup/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/5">
              <span><span className="font-semibold">{p.title}</span><span className="block text-xs text-muted">{TYPE[p.type] ?? p.type}{p.startDate ? ` · ${formatDate(p.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span></span>
              <span className="text-xs uppercase tracking-[0.15em] text-muted">{p.status} · Edit →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
