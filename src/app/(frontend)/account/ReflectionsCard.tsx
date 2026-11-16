import Link from 'next/link'
import type { User } from '@/payload-types'
import { payload, formatDate } from '@/lib/payload'
import { familyDue, familyLink } from '@/reflections/service'

/** Account page: reflections open now, and each player's focus before their next game. */
export async function ReflectionsCard({ user }: { user: User }) {
  const p = await payload()
  const { due, focuses } = await familyDue(p, user)
  if (!due.length && !focuses.length) return null
  return (
    <section className="mt-10 space-y-3" aria-labelledby="h-reflections">
      <h2 id="h-reflections" className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Match reflections</h2>
      {due.map(({ participant: k, game: g }) => (
        <div key={`${k.id}-${g.fixture.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-accent p-5" data-reflection-due>
          <div>
            <p className="font-semibold">{k.firstName}: how did the game against {g.fixture.opponent} go?</p>
            <p className="text-sm text-muted">{g.reflection?.status === 'draft' ? 'Started — ' : ''}3 things that went well, 3 to work on, and a focus · closes {formatDate(g.window.closesAt.toISOString(), { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>
          </div>
          <Link href={familyLink(k.id, g.team.id, g.fixture.id)} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink hover:brightness-110">{g.reflection?.status === 'draft' ? 'Carry on' : 'Reflect'} →</Link>
        </div>
      ))}
      {focuses.map(({ participant: k, focus: f }) => (
        <div key={`f${k.id}`} className="rounded-2xl border border-line bg-surface-2 p-5" data-next-focus>
          <p className="text-sm text-muted">{k.firstName}’s focus for {f.next.team.name} vs {f.next.fixture.opponent} ({formatDate(f.next.fixture.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })})</p>
          <p className="mt-1 text-lg font-semibold">🎯 {f.focus}</p>
          <Link href={`/account/players/${k.id}/reflections`} className="mt-2 inline-block text-sm font-semibold underline">All reflections</Link>
        </div>
      ))}
    </section>
  )
}
