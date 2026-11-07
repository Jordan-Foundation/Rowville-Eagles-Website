import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { foundationGate } from '@/academy/pdr/load'
import { visibleChallenges } from '@/academy/pdr/challenges'
import { challengeState, daysLeft, monthLabel } from '@/academy/pdr/challenge-rules'
import { Crumbs } from '../ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Monthly challenges', robots: { index: false } }

export default async function Challenges() {
  const { p, settings, user } = await foundationGate()
  if (!user) redirect('/login?next=/foundation-plus/challenges')
  const list = await visibleChallenges(p)
  const current = list.find((c) => challengeState(c.month) === 'open')
  const past = list.filter((c) => c !== current)
  return (
    <div>
      <Crumbs items={[{ href: '/foundation-plus', label: settings.name }, { label: 'Monthly challenges' }]} />
      <h1 className="font-display text-5xl font-bold uppercase tracking-tight">Monthly challenges</h1>
      <p className="mt-2 max-w-2xl text-muted">A new skill challenge every month for Premium players. Send as many attempts as you like — a coach checks each one and your best score counts. Prizes for the winners.</p>
      {current ? (
        <Link href={`/foundation-plus/challenges/${current.id}`} className="panel gloss-sheen mt-8 block border border-white/30 p-8 transition hover:border-white">
          <p className="eyebrow">{monthLabel(current.month)} · {daysLeft(current.month)} day{daysLeft(current.month) === 1 ? '' : 's'} left</p>
          <p className="mt-2 font-display text-4xl font-bold uppercase">{current.title}</p>
          <p className="mt-2 max-w-2xl text-muted">{current.description}</p>
          {current.prize && <p className="mt-3 text-sm">🏆 <strong>Prize:</strong> {current.prize}</p>}
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em]">Take the challenge →</p>
        </Link>
      ) : (
        <p className="panel mt-8 border border-line p-6 text-muted">This month’s challenge is coming soon.</p>
      )}
      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold uppercase">Past challenges</h2>
          <ul className="mt-4 divide-y divide-line border border-line">
            {past.map((c) => (
              <li key={c.id}>
                <Link href={`/foundation-plus/challenges/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-white/5">
                  <span><span className="font-semibold">{c.title}</span> <span className="text-sm text-muted">· {monthLabel(c.month)}</span></span>
                  <span className="text-xs uppercase tracking-[0.15em] text-muted">{c.closedAt ? 'Results →' : 'Results coming soon'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
