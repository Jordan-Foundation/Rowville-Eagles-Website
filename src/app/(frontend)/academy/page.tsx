import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { programTypes } from '@/collections/Programs'

export const revalidate = 60
export const metadata: Metadata = {
  title: 'Foundation Academy',
  description: 'The Rowville Eagles Foundation Academy — elite player development, term programs, trials and 1-on-1 coaching.',
}

const pillars = [
  { n: 'I', t: 'Technical mastery', d: 'Ball mastery, first touch and finishing built through high-repetition, game-realistic sessions.' },
  { n: 'II', t: 'Tactical intelligence', d: 'Scanning, decision-making and positional play taught with video analysis.' },
  { n: 'III', t: 'Athletic development', d: 'Age-appropriate speed, agility and injury-prevention work.' },
  { n: 'IV', t: 'Character', d: 'Resilience, leadership and the habits that separate good players from great ones.' },
]

export default async function AcademyPage() {
  const { docs } = await (await payload()).find({
    collection: 'programs',
    where: { brand: { equals: 'academy' }, status: { in: ['open', 'full'] } },
    depth: 0,
  })

  return (
    <div data-brand="academy">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(200,169,106,0.18),transparent_65%)]" />
        <div className="container-x relative py-28 md:py-40">
          <p className="eyebrow">Rowville Eagles · Elite Development</p>
          <h1 className="mt-6 font-display text-6xl font-semibold leading-[0.95] sm:text-8xl">
            Foundation
            <br />
            <em className="font-medium text-accent">Academy</em>
          </h1>
          <div className="mt-8 h-px w-24 bg-accent" />
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
            An elite development environment for players who want more. Small groups, specialist coaches and an individual plan for
            every athlete.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#programs" className="bg-accent px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent-ink transition hover:brightness-110">
              Book a trial
            </a>
            <a href="#programs" className="border border-line px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] transition hover:border-accent hover:text-accent">
              Term programs
            </a>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="container-x py-24">
        <p className="eyebrow">The method</p>
        <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold sm:text-5xl">Four pillars of player development</h2>
        <div className="mt-14 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <div key={p.n} className="bg-surface p-8">
              <span className="font-display text-3xl italic text-accent">{p.n}</span>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.18em]">{p.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROGRAMS */}
      <section id="programs" className="border-t border-line bg-surface-2 py-24">
        <div className="container-x">
          <p className="eyebrow">Programs</p>
          <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">Begin your journey</h2>
          <div className="mt-12 divide-y divide-line border-y border-line">
            {docs.map((p) => (
              <Link key={p.id} href={`/programs/${p.slug}`} className="group grid gap-4 py-8 md:grid-cols-[1fr_2fr_auto] md:items-center">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">{programTypes.find((t) => t.value === p.type)?.label}</p>
                  <h3 className="mt-2 font-display text-3xl font-semibold transition group-hover:text-accent">{p.title}</h3>
                </div>
                <div className="text-sm text-muted">
                  <p>{p.summary}</p>
                  <p className="mt-2 text-xs uppercase tracking-wider">
                    {[p.ageRange, p.scheduleNote, p.startDate && `From ${formatDate(p.startDate)}`].filter(Boolean).join('  ·  ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl">{formatAUD(p.price)}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Enquire →</p>
                </div>
              </Link>
            ))}
            {docs.length === 0 && <p className="py-8 text-muted">New Academy programs will be announced soon.</p>}
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section className="container-x py-28 text-center">
        <p className="mx-auto max-w-3xl font-display text-3xl italic leading-snug sm:text-4xl">
          “Talent sets the floor. The environment sets the ceiling.”
        </p>
        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-muted">Foundation Academy philosophy</p>
      </section>
    </div>
  )
}
