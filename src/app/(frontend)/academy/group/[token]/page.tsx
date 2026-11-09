import Link from 'next/link'
import type { Metadata } from 'next'
import { formatAUD, formatDate } from '@/lib/format'
import { payload } from '@/lib/payload'
import { findGroupInvite, groupInvites, groupWhen } from '@/academy/groups'
import { firstNamesList, INVITE_STATUS } from '@/academy/group-rules'
import type { AcademyCoach, AcademyTerm, Media } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Small group session', robots: { index: false, follow: false }, referrer: 'no-referrer' }

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)

/**
 * A family's own small group link (no login needed). Shows the coach, time, place, price and the other
 * players' first names only — never anyone else's contact or payment details.
 */
export default async function GroupInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const p = await payload()
  const found = await findGroupInvite(p, token)
  if (!found || found.invite.status === 'removed' || found.group.status === 'cancelled') {
    return (
      <div data-brand="academy" data-page-brand="academy" className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl font-semibold uppercase">This link has expired</h1>
        <p className="mt-4 text-muted">The group may have changed, or a newer link was sent. Please check your latest message from your coach, or get in touch and we’ll help.</p>
        <Link href="/academy/1-on-1" className="mt-8 inline-block border border-line px-5 py-3 text-sm font-semibold uppercase tracking-[0.15em]">Foundation Academy 1-on-1s</Link>
      </div>
    )
  }
  const { invite, group: g } = found
  if (!invite.openedAt) await p.update({ collection: 'academy-group-invites', id: invite.id, overrideAccess: true, data: { openedAt: new Date().toISOString() } })
  const [coach, term, everyone] = await Promise.all([
    p.findByID({ collection: 'academy-coaches', id: rel(g.coach)!, depth: 1, overrideAccess: true }) as Promise<AcademyCoach>,
    p.findByID({ collection: 'academy-terms', id: rel(g.term)!, depth: 0, overrideAccess: true }) as Promise<AcademyTerm>,
    groupInvites(p, g.id),
  ])
  const others = everyone.filter((i) => i.id !== invite.id && i.status !== 'declined').map((i) => i.invitee.playerFirstName)
  const size = others.length + 1
  const photo = typeof coach.photo === 'object' ? (coach.photo as Media | null)?.url : null
  const total = invite.rateLocked * g.sessionsTotal
  const st = INVITE_STATUS[invite.status] ?? INVITE_STATUS.invited
  const me = invite.invitee.playerFirstName
  return (
    <div data-brand="academy" data-page-brand="academy"><div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">Foundation Academy · small group</p>
      <h1 className="mt-3 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{me}’s small group with {coach.displayName}</h1>
      <div className="panel mt-8 border border-line p-6">
        <div className="flex items-center gap-4">
          {photo && <img src={photo} alt={coach.displayName} className="h-16 w-16 rounded-full object-cover" />}
          <div>
            <p className="font-semibold">{coach.displayName}</p>
            <p className="text-sm text-muted">Your coach</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">{g.type === 'term' ? 'Weekly' : 'When'}</dt><dd className="font-semibold">{groupWhen(g)}</dd></div>
          <div><dt className="text-muted">Where</dt><dd className="font-semibold">{term.location || 'To be confirmed'}</dd></div>
          <div><dt className="text-muted">Group</dt><dd className="font-semibold">{size} players — {me}{others.length ? ` with ${firstNamesList(others)}` : ''}</dd></div>
          <div><dt className="text-muted">Price</dt><dd className="font-semibold">{formatAUD(invite.rateLocked)} a session{g.type === 'term' ? <span className="block font-normal text-muted">{formatAUD(total)} for {g.sessionsTotal} sessions</span> : null}</dd></div>
        </dl>
      </div>
      <div className="mt-6 border border-line p-6">
        {invite.status === 'paid' || invite.status === 'weekly' ? (
          <p className="font-semibold text-emerald-200">{st.label} — {me}’s place is confirmed.</p>
        ) : invite.status === 'declined' ? (
          <p className="text-muted">You’ve let {coach.displayName} know {me} can’t make it. Thanks for telling us.</p>
        ) : (
          <>
            <p className="font-semibold">{g.paymentDeadline ? `Please pay by ${formatDate(g.paymentDeadline, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} to keep ${me}’s place.` : `Please pay soon to keep ${me}’s place.`}</p>
            <p className="mt-2 text-sm text-muted">Online payment for small groups is being switched on — {coach.displayName} will let you know as soon as you can pay here.</p>
          </>
        )}
      </div>
      <p className="mt-6 text-xs text-muted">Each family pays for their own player. This link is just for you — please don’t forward it.</p>
    </div></div>
  )
}
