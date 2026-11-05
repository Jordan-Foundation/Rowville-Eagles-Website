import Link from 'next/link'
import { payload, formatDate } from '@/lib/payload'
import { ProgramCard } from '@/components/ProgramCard'
import { Crest } from '@/components/Crest'

export const revalidate = 60

const pathway = [
  { stage: 'MiniRoos', ages: 'U5 – U11', copy: 'Small-sided, fun-first football where every child gets touches, goals and confidence.' },
  { stage: 'Juniors', ages: 'U12 – U18', copy: 'Boys and girls competitive football with qualified coaches and a clear development plan.' },
  { stage: 'Seniors', ages: '18+', copy: 'Senior Men, Men’s Reserves and Senior Women representing Rowville every weekend.' },
]

export default async function Home() {
  const p = await payload()
  const [programs, posts, sponsors] = await Promise.all([
    p.find({ collection: 'programs', where: { status: { equals: 'open' }, brand: { equals: 'club' } }, limit: 3, depth: 0 }),
    p.find({ collection: 'posts', where: { status: { equals: 'published' } }, limit: 3, depth: 0 }),
    p.find({ collection: 'sponsors', limit: 12, depth: 0 }),
  ])

  return (
    <>
      {/* HERO */}
      <section className="pitch-lines relative overflow-hidden bg-[#0a1a3d] text-white">
        <div className="absolute inset-0 bg-linear-to-br from-[#12306b]/80 via-transparent to-black/40" />
        <div className="container-x relative grid gap-12 py-24 md:py-32 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow">Rowville · Victoria</p>
            <h1 className="mt-5 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
              Soar together.
              <br />
              <span className="text-accent">Play for the Eagles.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/75">
              From first kicks in MiniRoos to Saturday afternoons with the seniors — a home for every player in Rowville.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/programs?type=registration" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition hover:brightness-110">
                Register for 2027
              </Link>
              <Link href="/teams" className="rounded-full border border-white/30 px-6 py-3 font-semibold transition hover:border-white hover:bg-white/10">
                Find your team
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: '12–16', v: 'MiniRoos teams' },
              { k: '3', v: 'Senior squads' },
              { k: 'Boys & Girls', v: 'Junior pathway' },
              { k: 'Academy', v: 'Elite development' },
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
            { href: '/programs?type=registration', t: 'Season registration', d: 'Pay club fees online' },
            { href: '/programs?type=holiday-camp', t: 'Holiday camps', d: 'School holiday clinics' },
            { href: '/fixtures', t: 'Fixtures & results', d: 'Every team, every round' },
            { href: '/academy', t: 'Book a trial', d: 'Foundation Academy' },
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
                <h2 className="mt-3 font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase sm:text-5xl">Camps, clinics & registrations</h2>
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
        <div className="container-x grid gap-10 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">Foundation Academy</p>
            <h2 className="mt-4 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">
              Where ambition
              <br />
              <em className="text-accent">meets expertise.</em>
            </h2>
          </div>
          <div>
            <p className="text-lg text-muted">
              Our elite development program for committed players — small groups, specialist coaching, individual development plans and
              video-led feedback.
            </p>
            <Link href="/academy" className="mt-8 inline-block border border-accent px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent transition hover:bg-accent hover:text-accent-ink">
              Discover the Academy
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
                <div className="pitch-lines grid aspect-[16/10] place-items-center overflow-hidden rounded-2xl bg-[#12306b] transition group-hover:bg-[#0a1a3d]">
                  <Crest className="h-16 w-14 opacity-90" />
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
        <section className="border-t border-line py-16">
          <div className="container-x text-center">
            <p className="eyebrow !text-muted">Proudly supported by</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {sponsors.docs.map((s) => (
                <a key={s.id} href={s.website || '#'} className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase text-muted/70 transition hover:text-ink">
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
