import type { Metadata } from 'next'
import { formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { coachOpenSlots, myShareLinks } from '@/academy/share-links'
import { HOLD_CHOICES, linkState, type LinkState } from '@/academy/share-rules'
import { LinkButtons, ShareForm } from './Forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Share links', robots: { index: false } }

const STATE: Record<LinkState, string> = { held: 'Held', open: 'Sent — not held', booked: 'Booked ✓', cancelled: 'Cancelled', expired: 'Expired' }
const tone: Record<LinkState, string> = { held: 'bg-amber-400/20 text-amber-200', open: 'bg-white/10', booked: 'bg-emerald-400/20 text-emerald-200', cancelled: 'text-muted', expired: 'text-muted' }

export default async function SharePage() {
  const { coach } = await requireCoach('/coach/share')
  const p = await payload()
  const [open, links] = await Promise.all([coachOpenSlots(p, coach.id), myShareLinks(p, coach.id)])
  const day = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })
  const casual = (open?.casual ?? []).map((iso) => ({ value: `casual|${iso}`, label: formatDate(iso, { hour: 'numeric', minute: '2-digit' }), group: day(iso) }))
  const weekly = (open?.weekly ?? []).map((w) => ({ value: `term|${w.weekday}|${w.time}`, label: `${w.weekday}s at ${formatDate(w.sessions[0], { hour: 'numeric', minute: '2-digit' })} — ${w.sessions.length} sessions from ${formatDate(w.sessions[0], { day: 'numeric', month: 'short' })}` }))
  const now = new Date()
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Share links</h1>
        <p className="mt-3 max-w-2xl text-muted">Send a family a link to book one of your open times. You can hold the time for them for up to 72 hours so nobody else takes it. The link opens the booking with you, the time and their details already filled in.</p>
      </div>
      <section className="panel border border-line p-6">
        <h2 className="font-display text-2xl font-semibold uppercase">New link</h2>
        {!open ? (
          <p className="mt-3 text-sm text-muted">There’s no open term to book into yet.</p>
        ) : casual.length + weekly.length === 0 ? (
          <p className="mt-3 text-sm text-muted">You have no open times left this term — add more in Availability.</p>
        ) : (
          <div className="mt-5"><ShareForm casual={casual} weekly={weekly} holdChoices={HOLD_CHOICES} defaultHold={HOLD_CHOICES.includes(open.term.shareLinkHoldHours ?? 24) ? (open.term.shareLinkHoldHours ?? 24) : 24} /></div>
        )}
      </section>
      <section>
        <h2 className="font-display text-2xl font-semibold uppercase">Your links</h2>
        {links.length === 0 ? (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line">
            {links.map(({ link: l, holdActive }) => {
              const st = linkState({ status: l.status, holdUntil: l.holdUntil, expiresAt: l.expiresAt, holdActive }, now)
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold">{l.client.firstName} {l.client.lastName}{l.client.playerFirstName ? <span className="font-normal text-muted"> · {l.client.playerFirstName}</span> : null}</p>
                    <p className="text-sm text-muted">{l.mode === 'term' ? `${l.weekday}s ${l.startTime} · whole term` : formatDate(l.startsAt!, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                    <p className="mt-1 text-xs text-muted">
                      <span className={`mr-2 px-2 py-0.5 font-semibold uppercase tracking-wider ${tone[st]}`}>{STATE[st]}</span>
                      {st === 'held' && l.holdUntil ? `until ${formatDate(l.holdUntil, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ` : ''}
                      Sent {formatDate(l.createdAt, { day: 'numeric', month: 'short' })}{l.sentSms ? ' by email + text' : l.sentEmail ? ' by email' : ''}{l.openedAt ? ' · opened' : ''}
                    </p>
                  </div>
                  {(st === 'held' || st === 'open') && <LinkButtons id={l.id} canResend />}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
