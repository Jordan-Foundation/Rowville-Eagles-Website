import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { birthYearOf, groupLabel } from '@/lib/age-groups'
import type { Participant, PdrChallenge, PdrStage } from '@/payload-types'
import { challengeState, monthLabel } from '@/academy/pdr/challenge-rules'
import { challengeSetupNeeded, nextMonthKey } from '@/academy/pdr/manage-rules'
import { pastDueMembers } from '@/academy/pdr/manage'
import { GRACE_DAYS } from '@/academy/pdr/billing/plans'
import { RemindButton } from './Forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Foundation+', robots: { index: false } }

const h2 = 'font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase'
const stateLabel = { upcoming: 'Upcoming', open: 'Running now', closed: 'Finished' } as const

export default async function FoundationPlusManagement({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireManagement('/management/foundation-plus')
  const sp = await searchParams
  const p = await payload()
  const now = new Date()
  const [{ docs: challenges }, { docs: queue, totalDocs: pending }, pastDue] = await Promise.all([
    p.find({ collection: 'pdr-challenges', sort: '-month', limit: 12, depth: 0, overrideAccess: true }),
    p.find({ collection: 'pdr-submissions', where: { status: { equals: 'pending' } }, sort: 'createdAt', limit: 30, depth: 1, overrideAccess: true }),
    pastDueMembers(p, now),
  ])
  const entries = await Promise.all(challenges.map(async (c) => (await p.count({ collection: 'pdr-submissions', where: { challenge: { equals: c.id } }, overrideAccess: true })).totalDocs))
  const setup = challengeSetupNeeded(challenges, now)
  const next = nextMonthKey(now)
  const nextChallenge = challenges.find((c) => c.month === next)

  return (
    <div className="container-x max-w-5xl py-14">
      <Link href="/management" className="text-sm text-muted hover:text-ink">← Management</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Foundation+</h1>
      <p className="mt-3 text-muted">
        Monthly challenges, video reviews and failed payments. Member numbers, trials, conversion and revenue are in{' '}
        <Link href="/management/programs?program=foundation-plus" className="underline">Programs Overview → Foundation+</Link>.
      </p>
      <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2 text-sm">
        <a href="#challenges" className="rounded-full border border-line px-3 py-1 hover:border-ink">Monthly challenges{setup ? ' ·  ⚠' : ''}</a>
        <a href="#reviews" className="rounded-full border border-line px-3 py-1 hover:border-ink">Video reviews ({pending})</a>
        <a href="#past-due" className="rounded-full border border-line px-3 py-1 hover:border-ink">Past-due payments ({pastDue.length})</a>
      </nav>

      <section id="challenges" className="mt-10 scroll-mt-24" aria-labelledby="h-challenges">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="h-challenges" className={h2}>Monthly challenges</h2>
          <Link href={nextChallenge ? "/management/foundation-plus/challenges/new" : `/management/foundation-plus/challenges/new?month=${next}`} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white">New challenge</Link>
        </div>
        {sp.saved && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Challenge saved.</p>}
        {setup && (
          <p role="alert" className="mt-3 rounded-2xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
            {setup.reason === 'missing'
              ? <>No challenge set up for <strong>{monthLabel(setup.month)}</strong> yet. <Link className="underline" href={`/management/foundation-plus/challenges/new?month=${setup.month}`}>Set it up</Link> so Premium players get the start email on the 1st.</>
              : <><strong>{monthLabel(setup.month)}</strong>’s challenge is still a draft — <Link className="underline" href={`/management/foundation-plus/challenges/${nextChallenge?.id}`}>make it live</Link> before the 1st.</>}
          </p>
        )}
        {challenges.length === 0 ? <p className="mt-3 text-muted">No challenges yet.</p> : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {challenges.map((c: PdrChallenge, i) => {
              const st = challengeState(c.month, now)
              return (
                <li key={c.id}>
                  <Link href={`/management/foundation-plus/challenges/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface-2">
                    <span>
                      <span className="font-semibold">{monthLabel(c.month)} — {c.title}</span>
                      <span className="block text-sm text-muted">{stateLabel[st]} · {entries[i]} entr{entries[i] === 1 ? 'y' : 'ies'}{c.closedAt ? ` · results sent ${formatDate(c.closedAt, { day: 'numeric', month: 'short' })}` : ''}{c.closedAt && !c.prizesSent ? ' · prizes to send' : ''}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.published ? 'bg-emerald-100 text-emerald-900' : 'bg-surface-2 text-muted'}`}>{c.published ? 'Live' : 'Draft'}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section id="reviews" className="mt-12 scroll-mt-24" aria-labelledby="h-reviews">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="h-reviews" className={h2}>Video reviews ({pending})</h2>
          <Link href="/coach/reviews" className="text-sm font-semibold underline">Open the full queue</Link>
        </div>
        <p className="mt-1 text-sm text-muted">Oldest first — the same queue coaches see. Open one to watch it and verify, ask for another go, or give feedback.</p>
        {queue.length === 0 ? <p className="mt-3 rounded-2xl border border-line p-5 text-muted">Nothing waiting.</p> : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {queue.map((d) => {
              const kid = d.player as Participant
              const stage = d.stage as PdrStage | null
              const ch = d.challenge as PdrChallenge | null
              const by = birthYearOf(kid.dateOfBirth)
              const waiting = Math.floor((now.getTime() - Date.parse(d.createdAt)) / 86_400_000)
              return (
                <li key={d.id}>
                  <Link href={`/coach/reviews/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface-2">
                    <span>
                      <span className="font-semibold">{kid.firstName} {kid.lastName}</span> <span className="text-sm text-muted">{by ? groupLabel(by) : ''}</span>
                      <span className="block text-sm text-muted">{stage ? `${stage.code} — ${stage.skillName}` : ch ? `${monthLabel(ch.month)} challenge — ${ch.title}` : ''}</span>
                    </span>
                    <span className={`text-xs ${waiting >= 3 ? 'font-semibold text-red-700' : 'text-muted'}`}>{waiting === 0 ? 'today' : `${waiting} day${waiting === 1 ? '' : 's'} waiting`}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section id="past-due" className="mt-12 scroll-mt-24" aria-labelledby="h-pastdue">
        <h2 id="h-pastdue" className={h2}>Past-due payments ({pastDue.length})</h2>
        <p className="mt-1 text-sm text-muted">Card payments that failed. Stripe keeps retrying and the family was emailed automatically; players keep their plan for {GRACE_DAYS} days, then move to Free (progress is kept). Send a reminder (email + text) at most once a day.</p>
        {pastDue.length === 0 ? <p className="mt-3 rounded-2xl border border-line p-5 text-muted">No failed payments. 🎉</p> : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {pastDue.map((r) => (
              <li key={r.kid.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p><span className="font-semibold">{r.kid.firstName} {r.kid.lastName}</span> <span className="text-sm text-muted">· {r.plan}</span></p>
                  {r.parent && <p className="text-xs text-muted">{[r.parent.firstName, r.parent.lastName].filter(Boolean).join(' ')} · {r.parent.email}{r.parent.phone ? ` · ${r.parent.phone}` : ''}</p>}
                  <p className="mt-1 text-sm">
                    Failing since {r.since ? formatDate(r.since, { day: 'numeric', month: 'short' }) : '—'} ·{' '}
                    <strong className={r.daysLeft <= 2 ? 'text-red-700' : ''}>{r.daysLeft === 0 ? 'moves to Free today' : `${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} left`}</strong>
                  </p>
                </div>
                <div className="sm:text-right">
                  <RemindButton kid={r.kid.id} disabled={!r.canRemind || !r.parent} label={r.canRemind ? 'Send reminder' : 'Sent today'} />
                  {r.remindedAt && <p className="mt-1 text-xs text-muted">Last sent {formatDate(r.remindedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
