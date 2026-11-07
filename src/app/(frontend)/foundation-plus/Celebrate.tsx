'use client'

import { useState, useTransition } from 'react'
import { celebratedAction } from './actions'

type B = { awardId: number; name: string; area: string; level: number; art: React.ReactNode }

/** Shown once per new badge, the next time the family opens the report. */
export function Celebrate({ player, badges }: { player: number; badges: B[] }) {
  const [open, setOpen] = useState(true)
  const [i, setI] = useState(0)
  const [, start] = useTransition()
  if (!open || badges.length === 0) return null
  const b = badges[i]
  const close = () => {
    if (i < badges.length - 1) return setI(i + 1)
    setOpen(false)
    start(() => void celebratedAction(player, badges.map((x) => x.awardId)))
  }
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="celebrate-title" className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6 backdrop-blur-sm">
      <div className="celebrate-pop relative w-full max-w-sm border border-white/20 bg-black p-8 text-center text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 24 }).map((_, n) => (
            <span key={n} className="confetti" style={{ left: `${(n * 41) % 100}%`, animationDelay: `${(n % 8) * 0.12}s`, background: ['#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#a855f7', '#fff'][n % 6] }} />
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">New badge</p>
        <div className="mx-auto mt-5 w-fit">{b.art}</div>
        <h2 id="celebrate-title" className="mt-5 font-display text-3xl font-bold uppercase">{b.name}</h2>
        <p className="mt-2 text-sm text-white/70">{b.area} Level {b.level} complete — amazing work!</p>
        <button onClick={close} autoFocus className="mt-7 w-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black">
          {i < badges.length - 1 ? `Next (${i + 1}/${badges.length})` : 'Awesome!'}
        </button>
      </div>
      <style>{`
        .celebrate-pop { animation: pop .5s cubic-bezier(.2,1.4,.4,1) both }
        @keyframes pop { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        .confetti { position: absolute; top: -10px; width: 7px; height: 12px; animation: fall 2.4s ease-in forwards }
        @keyframes fall { to { transform: translateY(520px) rotate(540deg); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .celebrate-pop, .confetti { animation: none } .confetti { display: none } }
      `}</style>
    </div>
  )
}
