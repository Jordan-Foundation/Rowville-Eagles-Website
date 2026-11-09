'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { Crest, RfaLogo } from '@/components/Logos'

const PATHS = {
  club: {
    name: 'Rowville Eagles',
    tag: 'Club teams',
    points: ['Teams for every age — MiniRoos through to seniors', 'Weekly games through the season', 'Train with your team during the week', 'Boys and girls, every level welcome'],
    cta: { href: '/join', label: 'Register interest for a team' },
  },
  academy: {
    name: 'Rowville Foundation Academy',
    tag: 'All year',
    points: ['Four terms a year — development doesn’t stop after the season', 'Open to players from any club', 'Group training, small groups and 1-on-1s', 'Join any time, even when club teams are full'],
    cta: { href: '/academy', label: 'Join the academy' },
  },
} as const

/**
 * One club, two pathways — the whole section flicks between the club (navy and yellow) and the academy
 * (black and white), so each pathway is shown in its own colours.
 */
export function PathwaysSection({ id, headline, body, more, photo, icon }: { id: string; headline: string; body: string; more?: string; photo: ReactNode; icon: ReactNode }) {
  const [academy, setAcademy] = useState(false)
  const p = academy ? PATHS.academy : PATHS.club
  const accent = academy ? 'text-white' : 'text-accent'
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      data-pathway={academy ? 'academy' : 'club'}
      className={`relative scroll-mt-40 overflow-hidden py-16 text-white transition-colors duration-500 sm:py-24 ${academy ? 'bg-black' : 'bg-gradient-to-br from-[#0f2a55] to-[#173f7d]'}`}
    >
      {/* Faint pitch lines behind the club view; plain black for the academy */}
      <div aria-hidden className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${academy ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
      </div>
      <div className="container-x relative">
        <p className={`eyebrow flex items-center gap-2 ${academy ? '!text-white/70' : '!text-accent'}`}>{icon} Pathways</p>
        <h2 id={`${id}-h`} className={`mt-3 max-w-3xl text-4xl font-bold uppercase leading-none sm:text-6xl ${academy ? 'font-display tracking-tight' : 'font-[family-name:var(--font-barlow)]'}`}>{headline}</h2>
        <p className="mt-4 max-w-2xl text-lg text-white/75">{body}</p>
        {more && (
          <details className="group mt-4">
            <summary className={`inline-flex cursor-pointer list-none items-center gap-1 font-semibold [&::-webkit-details-marker]:hidden ${accent}`}>
              Learn more <span aria-hidden className="transition group-open:rotate-180">▾</span>
            </summary>
            <p className="mt-3 max-w-prose text-white/75">{more}</p>
          </details>
        )}

        {/* The switch */}
        <div className="mt-10 flex flex-wrap items-center gap-4 text-base font-semibold sm:text-lg">
          <button type="button" onClick={() => setAcademy(false)} className={`transition ${academy ? 'text-white/45 hover:text-white' : 'text-accent'}`}>Rowville Eagles</button>
          <button
            type="button"
            role="switch"
            aria-checked={academy}
            aria-label="Show Rowville Foundation Academy"
            onClick={() => setAcademy((a) => !a)}
            className={`relative h-10 w-20 shrink-0 rounded-full border-2 transition-colors duration-300 ${academy ? 'border-white bg-white/15' : 'border-accent bg-accent/20'}`}
          >
            <span aria-hidden className={`absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full shadow transition-all duration-300 ${academy ? 'left-[calc(100%-2.05rem)] bg-white' : 'left-1 bg-accent'}`} />
          </button>
          <button type="button" onClick={() => setAcademy(true)} className={`transition ${academy ? 'text-white' : 'text-white/45 hover:text-white'}`}>Foundation Academy</button>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center" aria-live="polite">
          <div>
            <div className="flex items-center gap-5">
              {academy ? <RfaLogo className="h-14 w-auto" ink="#fff" /> : <Crest className="h-20 w-auto" preload />}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${academy ? 'text-white/60' : 'text-accent'}`}>{p.tag}</p>
                <p className={`mt-1 text-3xl font-bold uppercase leading-none sm:text-4xl ${academy ? 'font-display tracking-tight' : 'font-[family-name:var(--font-barlow)]'}`}>{p.name}</p>
              </div>
            </div>
            <ul className="mt-7 space-y-3 text-lg">
              {p.points.map((t) => (
                <li key={t} className="flex gap-3 text-white/90">
                  <span aria-hidden className={accent}>✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href={p.cta.href}
              className={`mt-8 inline-block px-7 py-3.5 font-semibold transition ${academy ? 'bg-white text-sm uppercase tracking-[0.15em] text-black hover:bg-white/90' : 'rounded-full bg-accent text-accent-ink hover:brightness-110'}`}
            >
              {p.cta.label}
            </Link>
            <p className="mt-5 text-sm text-white/60">Or do both — the club and the academy share the same curriculum and coaching approach.</p>
          </div>
          <div className={`transition duration-500 ${academy ? 'grayscale' : ''}`}>{photo}</div>
        </div>
      </div>
    </section>
  )
}
