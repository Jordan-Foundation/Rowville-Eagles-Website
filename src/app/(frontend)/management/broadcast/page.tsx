import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { broadcastAudience } from '@/messaging/broadcast'
import { QUICK_REPLIES } from '@/messaging/templates'
import { BroadcastForm } from '@/app/(frontend)/coach/broadcast/BroadcastForm'
import { managementBroadcastAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Email a group', robots: { index: false } }

/** Management: an everyday notice to every family in an Academy group, a team or a report round. */
export default async function ManagementBroadcast({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const user = await requireManagement('/management/broadcast')
  const to = (await searchParams).to ?? ''
  const p = await payload()
  const audience = to ? await broadcastAudience(p, user, null, to) : null
  if (!audience) {
    const [{ docs: programs }, { docs: teams }, { docs: cycles }] = await Promise.all([
      p.find({ pagination: false, collection: 'programs', where: { type: { in: ['academy-term', 'toddler'] }, status: { in: ['open', 'full', 'closed'] } }, sort: '-startDate', limit: 20, depth: 0, overrideAccess: true }),
      p.find({ pagination: false, collection: 'teams', where: { archived: { not_equals: true } }, sort: 'name', limit: 100, depth: 0, overrideAccess: true }),
      p.find({ pagination: false, collection: 'report-cycles', sort: '-createdAt', limit: 10, depth: 0, overrideAccess: true }),
    ])
    const { docs: slots } = programs.length ? await p.find({ pagination: false, collection: 'academy-term-slots', where: { program: { in: programs.map((x) => x.id) } }, limit: 300, depth: 0, overrideAccess: true }) : { docs: [] }
    const item = 'block p-3 hover:bg-white/5'
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Email a group</h1>
          <p className="mt-2 text-muted">Everyday notices — training changes, reminders, what to bring. Each family gets it by text (or email if they can’t get texts) in their own conversation. For offers and discounts use Promotions instead.</p>
          {to && <p role="alert" className="mt-3 text-sm text-red-300">That group couldn’t be found.</p>}
        </div>
        <section aria-label="Academy groups" className="panel border border-line">
          <h2 className="border-b border-line px-4 py-3 font-display text-lg font-semibold uppercase">Academy groups</h2>
          <ul className="divide-y divide-line text-sm">
            {programs.map((prog) => slots.filter((s) => (typeof s.program === 'object' ? s.program.id : s.program) === prog.id).map((s) => (
              <li key={s.id}>
                <Link className={item} href={`/management/broadcast?to=group:${s.id}:`}>{prog.title} · {s.weekday} {s.startTime}{s.groups?.length ? ' (everyone)' : ''}</Link>
                {(s.groups ?? []).map((g) => <Link key={g.id} className={`${item} pl-8 text-muted`} href={`/management/broadcast?to=group:${s.id}:${g.id}`}>↳ {g.name}</Link>)}
              </li>
            )))}
            {slots.length === 0 && <li className="p-3 text-muted">No Academy groups.</li>}
          </ul>
        </section>
        <section aria-label="Teams" className="panel border border-line">
          <h2 className="border-b border-line px-4 py-3 font-display text-lg font-semibold uppercase">Teams</h2>
          <ul className="grid divide-y divide-line text-sm sm:grid-cols-2">{teams.map((t) => <li key={t.id}><Link className={item} href={`/management/broadcast?to=team:${t.id}`}>{t.name}</Link></li>)}</ul>
        </section>
        <section aria-label="Report rounds" className="panel border border-line">
          <h2 className="border-b border-line px-4 py-3 font-display text-lg font-semibold uppercase">Report rounds</h2>
          <ul className="divide-y divide-line text-sm">{cycles.map((c) => <li key={c.id}><Link className={item} href={`/management/broadcast?to=cycle:${c.id}`}>{c.name}</Link></li>)}{cycles.length === 0 && <li className="p-3 text-muted">No report rounds yet.</li>}</ul>
        </section>
      </div>
    )
  }
  const texts = audience.recipients.filter((r) => r.via === 'text').length
  return (
    <div className="grid max-w-6xl gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <div>
          <Link href="/management/broadcast" className="text-sm text-muted hover:text-ink">← All groups</Link>
          <h1 className="mt-3 font-display text-4xl font-semibold uppercase tracking-tight">Message {audience.title}</h1>
          <p className="mt-2 text-muted">Signed with your first name. Each family replies privately to Management → Messages.</p>
        </div>
        <BroadcastForm to={to} count={audience.recipients.length} templates={QUICK_REPLIES} send={managementBroadcastAction} />
      </div>
      <aside className="panel h-fit border border-line" aria-label="Who gets it">
        <p className="border-b border-line p-4 text-sm"><strong>{audience.recipients.length}</strong> famil{audience.recipients.length === 1 ? 'y' : 'ies'} · {texts} by text · {audience.recipients.length - texts} by email</p>
        <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto text-sm">
          {audience.recipients.map((r) => <li key={r.accountId} className="flex justify-between gap-3 p-3"><Link href={`/management/families/${r.accountId}`} className="underline decoration-white/30">{r.name}</Link><span className="text-xs uppercase tracking-wider text-muted">{r.via}</span></li>)}
        </ul>
      </aside>
    </div>
  )
}
