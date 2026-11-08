import { PriceTag } from '@/components/PriceTag'
import { DashIcon } from '@/components/dashboard/icons'
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { openTerms } from '@/academy/booking-data'
import { FoundationMark, RfaLogo } from '@/components/Logos'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'

export const revalidate = 600
export const metadata: Metadata = {
  title: 'Rowville Foundation Academy',
  description: 'RFA — elite player development at Rowville Eagles: term programs, trials, 1-on-1 coaching, holiday camps and tournaments.',
}

/** The six pillars = the six strands of the Foundation Football Curriculum (wording to check: Setup checklist). */
const pillars = [
  { t: 'Attacking', icon: 'target', d: 'Dribbling with both feet, 1v1 courage, finishing and creating chances — at match speed.' },
  { t: 'Defending', icon: 'shield', d: 'Winning the ball back: goal-side positioning, pressing, tackling and defending as a unit.' },
  { t: 'Physical', icon: 'bolt', d: 'Agility, balance, coordination and speed built through games, with injury prevention as players grow.' },
  { t: 'Passing & Receiving', icon: 'arrows', d: 'A first touch that sets up the next action, scanning before the ball arrives and a growing passing range.' },
  { t: 'Tactical', icon: 'board', d: 'Understanding the game: space, positions and transitions, and making better decisions every year.' },
  { t: 'Character', icon: 'heart', d: 'Resilience, respect, teamwork and leadership — the habits that make great teammates and players.' },
]

const steps = [
  { t: 'Book a trial', d: 'Train with the group and meet the coaching team.' },
  { t: 'Assess & plan', d: 'We benchmark your player and set individual development goals.' },
  { t: 'Train & track', d: 'Sessions, feedback and progress — all in your player portal.' },
]


export default async function AcademyPage() {
  // Always three choices: the current/next Academy term, the next holiday camp, and 1-on-1 coaching
  const p = await payload()
  const nowIso = new Date().toISOString()
  const [{ docs: terms }, { docs: camps }, oneOnOneTerms] = await Promise.all([
    p.find({ pagination: false, collection: 'programs', where: { type: { equals: 'academy-term' }, status: { in: ['open', 'full'] }, or: [{ endDate: { greater_than: nowIso } }, { endDate: { exists: false } }] }, sort: 'startDate', depth: 0, limit: 1 }),
    p.find({ pagination: false, collection: 'programs', where: { type: { equals: 'holiday-camp' }, status: { in: ['open', 'full'] }, or: [{ endDate: { greater_than: nowIso } }, { and: [{ endDate: { exists: false } }, { startDate: { greater_than: nowIso } }] }] }, sort: 'startDate', depth: 0, limit: 1 }),
    openTerms(p),
  ])
  const oneTerm = oneOnOneTerms[0]
  const oneFrom = oneTerm ? Math.min(...[oneTerm.pricePerSession, oneTerm.casualPrice].filter((x): x is number => typeof x === 'number')) : null
  const choices = [
    ...terms.map((t) => ({ key: 'term', eyebrow: 'Academy term', title: t.title, summary: t.summary ?? '', meta: [t.ageRange, t.scheduleNote, t.startDate && formatDate(t.startDate)], price: <PriceTag p={t} big="font-display text-3xl" />, href: `/programs/${t.slug}`, cta: t.status === 'full' ? 'Details & waitlist →' : 'Details & book →' })),
    ...camps.map((c) => ({ key: 'camp', eyebrow: 'Holiday camp', title: c.title, summary: c.summary ?? '', meta: [c.ageRange, c.scheduleNote, c.startDate && formatDate(c.startDate)], price: <PriceTag p={c} big="font-display text-3xl" />, href: `/programs/${c.slug}`, cta: c.status === 'full' ? 'Details & waitlist →' : 'Details & book →' })),
    {
      key: '1on1',
      eyebrow: '1-on-1 coaching',
      title: '1-on-1 sessions',
      summary: 'Personalised sessions with an Academy coach — book a casual session or the same time every week for the term.',
      meta: [oneTerm ? `${oneTerm.sessionMinutes} minutes` : null, 'Choose your coach & time'],
      price: oneFrom != null ? (
        <span className="inline-flex items-baseline gap-1"><span className="text-xs font-medium uppercase tracking-wider opacity-70">from</span><span className="font-display text-3xl font-semibold leading-none">{formatAUD(oneFrom)}</span><span className="text-xs font-medium opacity-70">/ session</span></span>
      ) : null,
      href: '/academy/1-on-1',
      cta: 'Details & book →',
    },
  ]

  return (
    <div data-brand="academy" data-page-brand="academy" className="font-[family-name:var(--font-inter)]">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <AcademyBackdrop />
        <div className="container-x relative py-24 md:py-36">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted">Rowville Eagles · Elite Development</p>
          <RfaLogo className="mt-8 h-20 w-auto sm:h-28" ink="#fff" paper="#000" />
          <h1 className="mt-10 max-w-3xl font-display text-5xl font-semibold uppercase leading-[0.95] tracking-tight sm:text-7xl">
            Built for the
            <br />
            <span className="bg-linear-to-r from-white via-[#b9bbc0] to-[#5d5f64] bg-clip-text text-transparent">next level.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
            The Rowville Foundation Academy is our high-performance environment for committed players — small groups, specialist
            coaches and an individual plan for every athlete.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="/academy/trial" className="bg-white px-7 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white/85">
              Book a trial
            </a>
            <a href="/academy/1-on-1" className="border border-white/25 px-7 py-4 text-sm font-semibold uppercase tracking-[0.18em] transition hover:border-white">
              Book a 1-on-1
            </a>
          </div>
        </div>
      </section>

      {/* VALUE STRIP */}
      <section className="border-b border-line bg-surface-2">
        <div className="container-x grid grid-cols-2 divide-line text-center text-xs font-semibold uppercase tracking-[0.25em] text-muted md:grid-cols-4 md:divide-x">
          {['Small groups', 'Specialist coaches', 'Individual plans', 'Video analysis'].map((v) => (
            <p key={v} className="py-6">{v}</p>
          ))}
        </div>
      </section>

      {/* PILLARS */}
      <section className="container-x py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted">The method</p>
            <h2 className="mt-4 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Six pillars</h2>
          </div>
          <p className="max-w-md text-muted">Every session, every term and every 1-on-1 follows our football curriculum — the same six strands players are reported on.</p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p, i) => (
            <div key={p.t} className="gloss gloss-sheen rounded-sm p-8">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold text-muted">0{i + 1}</span>
                <DashIcon name={p.icon} className="h-6 w-6" />
              </div>
              <h3 className="mt-14 font-display text-2xl font-semibold uppercase tracking-tight">{p.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROGRAMS */}
      <section id="programs" className="scroll-mt-20 border-t border-line bg-surface-2 py-24">
        <div className="container-x">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted">Programs</p>
          <h2 className="mt-4 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Choose your program</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {choices.map((c) => (
              <Link key={c.key} href={c.href} className="gloss gloss-sheen group flex flex-col rounded-sm p-7 transition hover:border-white/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">{c.eyebrow}</p>
                <h3 className="mt-4 font-display text-2xl font-semibold uppercase leading-tight tracking-tight">{c.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{c.summary}</p>
                <p className="mt-5 text-xs uppercase tracking-wider text-muted">{c.meta.filter(Boolean).join('  ·  ')}</p>
                <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
                  {c.price}
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] transition group-hover:translate-x-1">{c.cta}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container-x py-24">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted">How it works</p>
        <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.t} className="bg-surface p-8">
              <span className="font-display text-6xl font-bold text-white/10">{i + 1}</span>
              <h3 className="mt-4 font-display text-xl font-semibold uppercase">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line">
        <div className="container-x flex flex-col items-center py-24 text-center">
          <FoundationMark className="h-14 w-auto" ink="#fff" />
          <h2 className="mt-8 max-w-2xl font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Your foundation starts here</h2>
          <a href="/academy/trial" className="mt-10 bg-white px-8 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white/85">
            Book a trial session
          </a>
        </div>
      </section>
    </div>
  )
}
