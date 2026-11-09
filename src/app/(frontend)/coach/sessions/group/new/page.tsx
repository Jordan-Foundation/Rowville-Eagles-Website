import Link from 'next/link'
import type { Metadata } from 'next'
import { formatDate } from '@/lib/format'
import { payload } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { coachOpenSlots } from '@/academy/share-links'
import { groupSettings } from '@/academy/group-pricing'
import { GroupForm } from './GroupForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'New group session', robots: { index: false } }

export default async function NewGroupPage() {
  const { coach } = await requireCoach('/coach/sessions/group/new')
  const p = await payload()
  const [open, settings] = await Promise.all([coachOpenSlots(p, coach.id), p.findGlobal({ slug: 'academy-settings', depth: 0, overrideAccess: true })])
  const day = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })
  const t = (iso: string) => formatDate(iso, { hour: 'numeric', minute: '2-digit' })
  const casual = (open?.casual ?? []).map((iso) => ({ value: `casual|${iso}`, label: t(iso), group: day(iso), when: `${day(iso)}, ${t(iso)}` }))
  const weekly = (open?.weekly ?? []).map((w) => ({
    value: `term|${w.weekday}|${w.time}`,
    label: `${w.weekday}s at ${t(w.sessions[0])} — ${w.sessions.length} sessions from ${formatDate(w.sessions[0], { day: 'numeric', month: 'short' })}`,
    sessions: w.sessions.length,
    when: `${w.weekday}s at ${t(w.sessions[0])}, from ${formatDate(w.sessions[0], { day: 'numeric', month: 'short' })}`,
  }))
  return (
    <div className="space-y-8">
      <div>
        <Link href="/coach/sessions" className="text-sm text-muted hover:text-ink">← My sessions</Link>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">New group session</h1>
        <p className="mt-3 max-w-2xl text-muted">2–5 players with you. Each family gets their own link to pay for their player — prices are set by the club and depend on the group size.</p>
      </div>
      {!open ? (
        <p className="text-muted">There’s no open term to book into yet.</p>
      ) : casual.length + weekly.length === 0 ? (
        <p className="text-muted">You have no open times left this term — add more in <Link href="/coach/availability" className="underline">Availability</Link>.</p>
      ) : (
        <GroupForm casual={casual} weekly={weekly} settings={groupSettings(settings)} />
      )}
    </div>
  )
}
