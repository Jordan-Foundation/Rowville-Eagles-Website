import Link from 'next/link'
import type { Metadata } from 'next'
import { requireCoach } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { broadcastAudience } from '@/messaging/broadcast'
import { QUICK_REPLIES } from '@/messaging/templates'
import { coachGroups } from '@/academy/terms/coach-groups'
import { coachTeams } from '@/lib/attention'
import { BroadcastForm } from './BroadcastForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Message a group', robots: { index: false } }

/** Message every family in a group or team, after seeing exactly who gets it and how. */
export default async function Broadcast({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { user, coach } = await requireCoach('/coach/broadcast')
  const to = (await searchParams).to ?? ''
  const p = await payload()
  const audience = to ? await broadcastAudience(p, user, coach, to) : null
  if (!audience) {
    const [groups, teams] = await Promise.all([coachGroups(p, coach.id), coachTeams(p, user)])
    return (
      <div className="space-y-6">
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Message a group</h1>
        {to && <p role="alert" className="text-sm text-red-300">That group or team isn’t one of yours.</p>}
        <ul className="divide-y divide-line border border-line">
          {groups.map((g) => <li key={g.key}><Link className="block p-4 hover:bg-white/5" href={`/coach/broadcast?to=group:${g.key.includes(':') ? g.key : `${g.key}:`}`}>{g.title}</Link></li>)}
          {teams.map((t) => <li key={t.id}><Link className="block p-4 hover:bg-white/5" href={`/coach/broadcast?to=team:${t.id}`}>{t.name}</Link></li>)}
          {groups.length + teams.length === 0 && <li className="p-4 text-muted">You don’t have any groups or teams yet.</li>}
        </ul>
      </div>
    )
  }
  const texts = audience.recipients.filter((r) => r.via === 'text').length
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <div>
          <Link href="/coach/broadcast" className="text-sm text-muted hover:text-ink">← Groups &amp; teams</Link>
          <h1 className="mt-3 font-display text-4xl font-semibold uppercase tracking-tight">Message {audience.title}</h1>
          <p className="mt-2 text-muted">Each family gets it in their own conversation, so replies come back to you privately.</p>
        </div>
        <BroadcastForm to={to} count={audience.recipients.length} templates={QUICK_REPLIES} />
      </div>
      <aside className="panel h-fit border border-line" aria-label="Who gets it">
        <p className="border-b border-line p-4 text-sm"><strong>{audience.recipients.length}</strong> famil{audience.recipients.length === 1 ? 'y' : 'ies'} · {texts} by text · {audience.recipients.length - texts} by email</p>
        <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto text-sm">
          {audience.recipients.map((r) => (
            <li key={r.accountId} className="flex justify-between gap-3 p-3">
              <span>{r.name}<span className="block text-xs text-muted">{r.kids.filter(Boolean).join(', ')}</span></span>
              <span className="text-xs uppercase tracking-wider text-muted">{r.via}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
