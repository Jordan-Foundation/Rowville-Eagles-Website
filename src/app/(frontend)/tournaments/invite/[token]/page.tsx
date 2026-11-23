import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { inviteByToken, squadLimit } from '@/tournaments/service'
import { answerInvite } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tournament invite', robots: { index: false } }

const STATUS: Record<string, string> = {
  invited: 'Waiting for your reply',
  accepted: 'Accepted — fee to pay to confirm the place',
  paid: 'Confirmed — see you there!',
  declined: 'Declined',
  expired: 'The reply deadline has passed',
  withdrawn: 'Withdrawn',
}

/** Accept / decline an RFA tournament invite (from the email or the family's account). */
export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ a?: string; done?: string; error?: string }> }) {
  const { token } = await params
  const sp = await searchParams
  const found = await inviteByToken(await payload(), token)
  if (!found) notFound()
  const { inv, t, s } = found
  const first = (inv.playerName ?? '').split(' ')[0]
  const open = inv.status === 'invited' && new Date(t.rsvpDeadline) > new Date()
  const rows: [string, string | null | undefined][] = [
    ['Squad', s.name],
    ['When', t.endDate && t.endDate.slice(0, 10) !== t.startDate.slice(0, 10) ? `${formatDate(t.startDate, { weekday: 'short', day: 'numeric', month: 'short' })} – ${formatDate(t.endDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}` : formatDate(t.startDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
    ['Arrive', t.arrivalTime],
    ['Where', t.venue],
    ['Age group', t.ageGroups],
    ['Squad size', String(squadLimit(t, s))],
    ['Fee', t.fee ? `$${t.fee.toFixed(2)}` : 'No fee'],
    ['Reply by', formatDate(t.rsvpDeadline, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })],
  ]
  return (
    <div data-brand="academy" data-page-brand="academy" className="min-h-[70vh]">
      <div className="container-x max-w-2xl py-14">
        <p className="eyebrow">Rowville Foundation Academy · Tournament</p>
        <h1 className="mt-3 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{t.name}</h1>
        <p className="mt-3 text-lg text-muted">{first} is invited to play in {s.name}.</p>
        {sp.error && <p role="alert" className="mt-6 border border-red-500/60 p-4 text-sm">{sp.error}</p>}
        {sp.done === 'declined' && <p role="status" className="mt-6 border border-line p-4 text-sm">Thanks for letting us know — {first} won’t be in the squad this time.</p>}
        {sp.done === 'paid' && <p role="status" className="mt-6 border border-emerald-500/60 p-4 text-sm">You’re in! {first}’s place is confirmed — it’s on your account’s home page.</p>}
        <p className="mt-6 text-sm" data-invite-status={inv.status}><span className="text-muted">Status:</span> <strong>{STATUS[inv.status] ?? inv.status}</strong></p>
        <dl className="mt-4 divide-y divide-line border border-line text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
        </dl>
        {t.whatToBring && <div className="mt-6"><h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">What to bring</h2><p className="mt-1 whitespace-pre-line">{t.whatToBring}</p></div>}
        {t.details && <p className="mt-4 whitespace-pre-line text-sm text-muted">{t.details}</p>}
        {open ? (
          <form action={answerInvite} className="mt-8 flex flex-wrap gap-3">
            <input type="hidden" name="token" value={token} />
            <button name="answer" value="accept" className={`min-h-12 px-8 text-sm font-semibold uppercase tracking-[0.15em] ${sp.a === 'decline' ? 'border border-line' : 'bg-white text-black'}`}>{t.fee ? `Accept & pay $${t.fee.toFixed(2)}` : 'Accept'}</button>
            <button name="answer" value="decline" className={`min-h-12 px-8 text-sm font-semibold uppercase tracking-[0.15em] ${sp.a === 'decline' ? 'bg-white text-black' : 'border border-line'}`}>Decline</button>
          </form>
        ) : inv.status === 'accepted' ? (
          <form action={answerInvite} className="mt-8"><input type="hidden" name="token" value={token} /><button name="answer" value="accept" className="min-h-12 bg-white px-8 text-sm font-semibold uppercase tracking-[0.15em] text-black">Pay ${t.fee?.toFixed(2)} to confirm</button></form>
        ) : null}
        {t.fee ? <p className="mt-3 text-xs text-muted">Accepting takes you to payment. {first}’s place is confirmed once the fee is paid.</p> : null}
        <p className="mt-10 text-sm"><Link href="/account" className="underline">My account</Link></p>
      </div>
    </div>
  )
}
