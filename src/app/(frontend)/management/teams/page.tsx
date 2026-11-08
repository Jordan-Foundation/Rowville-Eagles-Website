import { requireManagement } from '@/lib/management'
import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { teamTitle } from '@/teams/service'
import { toggleArchive } from './actions'
import { ConfirmButton } from '@/components/ConfirmButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Team pages', robots: { index: false } }

export default async function StaffTeams({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireManagement('/management/teams')
  const show = (await searchParams).show
  const p = await payload()
  const { docs: teams } = await p.find({ pagination: false, collection: 'teams', where: show === 'archived' ? { archived: { equals: true } } : { archived: { not_equals: true } }, sort: 'order', limit: 300, depth: 0, overrideAccess: true })
  const { docs: members } = await p.find({ pagination: false, collection: 'team-members', where: { active: { equals: true } }, limit: 10000, depth: 0, overrideAccess: true, select: { team: true } })
  const count = (id: number) => members.filter((m) => (typeof m.team === 'object' ? m.team.id : m.team) === id).length

  return (
    <div className="container-x py-14">
      <p className="eyebrow !text-brand">Management</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Team pages</h1>
      <p className="mt-3 max-w-2xl text-muted">Paid players join automatically. Tournament team pages are created when the first player in a squad pays. Archive a page once the tournament or season ends — families stop seeing it.</p>
      <div className="mt-6 flex gap-2 text-sm">
        <Link href="/management/teams" className={`rounded-full px-4 py-2 font-semibold ${show !== 'archived' ? 'bg-brand text-white' : 'border border-line'}`}>Active</Link>
        <Link href="/management/teams?show=archived" className={`rounded-full px-4 py-2 font-semibold ${show === 'archived' ? 'bg-brand text-white' : 'border border-line'}`}>Archived</Link>
      </div>
      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wider text-muted"><tr><th className="py-2">Team</th><th>Type</th><th>Players</th><th>Coaches</th><th /></tr></thead>
        <tbody className="divide-y divide-line">
          {teams.map((t) => (
            <tr key={t.id}>
              <td className="py-3"><Link href={`/teams/${t.slug}`} className="font-semibold underline">{teamTitle(t)}</Link></td>
              <td>{t.type === 'tournament' ? 'Tournament' : 'Club'}</td>
              <td>{count(t.id)}</td>
              <td>{(t.coaches ?? []).length}</td>
              <td className="flex gap-2 py-2">
                <a href={`/admin/collections/teams/${t.id}`} className="rounded-full border border-line px-3 py-1 font-semibold">Edit details</a>
                <form action={toggleArchive}><input type="hidden" name="id" value={t.id} />{t.archived ? <button className="rounded-full border border-line px-3 py-1 font-semibold">Restore</button> : <ConfirmButton message={`Archive ${t.name}? Families stop seeing the team page (you can restore it later).`} className="rounded-full border border-line px-3 py-1 font-semibold">Archive</ConfirmButton>}</form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
