import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { Crest } from '@/components/Logos'

export const revalidate = 60
export const metadata: Metadata = {
  title: 'About the Club',
  description: 'Rowville Eagles Football Club — community football in Rowville since 1985. Our history, mission and values.',
}

/* Default copy — shown until the committee edits "About page" in the admin. */
const defaults = {
  intro:
    'Since 1985, Rowville Eagles Football Club has been home to footballers of every age and ability in Rowville and the surrounding community — from first kicks in MiniRoos to senior football every weekend.',
  mission:
    'To give every player in our community the chance to enjoy, learn and excel at football — in a safe, inclusive club where people feel they belong.',
  values: [
    { title: 'Community', text: 'We are a club run by volunteers, for families. Everyone is welcome at the Eagles.' },
    { title: 'Development', text: 'Quality coaching and a clear pathway from MiniRoos to seniors, with the Foundation Academy for those who want more.' },
    { title: 'Respect', text: 'For teammates, opponents, referees, coaches and parents — on and off the pitch.' },
    { title: 'Pride', text: 'We wear the crest with pride and represent Rowville the right way.' },
  ],
  historyIntro:
    'Founded in 1985, the Eagles have grown from humble beginnings into one of Rowville’s community sporting hubs, built on decades of volunteers, players and families.',
  milestones: [
    { year: '1985', title: 'The club is founded', text: 'Rowville Eagles Football Club is established.' },
    { year: 'Today', title: 'A club for everyone', text: '12–16 MiniRoos teams, Senior Men, Men’s Reserves and Senior Women — with junior boys and girls teams on the way.' },
    { year: '2027', title: 'Rowville Foundation Academy', text: 'The club launches the RFA, an elite development pathway for committed players.' },
  ],
  childSafe:
    'Rowville Eagles is committed to the safety and wellbeing of every child and young person. All coaches and volunteers working with children hold a valid Working With Children Check, and we follow the Victorian Child Safe Standards.',
}

export default async function AboutPage() {
  const about = await (await payload()).findGlobal({ slug: 'about' })
  const c = {
    intro: about.intro || defaults.intro,
    mission: about.mission || defaults.mission,
    values: about.values?.length ? about.values : defaults.values,
    historyIntro: about.historyIntro || defaults.historyIntro,
    milestones: about.milestones?.length ? about.milestones : defaults.milestones,
    childSafe: about.childSafe || defaults.childSafe,
  }

  return (
    <>
      {/* HERO */}
      <section className="pitch-lines relative overflow-hidden bg-[#0f2a55] text-white">
        <div className="absolute inset-0 bg-linear-to-br from-[#1d4888]/80 via-transparent to-black/40" />
        <div className="container-x relative grid items-center gap-12 py-20 md:py-28 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="eyebrow">Our club · Est. 1985</p>
            <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-[0.92] sm:text-7xl">
              More than
              <br />
              <span className="text-accent">a football club.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/75">{c.intro}</p>
          </div>
          <div className="hidden justify-center lg:flex">
            <Crest className="h-80 w-auto drop-shadow-2xl" />
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section className="container-x py-20 md:py-28">
        <p className="eyebrow !text-brand">Our mission</p>
        <blockquote className="mt-6 max-w-4xl font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase leading-tight sm:text-5xl">
          “{c.mission}”
        </blockquote>
      </section>

      {/* VALUES */}
      <section className="bg-surface-2 py-20">
        <div className="container-x">
          <p className="eyebrow !text-brand">What we’re all about</p>
          <h2 className="mt-3 font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase sm:text-5xl">Our values</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.values.map((v, i) => (
              <div key={v.title} className="rounded-2xl border-t-4 border-accent bg-surface p-7 shadow-sm">
                <span className="font-[family-name:var(--font-barlow)] text-5xl font-extrabold text-brand/15">0{i + 1}</span>
                <h3 className="mt-2 font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{v.title}</h3>
                <p className="mt-2 text-muted">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HISTORY */}
      <section className="container-x grid gap-12 py-20 md:py-28 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="eyebrow !text-brand">Our history</p>
          <h2 className="mt-3 font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase sm:text-5xl">Since 1985</h2>
          <p className="mt-5 text-lg text-muted">{c.historyIntro}</p>
        </div>
        <ol className="relative border-l-2 border-line pl-8">
          {c.milestones.map((m) => (
            <li key={`${m.year}-${m.title}`} className="relative pb-10 last:pb-0">
              <span className="absolute -left-[2.6rem] top-1 grid h-5 w-5 place-items-center rounded-full border-4 border-surface bg-accent" aria-hidden />
              <p className="font-[family-name:var(--font-barlow)] text-xl font-bold text-brand">{m.year}</p>
              <h3 className="text-xl font-semibold">{m.title}</h3>
              {m.text && <p className="mt-1 text-muted">{m.text}</p>}
            </li>
          ))}
        </ol>
      </section>

      {/* CHILD SAFE + CTA */}
      <section className="bg-[#0f2a55] text-white">
        <div className="container-x grid gap-10 py-16 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">A Child Safe club</h2>
            <p className="mt-3 text-white/75">{c.childSafe}</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link href="/join" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink hover:brightness-110">Join us</Link>
            <Link href="/fixtures" className="rounded-full border border-white/30 px-6 py-3 font-semibold hover:bg-white/10">Our teams & fixtures</Link>
          </div>
        </div>
      </section>
    </>
  )
}
