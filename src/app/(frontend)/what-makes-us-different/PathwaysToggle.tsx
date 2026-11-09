'use client'

import Link from 'next/link'
import { useState } from 'react'
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

/** One club, two pathways: flick between the club and the academy, each in its own colours. */
export function PathwaysToggle() {
  const [academy, setAcademy] = useState(false)
  const p = academy ? PATHS.academy : PATHS.club
  return (
    <div className={`overflow-hidden rounded-2xl transition-colors duration-300 ${academy ? 'bg-black text-white' : 'bg-[#0f2a55] text-white'}`}>
      <div className="flex flex-wrap items-center justify-center gap-3 border-b border-white/10 px-5 py-5 text-sm font-semibold sm:justify-start sm:px-8">
        <button type="button" onClick={() => setAcademy(false)} className={`transition ${academy ? 'text-white/50 hover:text-white' : 'text-accent'}`}>Rowville Eagles</button>
        <button
          type="button"
          role="switch"
          aria-checked={academy}
          aria-label="Show Rowville Foundation Academy"
          onClick={() => setAcademy((a) => !a)}
          className={`relative h-8 w-16 shrink-0 rounded-full border-2 transition-colors ${academy ? 'border-white bg-white/15' : 'border-accent bg-accent/20'}`}
        >
          <span aria-hidden className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full transition-all duration-300 ${academy ? 'left-[calc(100%-1.6rem)] bg-white' : 'left-0.5 bg-accent'}`} />
        </button>
        <button type="button" onClick={() => setAcademy(true)} className={`transition ${academy ? 'text-white' : 'text-white/50 hover:text-white'}`}>Foundation Academy</button>
      </div>
      <div className="grid gap-6 px-5 py-8 sm:px-8 md:grid-cols-[auto_1fr] md:items-start" aria-live="polite">
        <div className="flex justify-center md:block">
          {academy ? <RfaLogo className="h-14 w-auto" ink="#fff" /> : <Crest className="h-20 w-auto" />}
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${academy ? 'text-white/60' : 'text-accent'}`}>{p.tag}</p>
          <p className={`mt-1 text-3xl font-bold uppercase leading-none ${academy ? 'font-display tracking-tight' : 'font-[family-name:var(--font-barlow)]'}`}>{p.name}</p>
          <ul className="mt-5 space-y-2.5">
            {p.points.map((t) => (
              <li key={t} className="flex gap-3 text-white/85">
                <span aria-hidden className={academy ? 'text-white' : 'text-accent'}>✓</span>
                {t}
              </li>
            ))}
          </ul>
          <Link
            href={p.cta.href}
            className={`mt-7 inline-block px-6 py-3 font-semibold transition ${academy ? 'bg-white text-sm uppercase tracking-[0.15em] text-black hover:bg-white/90' : 'rounded-full bg-accent text-accent-ink hover:brightness-110'}`}
          >
            {p.cta.label}
          </Link>
          <p className="mt-4 text-sm text-white/60">Or do both — the club and the academy share the same curriculum and coaching approach.</p>
        </div>
      </div>
    </div>
  )
}
