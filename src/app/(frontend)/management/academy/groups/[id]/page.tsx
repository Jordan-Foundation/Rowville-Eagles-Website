import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatMoney, formatDate } from '@/lib/payload'
import { groupInvites, groupTitle, groupWhen } from '@/academy/groups'
import { groupSlots } from '@/academy/group-holds'
import { GROUP_STATUS, INVITE_STATUS } from '@/academy/group-rules'
import { PersonLink } from '@/components/management/PersonLink'
import type { AcademyCoach, AcademyTerm } from '@/payload-types'
import { DateTools } from './DateTools'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Small group', robots: { index: false } }

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)

/** One small group for Management: players and payments, and each date (cancel, move or cover for everyone). */
export default async function ManagementGroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const { id } = await params
  const { done } = await searchParams
  await requireManagement(`/management/academy/groups/${id}`)
  const p = await payload()
  const g = await p.findByID({ collection: 'academy-groups', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })
  if (!g) notFound()
  const coach = g.coach as AcademyCoach
  const term = g.term as AcademyTerm
  const [invites, slots, { docs: coaches }] = await Promise.all([
    groupInvites(p, g.id),
    groupSlots(p, g.id),
    p.find({ pagination: false, collection: 'academy-coaches', where: { active: { equals: true } }, sort: 'displayName', limit: 100, depth: 0, overrideAccess: true }),
  ])
  const live = invites.filter((i) => i.status !== 'declined')
  const now = Date.now()
  return (
    <div className="space-y-8">
      <div>
        <Link href="/management/academy/groups" className="text-sm text-muted hover:text-ink">← Small groups</Link>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight">{groupTitle(live.length, coach.displayName)}</h1>
        <p className="mt-2 text-muted">{groupWhen(g)} · {term.location} · {formatMoney(g.ratePerPlayer)} per player, per session</p>
        <p className="mt-1 text-sm text-muted">{g.reference} · {GROUP_STATUS[g.status]}</p>
      </div>
      {done && <p role="status" className="border border-emerald-400/40 p-4 text-sm text-emerald-200">{done}</p>}
      <section aria-label="Players">
        <h2 className="font-display text-2xl font-semibold uppercase">Players</h2>
        <ul className="mt-3 divide-y divide-line border border-line">
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span>
                <PersonLink kind="player" of={i.participant}>{i.invitee.playerFirstName} {i.invitee.playerLastName}</PersonLink>
                <span className="block text-xs text-muted"><PersonLink kind="family" of={i.account}>{i.invitee.parentFirstName} {i.invitee.parentLastName}</PersonLink> · {i.invitee.email}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider">{INVITE_STATUS[i.status]?.label ?? i.status}</span>
                {rel(i.booking) && <Link href={`/management/academy/bookings/${rel(i.booking)}`} className="underline">Booking →</Link>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">To remove a paid player, cancel their booking (the normal cancellation policy applies; their place is then removed and the others keep their price).</p>
      </section>
      <section aria-label="Dates">
        <h2 className="font-display text-2xl font-semibold uppercase">Dates</h2>
        <ul className="mt-3 divide-y divide-line border border-line">
          {slots.map((s) => {
            const label = formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
            const cover = rel(s.coverCoach) ? coaches.find((c) => c.id === rel(s.coverCoach))?.displayName : null
            return (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                <span>
                  <span className="font-semibold">{label}</span>
                  <span className="ml-2 text-xs text-muted">{s.status === 'held' ? 'Held (waiting for payments)' : 'Booked'}</span>
                  {s.needsCover && <span className={`ml-2 text-xs ${cover ? 'text-emerald-300' : 'text-red-300'}`}>{cover ? `Cover: ${cover}` : 'Needs cover'}</span>}
                </span>
                {new Date(s.startsAt).getTime() > now && <div className="w-full sm:w-auto sm:min-w-[22rem]"><DateTools groupId={g.id} at={s.startsAt} label={label} coaches={coaches.filter((c) => c.id !== coach.id).map((c) => ({ id: c.id, name: c.displayName }))} coverCoach={rel(s.coverCoach)} /></div>}
              </li>
            )
          })}
          {slots.length === 0 && <li className="p-4 text-sm text-muted">No dates left.</li>}
        </ul>
      </section>
      {(g.history?.length ?? 0) > 0 && (
        <section aria-label="History">
          <h2 className="font-display text-2xl font-semibold uppercase">History</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {[...(g.history ?? [])].reverse().map((h, i) => <li key={h.id ?? i}>{formatDate(h.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} — {h.action}{h.note ? ` (${h.note})` : ''}</li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
