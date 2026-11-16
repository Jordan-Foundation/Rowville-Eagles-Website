import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { formatMoney } from '@/lib/format'
import { localYmd } from '@/lib/time'
import { hasRole } from '@/access'
import { coachStatus, STATUS_LABEL, type CoachStatus } from '@/lib/coach-signup'
import { ratesByCoach } from '@/finance/pay'
import { rateOn } from '@/finance/rules'
import { addCoach, coachAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Coaches', robots: { index: false } }

const ORDER: CoachStatus[] = ['to-check', 'expired', 'wwcc-needed', 'invited', 'not-invited', 'expiring', 'ready']
const TONE: Partial<Record<CoachStatus, string>> = { 'to-check': 'text-amber-300', expired: 'text-red-300', expiring: 'text-amber-300', ready: 'text-emerald-300' }
const input = 'min-h-10 w-full border border-line bg-surface px-2 text-sm'
const btn = 'min-h-9 border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em]'

/** Add coaches (name, mobile, email → sign-up link), check their WWCC, see who's ready. */
export default async function CoachesPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const me = await requireManagement('/management/coaches')
  const sp = await searchParams
  const admin = hasRole(me, 'admin')
  const p = await payload()
  const today = localYmd(new Date())
  const [{ docs: users }, { docs: profiles }, rates] = await Promise.all([
    p.find({ collection: 'users', where: { roles: { contains: 'coach' } }, limit: 500, pagination: false, depth: 1, overrideAccess: true, sort: 'firstName' }),
    p.find({ collection: 'academy-coaches', limit: 500, pagination: false, depth: 0, overrideAccess: true }),
    admin ? ratesByCoach(p) : Promise.resolve(new Map()),
  ])
  const profileOf = new Map(profiles.map((c) => [typeof c.user === 'object' ? c.user?.id : c.user, c]))
  const rows = users.map((u) => ({ u, status: coachStatus(u, today), profile: profileOf.get(u.id) })).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))
  const toCheck = rows.filter((r) => r.status === 'to-check').length
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Coaches</h1>
        <p className="mt-2 max-w-3xl text-muted">Add a coach with their name, mobile and email — they get a private link by email and text to create their account and send their Working With Children Check (number, expiry and a photo of the card). Check the card with Service Victoria, then tick it off here; families can book a coach once their WWCC is checked.{admin ? ' Set their pay in Finance.' : ''}</p>
      </div>
      {sp.done && <p role="status" className="border border-line bg-white/5 p-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{sp.error}</p>}

      <form action={addCoach} className="panel grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto] lg:items-end" aria-label="Add a coach">
        <h2 className="font-semibold sm:col-span-2 lg:col-span-5">Add a coach</h2>
        <label className="grid gap-1 text-sm">First name<input name="firstName" required autoComplete="off" className={input} /></label>
        <label className="grid gap-1 text-sm">Last name<input name="lastName" required autoComplete="off" className={input} /></label>
        <label className="grid gap-1 text-sm">Mobile<input name="mobile" type="tel" required placeholder="0412 345 678" autoComplete="off" className={input} /></label>
        <label className="grid gap-1 text-sm">Email<input name="email" type="email" required autoComplete="off" className={input} /></label>
        <button className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">Send sign-up link</button>
      </form>

      <p className="text-sm text-muted">{rows.length} coach{rows.length === 1 ? '' : 'es'}{toCheck ? ` · ${toCheck} WWCC to check` : ''}</p>
      <ul className="divide-y divide-line border border-line" aria-label="Coaches">
        {rows.map(({ u, status, profile }) => {
          const w = u.wwcc ?? {}
          const card = typeof w.photo === 'object' && w.photo ? w.photo : null
          const rate = admin && profile ? rateOn(rates.get(profile.id) ?? [], today) : null
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
          return (
            <li key={u.id} className="grid gap-3 p-4 md:grid-cols-[1.3fr_1.2fr_auto] md:items-center" data-coach-row={u.email}>
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-sm text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                <p className={`text-sm font-semibold ${TONE[status] ?? ''}`} data-status={status}>{STATUS_LABEL[status]}{status === 'invited' && u.coachInvitedAt ? ` ${formatDate(u.coachInvitedAt, { day: 'numeric', month: 'short' })}` : ''}</p>
              </div>
              <div className="text-sm">
                {w.number ? (
                  <>
                    <p>WWCC <strong>{w.number}</strong>{w.expiry ? ` · expires ${formatDate(w.expiry, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
                    <p className="text-muted">{card?.url ? <a href={card.url} target="_blank" rel="noreferrer" className="underline">View card photo</a> : 'No card photo'}{w.checkedAt ? ` · checked ${formatDate(w.checkedAt, { day: 'numeric', month: 'short' })}` : ''}</p>
                  </>
                ) : <p className="text-muted">No WWCC yet</p>}
                <p className="text-muted">{profile?.active ? 'Shown to families' : 'Hidden from families'}{admin ? <> · {rate !== null ? `${formatMoney(rate)}/h` : 'No pay rate'} · <Link href={`/management/finance/coaches${profile ? `?coach=${profile.id}` : ''}`} className="underline">Set pay</Link></> : null}</p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {(status === 'to-check' || (w.number && card && !w.checkedAt && status !== 'expired')) && (
                  <form action={coachAction}><input type="hidden" name="user" value={u.id} /><input type="hidden" name="op" value="checked" /><button className="min-h-9 bg-white px-3 text-xs font-semibold uppercase tracking-[0.1em] text-black">WWCC checked</button></form>
                )}
                {['not-invited', 'invited', 'wwcc-needed', 'expired'].includes(status) && (
                  <form action={coachAction}><input type="hidden" name="user" value={u.id} /><input type="hidden" name="op" value="resend" /><button className={btn}>{status === 'not-invited' ? 'Send sign-up link' : 'Resend link'}</button></form>
                )}
              </div>
            </li>
          )
        })}
        {!rows.length && <li className="p-4 text-sm text-muted">No coaches yet — add one above.</li>}
      </ul>
      <p className="text-xs text-muted">Check a card at service.vic.gov.au (“Check a Working with Children Check”) using the card number and the coach’s surname. A coach who sends a new card is checked again. Profile photo and bio: the coach adds these in their portal (My profile).</p>
    </div>
  )
}
