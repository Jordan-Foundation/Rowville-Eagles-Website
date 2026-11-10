import Link from 'next/link'
import type { Metadata } from 'next'
import { formatAUD, formatDate } from '@/lib/format'
import { payload } from '@/lib/payload'
import { findGroupInvite, groupInvites, groupWhen } from '@/academy/groups'
import { firstNamesList, INVITE_STATUS } from '@/academy/group-rules'
import type { AcademyCoach, AcademyTerm, Media, Participant } from '@/payload-types'
import { groupSlots } from '@/academy/group-holds'
import { weeklyPlan } from '@/academy/weekly'
import { DeclineForm, PayForm, TermOfferForm } from './PayForm'
import { placeDue, termOfferPreview } from '@/academy/group-term-offer'
import { nudgeGroupClock } from '@/academy/group-clock'
import { creditBalance } from '@/academy/credits'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Small group session', robots: { index: false, follow: false }, referrer: 'no-referrer' }

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)

/**
 * A family's own small group link (no login needed). Shows the coach, time, place, price and the other
 * players' first names only — never anyone else's contact or payment details.
 */
export default async function GroupInvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const { token } = await params
  const { cancelled } = await searchParams
  nudgeGroupClock()
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
  const [slots, kid] = await Promise.all([
    groupSlots(p, g.id),
    rel(invite.participant) ? (p.findByID({ collection: 'participants', id: rel(invite.participant)!, depth: 0, overrideAccess: true, disableErrors: true }) as Promise<Participant | null>) : Promise.resolve(null),
  ])
  const unpaid = invite.status === 'invited' || invite.status === 'overdue'
  const due = unpaid ? await placeDue(p, invite, g) : null
  const future = due ? due.sessions : slots.filter((x) => new Date(x.startsAt).getTime() > Date.now()).map((x) => x.startsAt)
  const preview = g.type === 'casual' ? await termOfferPreview(p, g.id) : null
  const offer = g.termOffer
  const paidPlaces = everyone.filter((i) => i.status === 'paid' || i.status === 'weekly')
  const proposer = offer?.proposedBy ? everyone.find((i) => i.id === rel(offer.proposedBy)) : null
  const others = everyone.filter((i) => i.id !== invite.id && i.status !== 'declined').map((i) => i.invitee.playerFirstName)
  const size = others.length + 1
  const photo = typeof coach.photo === 'object' ? (coach.photo as Media | null)?.url : null
  const total = due ? due.amount : invite.rateLocked * g.sessionsTotal
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
          <div><dt className="text-muted">Price</dt><dd className="font-semibold">{formatAUD(invite.rateLocked)} a session{g.type === 'term' ? <span className="block font-normal text-muted">{due?.restOfTerm ? `${formatAUD(total)} for the rest of the term (${future.length} sessions, less ${formatAUD(due.credit)} already paid for week 1)` : `${formatAUD(total)} for ${future.length || g.sessionsTotal} sessions`}</span> : null}</dd></div>
        </dl>
      </div>
      <div className="mt-6 border border-line p-6">
        {invite.status === 'paid' || invite.status === 'weekly' ? (
          <p className="font-semibold text-emerald-200">{st.label} — {me}’s place is confirmed.</p>
        ) : invite.status === 'declined' ? (
          <p className="text-muted">You’ve let {coach.displayName} know {me} can’t make it. Thanks for telling us.</p>
        ) : (
          <>
            <p className="font-semibold">
              {g.paymentDeadline && new Date(g.paymentDeadline).getTime() > Date.now()
                ? `Please pay by ${formatDate(g.paymentDeadline, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} to keep ${me}’s place.`
                : `The time to pay has passed, but ${me}’s place is still open — pay now to keep it.`}
            </p>
            {cancelled && <p className="mt-3 text-sm text-amber-200">Payment wasn’t completed — {me}’s place is still waiting for you below.</p>}
            {future.length === 0 ? (
              <p className="mt-3 text-sm text-muted">This group has already started — please contact {coach.displayName}.</p>
            ) : (
              <div className="mt-6">
                <PayForm
                  info={{
                    token,
                    type: g.type,
                    rate: invite.rateLocked,
                    sessions: future.length,
                    weeklyOk: g.type === 'term' && Boolean(weeklyPlan(future)),
                    player: me,
                    needsDob: !kid?.dateOfBirth,
                    mobile: invite.invitee.mobile ?? '',
                    emergencyName: kid?.medical?.emergencyContact ?? '',
                    emergencyPhone: kid?.medical?.emergencyPhone ?? '',
                    credit: due?.credit ?? 0,
                    groupCredits: invite.account ? await creditBalance(p, rel(invite.account)!, undefined, 'group') : 0,
                  }}
                />
                {!due?.restOfTerm && <DeclineForm token={token} player={me} />}
              </div>
            )}
          </>
        )}
      </div>
      {preview && (
        <section aria-label="Book the whole term" className="mt-6 border border-white/30 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">Save {preview.discountPct}%</p>
          <h2 className="mt-2 font-display text-2xl font-semibold uppercase">Book the whole term together</h2>
          <p className="mt-2 text-sm text-white/80">
            Keep this group going: {preview.weekday}s at the same time for the rest of the term — {preview.weeks.length} more weeks at {formatAUD(preview.quote.rate)} a session ({preview.discountPct}% off), with this session as week 1. It only goes ahead if every family says yes.
          </p>
          {unpaid ? (
            <p className="mt-3 text-sm text-muted">Pay for this session first — then you can tell us you’re interested.</p>
          ) : invite.status === 'declined' ? null : g.status !== 'confirmed' ? (
            <p className="mt-3 text-sm text-muted">Once every family has paid for this session, you can ask to book the term.</p>
          ) : offer?.status === 'proposed' ? (
            invite.termAnswer === 'pending' ? (
              <>
                <p className="mt-3 text-sm font-semibold">{proposer ? `${proposer.invitee.playerFirstName}’s family would like to book the term.` : `${coach.displayName} has offered the term.`} Would you like to book it for {me}?{offer.deadline ? ` Please answer by ${formatDate(offer.deadline, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.` : ''}</p>
                <TermOfferForm token={token} mode="answer" />
              </>
            ) : (
              <p className="mt-3 text-sm font-semibold text-emerald-200">You’ve said yes — waiting for the other families ({paidPlaces.filter((i) => i.termAnswer === 'accepted').length} of {paidPlaces.length} have said yes).</p>
            )
          ) : (
            <>
              {(offer?.status === 'declined' || offer?.status === 'expired') && <p className="mt-3 text-sm text-muted">Last time not every family could commit — you can ask again.</p>}
              <TermOfferForm token={token} mode="interested" />
            </>
          )}
        </section>
      )}
      <p className="mt-6 text-xs text-muted">Each family pays for their own player. This link is just for you — please don’t forward it.</p>
    </div></div>
  )
}
