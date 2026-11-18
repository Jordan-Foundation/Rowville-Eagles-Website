import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { groupLabel } from '@/lib/age-groups'
import { playingYear } from '@/selections/board'
import type { SelectionEntry } from '@/payload-types'
import { AttendanceList } from './AttendanceList'
import { href } from '../../_shared/ctx'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Trial attendance', robots: { index: false } }

/** On the day: tick who came. Big tap targets for a phone. */
export default async function AttendancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ program?: string; round?: string }> }) {
  await requireManagement('/management/selections/sessions')
  const { id } = await params
  const sp = await searchParams
  const p = await payload()
  const session = await p.findByID({ collection: 'trial-sessions', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!session) notFound()
  const { docs } = await p.find({ collection: 'trial-invites', where: { session: { equals: session.id } }, limit: 2000, depth: 1, overrideAccess: true, pagination: false })
  const rows = docs
    .filter((i) => i.entry && typeof i.entry === 'object')
    .map((i) => {
      const e = i.entry as SelectionEntry
      return { id: i.id, name: `${e.player.firstName} ${e.player.lastName}`, group: groupLabel(playingYear(e)), year: playingYear(e), attended: Boolean(i.attended), phone: e.contact.phone, parent: `${e.contact.firstName} ${e.contact.lastName}` }
    })
    .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name))
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={href('/management/selections/sessions', { program: sp.program, round: sp.round })} className="text-sm text-muted hover:text-ink">← Trial sessions</Link>
      <div>
        <h1 className="font-display text-3xl font-semibold uppercase tracking-tight">{session.title}</h1>
        <p className="mt-1 text-muted">{formatDate(session.start, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} · {session.location || '208 Dandelion Drive, Rowville'}</p>
      </div>
      <AttendanceList rows={rows} />
    </div>
  )
}
