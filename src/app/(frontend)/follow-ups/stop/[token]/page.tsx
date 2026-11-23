import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload } from '@/lib/payload'
import { readFollowToken } from '@/lib/follow-up-token'
import type { Program } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'No more emails', robots: { index: false } }

async function stop(fd: FormData) {
  'use server'
  const ref = readFollowToken(String(fd.get('token') ?? ''))
  if (!ref) return
  const p = await payload()
  const { docs } = await p.find({ collection: 'bookings', where: { reference: { equals: ref } }, limit: 1, depth: 0, overrideAccess: true })
  if (docs[0]) await p.update({ collection: 'bookings', id: docs[0].id, data: { followUps: { ...docs[0].followUps, stopped: true } }, depth: 0, overrideAccess: true })
  const { redirect } = await import('next/navigation')
  redirect(`/follow-ups/stop/${encodeURIComponent(String(fd.get('token')))}?done=1`)
}

/** "No more emails about this trial" — a button to confirm, so link checkers in email apps can't trigger it. */
export default async function StopPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const token = decodeURIComponent((await params).token)
  const { done } = await searchParams
  const ref = readFollowToken(token)
  if (!ref) notFound()
  const p = await payload()
  const { docs } = await p.find({ collection: 'bookings', where: { reference: { equals: ref } }, limit: 1, depth: 1, overrideAccess: true })
  const b = docs[0]
  if (!b) notFound()
  const prog = b.program as Program
  const stopped = done || b.followUps?.stopped
  return (
    <div className="container-x max-w-xl py-20 text-center" data-follow-stop={stopped ? 'done' : 'ask'}>
      <h1 className="font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">{stopped ? 'Done' : 'No more emails?'}</h1>
      {stopped ? (
        <p className="mt-4 text-muted">We won’t email you about {b.player?.firstName ? `${b.player.firstName}’s ` : ''}{b.bookingType === 'trial' ? 'trial' : 'booking'} again. If you change your mind, you can book any time on our website.</p>
      ) : (
        <form action={stop} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-muted">Stop the follow-up emails about {b.player?.firstName ? `${b.player.firstName}’s ` : 'your '}{b.bookingType === 'trial' ? 'trial' : 'booking'} for {prog?.title ?? 'this program'}?</p>
          <button type="submit" className="rounded-full bg-brand px-6 py-3 font-semibold text-white">Yes, no more emails about this</button>
        </form>
      )}
    </div>
  )
}
