import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { ownsPlayer } from '@/reflections/service'
import { PlayerHistory } from '@/reflections/PlayerHistory'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My reflections', robots: { index: false } }

export default async function PlayerReflectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?next=/account/players/${id}/reflections`)
  const p = await payload()
  const kid = await p.findByID({ collection: 'participants', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!kid || !ownsPlayer(user, kid)) notFound()
  return (
    <div className="container-x max-w-3xl py-14">
      <Link href={`/account/players/${kid.id}`} className="text-sm font-semibold underline">← {kid.firstName}</Link>
      <p className="eyebrow mt-6 !text-brand">Match reflections</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase">{kid.firstName}’s reflections</h1>
      <div className="mt-8"><PlayerHistory p={p} participantId={kid.id} family /></div>
    </div>
  )
}
