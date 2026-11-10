import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatMoney } from '@/lib/payload'
import { groupTitle, groupWhen } from '@/academy/groups'
import { GROUP_STATUS } from '@/academy/group-rules'
import type { AcademyCoach } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Small groups', robots: { index: false } }

/** Every small group that's running or forming, soonest first. */
export default async function ManagementGroupsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireManagement('/management/academy/groups')
  const all = (await searchParams).all === '1'
  const p = await payload()
  const { docs } = await p.find({ pagination: false, collection: 'academy-groups', where: all ? {} : { status: { in: ['forming', 'confirmed', 'shortfall'] } }, sort: 'firstSessionAt', limit: 300, depth: 1, overrideAccess: true })
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Small groups</h1>
        <p className="mt-2 text-muted">2–5 players with one coach. Open a group to cancel, move or arrange cover for a date — for everyone at once. <Link href={all ? '/management/academy/groups' : '/management/academy/groups?all=1'} className="underline">{all ? 'Show running only' : 'Show all, including finished'}</Link></p>
      </div>
      <ul className="divide-y divide-line border border-line">
        {docs.map((g) => (
          <li key={g.id}>
            <Link href={`/management/academy/groups/${g.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/5">
              <span><span className="font-semibold">{groupTitle(g.plannedSize, (g.coach as AcademyCoach).displayName)}</span><span className="block text-sm text-muted">{groupWhen(g)} · {formatMoney(g.ratePerPlayer)} per player</span></span>
              <span className="text-sm text-muted">{GROUP_STATUS[g.status]} · {g.reference}</span>
            </Link>
          </li>
        ))}
        {docs.length === 0 && <li className="p-4 text-sm text-muted">No small groups yet — coaches set them up from My sessions.</li>}
      </ul>
    </div>
  )
}
