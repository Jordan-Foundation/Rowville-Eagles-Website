import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { getAgeRules } from '@/lib/age-rules'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Join us',
  description: 'Play for Rowville Eagles — juniors (U6–U18: MiniRoos and junior teams) or seniors and reserves (Senior Men, Reserves and Senior Women). U16–U18 players can choose either.',
}

const cards = [
  {
    key: 'juniors',
    href: '/join/juniors',
    eyebrow: 'U6–U18',
    title: 'Juniors',
    text: 'MiniRoos and junior teams for boys and girls. Register for a trial night and we’ll place your player in a team.',
    points: ['MiniRoos (U6–U11) and juniors (U12–U18)', 'Pick a trial night, or register interest', 'U16–U18: juniors or seniors — your choice'],
    cta: 'Register for junior trials',
  },
  {
    key: 'seniors',
    href: '/join/seniors',
    eyebrow: 'Ages 16+',
    title: 'Seniors & Reserves',
    text: 'Senior Men, Reserves and Senior Women. Send us an enquiry and the club secretary will be in touch about training and trials.',
    points: ['Senior Men and Reserves', 'Senior Women', 'From 16 — U16–U18 players can choose seniors'],
    cta: 'Send a senior enquiry',
  },
] as const

/** Join us: pick juniors (the trial registration) or seniors (an enquiry to the secretary). */
export default async function JoinPage() {
  const { season } = await getAgeRules(await payload())
  return (
    <section className="pitch-lines bg-[#0f2a55] text-white">
      <div className="container-x py-16 md:py-20">
        <p className="eyebrow">Join the Eagles</p>
        <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none sm:text-7xl">
          Join us for <span className="text-accent">{season}</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-white/75">Who’s playing? Choose juniors or seniors to get started.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {cards.map((c) => (
            <Link key={c.key} href={c.href} data-join={c.key} className="group flex flex-col rounded-2xl border border-white/15 bg-white/5 p-7 transition hover:-translate-y-0.5 hover:border-accent hover:bg-white/10">
              <span className="inline-flex w-fit rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-ink">{c.eyebrow}</span>
              <h2 className="mt-4 font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">{c.title}</h2>
              <p className="mt-3 text-white/75">{c.text}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-white/80">
                {c.points.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="text-accent">✓</span>{x}</li>)}
              </ul>
              <span className="mt-auto pt-6 font-semibold text-accent group-hover:underline">{c.cta} →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
