import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { gameContext, ownsPlayer } from '@/reflections/service'
import { ReflectView } from '../../../ReflectView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Match reflection', robots: { index: false } }

/** The family's view of one player's reflection for one game. */
export default async function FamilyReflectPage({ params }: { params: Promise<{ participant: string; team: string; fixture: string }> }) {
  const { participant, team, fixture } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/reflect/${participant}/${team}/${fixture}`)}`)
  const p = await payload()
  const g = await gameContext(p, Number(participant), Number(team), fixture)
  if (!g || !ownsPlayer(user, g.participant)) {
    return (
      <div className="container-x max-w-2xl py-14">
        <h1 className="font-display text-4xl font-extrabold uppercase">Match reflection</h1>
        <p className="mt-4 text-muted">This reflection isn’t available on your account.</p>
        <Link href="/account" className="mt-6 inline-block font-semibold underline">Back to my account</Link>
      </div>
    )
  }
  return <ReflectView p={p} g={g} auth={{ kind: 'family', participantId: g.participant.id, teamId: g.team.id, fixtureId: g.fixture.id }} family />
}
