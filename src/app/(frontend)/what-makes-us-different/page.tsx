/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { differenceContent, type Difference } from '@/content/difference-load'
import { FoundationPlusLogo } from '@/components/FoundationPlusLogo'
import { SubNav } from './SubNav'
import { SampleReport } from './SampleReport'

export const revalidate = 300
export const metadata: Metadata = {
  title: 'What makes us different',
  description: 'Paid, professionally developed coaches, a real football curriculum, a five-stage lesson sequence, player reports and a year-round program — plus a free Friday Community Night.',
  alternates: { canonical: '/what-makes-us-different' },
  openGraph: { title: 'What makes Rowville different', description: 'Paid coaches, a real football curriculum and a year-round program for every player.', type: 'website' },
}

const ICONS: Record<string, React.ReactNode> = {
  coaches: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0M18 4l2 2-2 2" />,
  curriculum: <path d="M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3V5Zm14 3h2v12M8 9h6M8 13h6" />,
  sessions: <path d="M4 12h3l2-6 4 12 2-6h5" />,
  reports: <path d="M6 3h9l4 4v14H6V3Zm9 0v4h4M9 13l2 2 4-4" />,
  year: <path d="M4 6h16v14H4V6Zm0 4h16M8 3v4m8-4v4" />,
  pathways: <path d="M6 20V9a5 5 0 0 1 5-5h1m6 16V9a5 5 0 0 0-5-5h-1M12 2v4" />,
  community: <path d="M3 11l9-7 9 7v9H3v-9Zm6 9v-5h6v5" />,
  fplus: <path d="M12 5v14M5 12h14" />,
}
const Icon = ({ k }: { k: string }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[k]}</svg>
)

function Photo({ image, icon, tall }: { image: { url: string; alt: string } | null; icon: string; tall?: boolean }) {
  if (image) return <img src={image.url} alt={image.alt} className={`w-full rounded-2xl object-cover ${tall ? 'aspect-[4/5]' : 'aspect-[4/3]'}`} loading="lazy" />
  return (
    <div aria-hidden className={`grid w-full place-items-center rounded-2xl bg-gradient-to-br from-[#0f2a55] to-[#1d4e9e] text-white/80 ${tall ? 'aspect-[4/5]' : 'aspect-[4/3]'}`}>
      <span className="scale-[2.5]"><Icon k={icon} /></span>
    </div>
  )
}

function More({ text }: { text?: string }) {
  if (!text) return null
  return (
    <details className="group mt-4">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-brand [&::-webkit-details-marker]:hidden">
        Learn more <span aria-hidden className="transition group-open:rotate-180">▾</span>
      </summary>
      <p className="mt-3 max-w-prose text-muted">{text}</p>
    </details>
  )
}

function Section({ id, icon, eyebrow, headline, body, more, children, alt }: { id: string; icon: string; eyebrow: string; headline: string; body: string; more?: string; children?: React.ReactNode; alt?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`scroll-mt-40 py-16 sm:py-20 ${alt ? 'bg-surface-2' : ''}`}>
      <div className="container-x">
        <p className="eyebrow flex items-center gap-2 !text-brand"><Icon k={icon} /> {eyebrow}</p>
        <h2 id={`${id}-h`} className="mt-3 max-w-3xl font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase leading-none sm:text-5xl">{headline}</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted">{body}</p>
        <More text={more} />
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  )
}

const Btn = ({ href, children, ghost }: { href: string; children: React.ReactNode; ghost?: boolean }) => (
  <Link href={href} className={`inline-block rounded-full px-6 py-3 font-semibold transition ${ghost ? 'border border-current hover:bg-black/5' : 'bg-accent text-accent-ink hover:brightness-110'}`}>{children}</Link>
)

export default async function DifferencePage() {
  const c: Difference = await differenceContent(await payload())
  const nav = [
    ['coaches', c.coaches.nav], ['curriculum', c.curriculum.nav], ['sessions', c.sessions.nav], ['reports', c.reports.nav],
    ['year-round', c.year.nav], ['pathways', c.pathways.nav], ['community-night', c.community.nav], ['foundation-plus', c.fplus.nav],
  ].map(([id, label]) => ({ id, label }))

  return (
    <div>
      <section className="pitch-lines relative overflow-hidden bg-[#0f2a55] text-white">
        <div className="container-x grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow !text-accent">Rowville Eagles · Rowville Foundation Academy</p>
            <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-[0.95] sm:text-7xl">{c.hero.title}</h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">{c.hero.intro}</p>
          </div>
          <Photo image={c.hero.image} icon="coaches" />
        </div>
      </section>

      <SubNav items={nav} />

      <Section id="coaches" icon="coaches" eyebrow="Coaching" headline={c.coaches.headline} body={c.coaches.body} more={c.coaches.more}>
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <Photo image={c.coaches.image} icon="coaches" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {['Paid, never volunteer-run', '10-week professional development program', 'Same lesson sequence every session', 'Aligned with our culture and values'].map((t) => (
              <li key={t} className="rounded-xl border border-line bg-surface p-4 font-semibold">✓ {t}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="curriculum" icon="curriculum" eyebrow="Curriculum" headline={c.curriculum.headline} body={c.curriculum.body} more={c.curriculum.more} alt>
        <ol aria-label="Curriculum levels" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {['Foundation (to age 7)', '8', '9', '10', '11', '12', '13'].map((l, i, a) => (
            <li key={l} className="flex items-center gap-2">
              <span className="rounded-full border border-brand px-3 py-1 text-brand">{i === 0 ? l : `Age ${l}`}</span>
              {i < a.length - 1 && <span aria-hidden className="text-muted">→</span>}
            </li>
          ))}
        </ol>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.curriculum.strands.map((s) => (
            <li key={s.name} className="rounded-xl border border-line bg-surface p-5">
              <p className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase">{s.name}</p>
              {s.line && <p className="mt-1 text-sm text-muted">{s.line}</p>}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="sessions" icon="sessions" eyebrow="Every session" headline={c.sessions.headline} body={c.sessions.body}>
        <ol className="grid gap-3 lg:grid-cols-5" aria-label="The five stages of every session">
          {c.sessions.stages.map((s, i) => (
            <li key={s.name} className="relative rounded-xl bg-[#0f2a55] p-5 text-white lg:[clip-path:polygon(0_0,92%_0,100%_50%,92%_100%,0_100%,8%_50%)] lg:px-9 lg:first:[clip-path:polygon(0_0,92%_0,100%_50%,92%_100%,0_100%)]">
              <p className="text-xs font-semibold text-accent">Step {i + 1}</p>
              <p className="font-[family-name:var(--font-barlow)] text-2xl font-extrabold">{s.name}</p>
              <p className="mt-1 text-sm text-white/80">{s.line}</p>
              {i < c.sessions.stages.length - 1 && <span aria-hidden className="absolute -bottom-3 left-8 text-2xl text-brand lg:hidden">↓</span>}
            </li>
          ))}
        </ol>
        <p className="mt-6 inline-block rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold">⏱ {c.sessions.lengths}</p>
      </Section>

      <Section id="reports" icon="reports" eyebrow="Reports" headline={c.reports.headline} body={c.reports.body} more={c.reports.more} alt>
        <div className="max-w-3xl">{c.reports.image ? <img src={c.reports.image.url} alt={c.reports.image.alt} className="w-full rounded-2xl border border-line" loading="lazy" /> : <SampleReport />}</div>
      </Section>

      <Section id="year-round" icon="year" eyebrow="All year" headline={c.year.headline} body={c.year.body} more={c.year.more}>
        <ol className="relative grid gap-4 md:grid-cols-4" aria-label="The four terms">
          <span aria-hidden className="absolute left-4 top-0 h-full w-0.5 bg-line md:left-0 md:top-6 md:h-0.5 md:w-full" />
          {c.year.terms.map((t) => {
            const season = /season/i.test(t.title) && !/off/i.test(t.title)
            return (
              <li key={t.term} className="relative pl-10 md:pl-0 md:pt-12">
                <span aria-hidden className={`absolute left-2 top-1 h-5 w-5 rounded-full border-4 border-surface md:left-0 md:top-3.5 ${season ? 'bg-accent' : 'bg-brand'}`} />
                <div className={`rounded-xl p-5 ${season ? 'bg-accent/15' : 'bg-surface-2'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t.months}</p>
                  <p className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{t.term} · {t.title}</p>
                  <p className="mt-1 text-sm">{t.detail}</p>
                </div>
              </li>
            )
          })}
        </ol>
        <p className="mt-6 font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase text-brand">{c.year.sessionsPerYear}</p>
      </Section>

      <Section id="pathways" icon="pathways" eyebrow="Pathways" headline={c.pathways.headline} body={c.pathways.body} more={c.pathways.more} alt>
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#0f2a55] p-5 text-white"><p className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Rowville Eagles</p><p className="mt-1 text-sm text-white/80">Club teams, weekly games in season.</p></div>
            <div className="rounded-xl bg-black p-5 text-white"><p className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Foundation Academy</p><p className="mt-1 text-sm text-white/80">All year, open to players from any club.</p></div>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Btn href="/academy">Join the academy</Btn>
              <Btn href="/join" ghost>Register interest for a team</Btn>
            </div>
          </div>
          <Photo image={c.pathways.image} icon="pathways" />
        </div>
      </Section>

      <Section id="community-night" icon="community" eyebrow="Every Friday" headline={c.community.headline} body={c.community.body} more={c.community.more}>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <dl className="rounded-2xl bg-accent p-6 text-accent-ink">
            <div><dt className="text-xs font-semibold uppercase tracking-wider opacity-70">When</dt><dd className="mt-1 text-lg font-semibold">{c.community.when}</dd></div>
            <div className="mt-4"><dt className="text-xs font-semibold uppercase tracking-wider opacity-70">Where</dt><dd className="mt-1 text-lg font-semibold">{c.community.where}</dd></div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">{['Fun-only game', 'Free dinner', 'Music', 'Dessert'].map((t) => <span key={t} className="rounded-full bg-black/10 px-3 py-1">{t}</span>)}</div>
            <p className="mt-5 font-[family-name:var(--font-barlow)] text-3xl font-extrabold uppercase">{c.community.welcome}</p>
          </dl>
          <div className="grid grid-cols-2 gap-3">
            {c.community.photos.length ? c.community.photos.slice(0, 4).map((ph) => <img key={ph.url} src={ph.url} alt={ph.alt} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />) : [0, 1, 2, 3].map((i) => <Photo key={i} image={null} icon="community" />)}
          </div>
        </div>
      </Section>

      <section id="foundation-plus" aria-labelledby="foundation-plus-h" className="fp-ink scroll-mt-40 py-16 sm:py-20">
        <div className="container-x grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <FoundationPlusLogo variant="horizontal" tone="white" height={40} />
            <h2 id="foundation-plus-h" className="fp-heading mt-6 text-3xl sm:text-4xl">{c.fplus.headline}</h2>
            <p className="mt-3 max-w-2xl text-white/80">{c.fplus.body}</p>
          </div>
          <Link href="/foundation-plus" className="fp-label inline-block bg-white px-7 py-4 text-sm text-[#0b0b0c] transition hover:bg-white/85">Explore Foundation+</Link>
        </div>
      </section>

      <section className="bg-[#0f2a55] py-16 text-white sm:py-20">
        <div className="container-x text-center">
          <h2 className="font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase sm:text-5xl">{c.cta.headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">{c.cta.body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/academy" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink hover:brightness-110">Register for the academy</Link>
            <Link href="/join" className="rounded-full border border-white/40 px-6 py-3 font-semibold hover:bg-white/10">Register interest for a team</Link>
            <Link href="/foundation-plus" className="rounded-full border border-white/40 px-6 py-3 font-semibold hover:bg-white/10">Start a free month of Foundation+</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
