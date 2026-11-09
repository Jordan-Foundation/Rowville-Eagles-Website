import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { teamCategories } from '@/collections/Teams'
import { DownloadCsv } from '@/components/management/DownloadCsv'
import { TeamForm } from './TeamForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Edit team', robots: { index: false } }

export default async function EditTeam({ params }: { params: Promise<{ id: string }> }) {
  await requireManagement('/management/teams')
  const p = await payload()
  const t = await p.findByID({ collection: 'teams', id: Number((await params).id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!t) notFound()
  const { docs: people } = await p.find({ pagination: false, collection: 'users', where: { roles: { in: ['coach', 'committee', 'admin'] } }, sort: 'firstName', limit: 200, depth: 0, overrideAccess: true })
  const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">{t.name}</h1>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm"><Link href={`/teams/${t.slug}`} className="underline">Open the team page</Link><Link href={`/management/broadcast?to=team:${t.id}`} className="underline">Message these families</Link><Link href={`/admin/collections/teams/${t.id}`} className="text-muted underline">More in the admin (photo, tournament info)</Link></p>
        <div className="mt-3"><DownloadCsv list="team-members" params={{ team: t.id }} label="Download player list (CSV)" /></div>
      </div>
      <TeamForm
        team={{ id: t.id, name: t.name, type: t.type, category: t.category, ageGroup: t.ageGroup, competition: t.competition, trainingTimes: t.trainingTimes, driblUrl: t.driblUrl, coaches: (t.coaches ?? []).map(rel), sections: (t.sections ?? {}) as Record<string, boolean> }}
        categories={[...teamCategories]}
        people={people.map((u) => ({ id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email }))}
      />
    </div>
  )
}
