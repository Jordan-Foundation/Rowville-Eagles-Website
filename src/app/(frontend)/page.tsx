import Link from 'next/link'
import { payload, formatDate } from '@/lib/payload'
import { ProgramCard } from '@/components/ProgramCard'
import { Crest, RfaLogo } from '@/components/Logos'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { SponsorCard } from '@/components/SponsorLogo'
import { currentSeason } from '@/lib/age-groups'

export const revalidate = 60

const pathway = [
  { stage: 'MiniRoos', ages: 'U5 – U11', copy: 'Small-sided, fun-first football where every child gets touches, goals and confidence.' },
  { stage: 'Juniors', ages: 'U12 – U18', copy: 'Boys and girls competitive football with qualified coaches and a clear development plan.' },
  { stage: 'Seniors', ages: '18+', copy: 'Senior Men, Men’s Reserves and Senior Women representing Rowville every weekend.' },
]

export default async function Home() {
  const p = await payload()
  const [settings, others, posts, sponsors] = await Promise.all([
    p.findGlobal({ slug: 'site-settings', depth: 0 }),
    p.find({ collection: 'programs', where: { status: { equals: 'open' }, type: { not_in: ['registration', 'academy-trial', 'private-session'] } }, limit: 3, depth: 0, sort: 'startDate' }),
    p.find({ collection: 'posts', where: { status: { equals: 'published' } }, limit: 3, depth: 0 }),
    p.find({ collection: 'sponsors', limit: 20, depth: 1, sort: 'order' }),
  ])
  const programs = others
  const season = currentSeason(settings.season)

  return (
    <>
      {/* HERO */}
      <section className="pitch-lines relative overflow-hidden bg-[#0f2a55] text-white">
        <div className="absolute inset-0 bg-linear-to-br from-[#1d4888]/80 via-transparent to-black/40" />
        <div className="container-x relative grid gap-12 py-24 md:py-32 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow">Rowville · Victoria · Est. 1985</p>
            <h1 className="mt-5 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
              Soar together.
              <br />
              <span className="text-accent">Play for the Eagles.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/75">
              From first kicks in MiniRoos to Saturday afternoons with the seniors — a home for every player in Rowville.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/join" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition hover:brightness-110">
                Join us for {season}
              </Link>
              <Link href="/fixtures" className="rounded-full border border-white/30 px-6 py-3 font-semibold transition hover:border-white hover:bg-white/10">
                Find your team
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: '12–16', v: 'MiniRoos teams' },
              { k: '3', v: 'Senior squads' },
              { k: 'Boys & Girls', v: 'Junior pathway' },
              { k: 'Since 1985', v: 'Proudly community' },
            ].map((s) => (
              <div key={s.v} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="font-[family-name:var(--font-barlow)] text-3xl font-bold text-white">{s.k}</div>
                <div className="mt-1 text-sm text-white/60">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="border-b border-line bg-surface">
        <div className="container-x grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {[
            { href: '/join', t: `Join us for ${season}`, d: 'Book a trial or register interest' },
            { href: '/programs?type=holiday-camp', t: 'Holiday camps', d: 'School holiday clinics' },
            { href: '/fixtures', t: 'Fixtures & results', d: 'Every team, every round' },
            { href: '/academy', t: 'Academy trials', d: 'Rowville Foundation Academy' },
          ].map((a) => (
            <Link key={a.t} href={a.href} className="group px-2 py-6 sm:px-6">
              <div className="font-semibold group-hover:text-brand">{a.t} →</div>
              <div className="text-sm text-muted">{a.d}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* PATHWAY */}
      <section className="container-x py-20">
        <p className="eyebrow !text-brand">Player pathway</p>
        <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase sm:text-5xl">A place for every age and every level</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {pathway.map((s, i) => (
            <div key={s.stage} className="relative rounded-2xl bg-surface-2 p-7">
              <span className="font-[family-name:var(--font-barlow)] text-6xl font-extrabold text-brand/10">0{i + 1}</span>
              <h3 className="mt-2 font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">{s.stage}</h3>
              <p className="text-sm font-semibold text-brand">{s.ages}</p>
              <p className="mt-3 text-muted">{s.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROGRAMS */}
      {programs.docs.length > 0 && (
        <section className="bg-surface-2 py-20">
          <div className="container-x">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow !text-brand">Book now</p>
                <h2 className="mt-3 font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase sm:text-5xl">Camps, clinics & programs</h2>
              </div>
              <Link href="/programs" className="font-semibold text-brand hover:underline">All programs →</Link>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {programs.docs.map((pr) => <ProgramCard key={pr.id} p={pr} />)}
            </div>
          </div>
        </section>
      )}

      {/* ACADEMY TEASER */}
      <section data-brand="academy" className="relative overflow-hidden">
        <AcademyBackdrop size="md" />
        <div className="container-x relative grid gap-10 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <RfaLogo className="h-16 w-auto sm:h-20" ink="#fff" paper="#000" />
            <h2 className="mt-8 font-display text-4xl font-semibold uppercase leading-[0.95] tracking-tight sm:text-6xl">
              Rowville Foundation
              <br />
              <span className="text-muted">Academy</span>
            </h2>
          </div>
          <div>
            <p className="text-lg text-muted">
              Elite development for committed players — term programs, 1-on-1 coaching, holiday camps and tournaments, with an individual
              plan for every athlete.
            </p>
            <Link href="/academy" className="mt-8 mr-3 inline-block bg-white px-7 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white/85">
              Explore the Academy
            </Link>
            <Link href="/academy/trial" className="mt-8 inline-block border border-white/30 px-7 py-4 text-sm font-semibold uppercase tracking-[0.18em] transition hover:border-white">
              Book a trial
            </Link>
          </div>
        </div>
      </section>

      {/* NEWS */}
      {posts.docs.length > 0 && (
        <section className="container-x py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase sm:text-5xl">Latest news</h2>
            <Link href="/news" className="font-semibold text-brand hover:underline">All news →</Link>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {posts.docs.map((post) => (
              <Link key={post.id} href={`/news/${post.slug}`} className="group">
                <div className="pitch-lines grid aspect-[16/10] place-items-center overflow-hidden rounded-2xl bg-[#1d4888] transition group-hover:bg-[#0f2a55]">
                  <Crest className="h-20 w-auto opacity-95" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-brand">
                  {post.category} · {formatDate(post.publishedAt)}
                </p>
                <h3 className="mt-2 text-xl font-semibold group-hover:text-brand">{post.title}</h3>
                <p className="mt-2 text-sm text-muted">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* SPONSORS */}
      {sponsors.docs.length > 0 && (
        <section className="border-t border-line bg-surface-2 py-16">
          <div className="container-x">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow !text-brand">Proudly supported by</p>
                <h2 className="mt-3 font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase">Our sponsors</h2>
              </div>
              <Link href="/sponsors" className="font-semibold text-brand hover:underline">All sponsors & partnering →</Link>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {sponsors.docs.map((s) => <SponsorCard key={s.id} sponsor={s} />)}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
