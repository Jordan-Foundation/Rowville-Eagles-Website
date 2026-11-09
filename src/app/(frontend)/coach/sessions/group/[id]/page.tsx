import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { formatAUD, formatDate } from '@/lib/format'
import { payload } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { groupTitle, groupWhen, loadCoachGroup } from '@/academy/groups'
import { GROUP_STATUS, INVITE_STATUS } from '@/academy/group-rules'
import { nudgeGroupClock } from '@/academy/group-clock'
import { CoachTermOffer, GroupDecisions, PlaceActions } from './GroupControls'
import { termOfferPreview } from '@/academy/group-term-offer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Small group', robots: { index: false } }

const tone = { good: 'bg-emerald-400/20 text-emerald-200', wait: 'bg-amber-400/20 text-amber-200', bad: 'bg-red-500/20 text-red-300', off: 'text-muted' } as const
const short = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default async function CoachGroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { id } = await params
  const { coach } = await requireCoach(`/coach/sessions/group/${id}`)
  nudgeGroupClock()
  const data = await loadCoachGroup(await payload(), coach.id, Number(id))
  if (!data) notFound()
  const { group: g, invites, slots } = data
  const termId = typeof g.term === 'object' ? g.term.id : g.term
  const term = await (await payload()).findByID({ collection: 'academy-terms', id: termId, depth: 0, overrideAccess: true, disableErrors: true })
  const preview = g.type === 'casual' && g.status === 'confirmed' ? await termOfferPreview(await payload(), g.id) : null
  const sent = (await searchParams).sent === '1'
  const active = invites.filter((i) => i.status !== 'declined')
  const paid = invites.filter((i) => i.status === 'paid' || i.status === 'weekly').length
  const waiting = invites.filter((i) => i.status === 'invited' || i.status === 'overdue' || i.status === 'declined').length
  const open = g.status === 'forming' || g.status === 'shortfall'
  return (
    <div className="space-y-8">
      <div>
        <Link href="/coach/sessions" className="text-sm text-muted hover:text-ink">← My sessions</Link>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{groupTitle(active.length, coach.displayName)}</h1>
        <p className="mt-2 text-lg">{groupWhen(g)}</p>
        <p className="mt-1 text-sm text-muted">{g.reference} · {GROUP_STATUS[g.status]}</p>
      </div>
      {sent && (
        <p role="status" className="border border-emerald-400/40 p-4 text-sm text-emerald-200">
          Sent — each family has their own link{invites.some((i) => i.sentSms) ? ' by email and text' : ' by email'}. Your time is held until {g.paymentDeadline ? short(g.paymentDeadline) : 'the payment deadline'}.
        </p>
      )}
      {g.status === 'cancelled' && <p role="status" className="border border-red-400/40 p-4 text-sm text-red-200">This group was cancelled. Everyone who paid has been refunded, and every family has been told.</p>}
      {g.status === 'confirmed' && <p role="status" className="border border-emerald-400/40 p-4 text-sm text-emerald-200">Confirmed — this group is going ahead.</p>}
      <dl className="panel grid gap-x-8 gap-y-3 border border-line p-5 text-sm sm:grid-cols-4">
        <div><dt className="text-muted">Paid</dt><dd className="font-display text-2xl font-semibold">{paid} of {active.length}</dd></div>
        <div><dt className="text-muted">Price per player</dt><dd className="font-semibold">{formatAUD(g.ratePerPlayer)} a session</dd></div>
        <div><dt className="text-muted">Sessions</dt><dd className="font-semibold">{g.sessionsTotal}</dd></div>
        <div><dt className="text-muted">Families pay by</dt><dd className="font-semibold">{g.paymentDeadline ? short(g.paymentDeadline) : '—'}</dd></div>
      </dl>
      <section>
        <h2 className="font-display text-2xl font-semibold uppercase">Players</h2>
        <ul className="mt-4 divide-y divide-line border border-line">
          {invites.map((i) => {
            const st = INVITE_STATUS[i.status] ?? INVITE_STATUS.invited
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-semibold">{i.invitee.playerFirstName} {i.invitee.playerLastName}</p>
                  <p className="text-sm text-muted">Parent: {i.invitee.parentFirstName} {i.invitee.parentLastName}</p>
                  <p className="mt-1 text-xs text-muted">Sent {i.sentSms ? 'by email + text' : i.sentEmail ? 'by email' : '—'}{i.openedAt ? ` · opened ${short(i.openedAt)}` : ''}{i.remindedAt ? ` · reminded ${short(i.remindedAt)}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 text-xs font-semibold uppercase tracking-wider ${tone[st.tone]}`}>{st.label}</span>
                  {open && (i.status === 'invited' || i.status === 'overdue' || i.status === 'declined') && (
                    <PlaceActions groupId={g.id} inviteId={i.id} player={i.invitee.playerFirstName} canResend={i.status !== 'declined'} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
      {open && (
        <GroupDecisions
          groupId={g.id}
          paid={paid}
          waiting={waiting}
          shortfall={g.status === 'shortfall'}
          onlyPaid={paid === 1 ? (() => { const i = invites.find((x) => x.status === 'paid' || x.status === 'weekly')!; return { name: i.invitee.playerFirstName, paid: formatAUD(i.rateLocked * g.sessionsTotal) } })() : undefined}
          oneOnOnePrice={term ? (g.type === 'term' ? `${formatAUD(term.pricePerSession)} a session` : formatAUD(term.casualPrice)) : undefined}
        />
      )}
      {preview && (
        <CoachTermOffer
          groupId={g.id}
          status={g.termOffer?.status ?? 'none'}
          yes={invites.filter((i) => (i.status === 'paid' || i.status === 'weekly') && i.termAnswer === 'accepted').length}
          total={invites.filter((i) => i.status === 'paid' || i.status === 'weekly').length}
          weeks={preview.weeks.length}
          rate={formatAUD(preview.quote.rate)}
        />
      )}
      {g.type === 'term' && slots.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-semibold uppercase">Dates</h2>
          <p className="mt-2 text-sm text-muted">{slots.map((s) => formatDate(s.startsAt, { day: 'numeric', month: 'short' })).join(' · ')}</p>
        </section>
      )}
    </div>
  )
}
