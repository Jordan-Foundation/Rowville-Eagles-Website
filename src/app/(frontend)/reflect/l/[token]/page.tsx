import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { gameContext, readReflectToken } from '@/reflections/service'
import { ReflectView } from '../../ReflectView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Match reflection', robots: { index: false, follow: false }, referrer: 'no-referrer' }

/** The player's private link: no login, only this player's reflection for this game, until it closes. */
export default async function LinkReflectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const t = readReflectToken(token)
  const p = await payload()
  const g = t ? await gameContext(p, t.participantId, t.teamId, t.fixtureId) : null
  if (!g) {
    return (
      <div className="container-x max-w-2xl py-14">
        <h1 className="font-display text-4xl font-extrabold uppercase">Match reflection</h1>
        <p className="mt-4 text-muted">This link has expired. Ask your parent for the link to your latest game.</p>
      </div>
    )
  }
  return <ReflectView p={p} g={g} auth={{ kind: 'link', token }} family={false} />
}
