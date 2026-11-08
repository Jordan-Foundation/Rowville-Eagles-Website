import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { challengeState, monthLabel } from '@/academy/pdr/challenge-rules'
import { nextMonthKey } from '@/academy/pdr/manage-rules'
import { ChallengeForm, type ChallengeValues } from '../../Forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Monthly challenge', robots: { index: false } }

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  const { id } = await params
  await requireManagement(`/management/foundation-plus/challenges/${id}`)
  const sp = await searchParams
  const p = await payload()
  let v: ChallengeValues = { title: '', month: sp.month || nextMonthKey(), description: '', rules: '', unit: 'points', direction: 'higher', groupBy: 'birthYear', winnersPerGroup: 1, prize: '', published: false }
  let locked = false
  let demo: number | null = null
  if (id !== 'new') {
    const c = await p.findByID({ collection: 'pdr-challenges', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
    if (!c) notFound()
    v = { id: c.id, title: c.title, month: c.month, description: c.description, rules: c.rules ?? '', unit: c.unit, direction: c.direction, groupBy: c.groupBy, winnersPerGroup: c.winnersPerGroup, prize: c.prize ?? '', published: !!c.published }
    locked = challengeState(c.month) !== 'upcoming' // the month can't move once it has started
    demo = c.id
  }
  return (
    <div className="container-x max-w-3xl py-14">
      <Link href="/management/foundation-plus#challenges" className="text-sm text-muted hover:text-ink">← Foundation+</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">{id === 'new' ? 'New challenge' : `${monthLabel(v.month)} challenge`}</h1>
      <p className="mt-3 text-muted">One challenge a month for Premium players. Results and winner emails are sent automatically once the month ends and every attempt has been checked.</p>
      <div className="mt-8"><ChallengeForm v={v} locked={locked} /></div>
      {demo && <p className="mt-6 text-sm text-muted">Demo video: add or change it in <Link className="underline" href={`/admin/collections/pdr-challenges/${demo}`}>the admin</Link>.</p>}
    </div>
  )
}
