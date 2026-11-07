'use client'

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react'

export type Slide = { desktop: string; phone: string; title: string; alt: string }

/** Desktop + phone screenshots in device frames; swipe or use the arrows/dots. */
export function Screens({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const go = (n: number) => {
    const next = (n + slides.length) % slides.length
    setI(next)
    track.current?.children[next]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }
  return (
    <div aria-roledescription="carousel" aria-label="Foundation+ screenshots">
      <div
        ref={track}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none]"
        onScroll={(e) => {
          const el = e.currentTarget
          const n = Math.round(el.scrollLeft / el.clientWidth)
          if (n !== i && n >= 0 && n < slides.length) setI(n)
        }}
      >
        {slides.map((s, n) => (
          <figure key={s.title} aria-roledescription="slide" aria-label={`${n + 1} of ${slides.length}: ${s.title}`} className="relative w-full shrink-0 snap-start">
            <div className="relative mx-auto max-w-4xl pb-10 pr-10 sm:pr-24">
              <div className="overflow-hidden rounded-t-xl border border-white/20 bg-[#1a1a1d] shadow-2xl">
                <div className="flex gap-1.5 border-b border-white/10 px-3 py-2" aria-hidden>{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 rounded-full bg-white/25" />)}</div>
                <img src={s.desktop} alt={`${s.alt} (desktop)`} className="block aspect-[16/10] w-full object-cover object-top" loading={n ? 'lazy' : 'eager'} />
              </div>
              <div className="absolute bottom-0 right-0 w-[26%] min-w-24 max-w-52 overflow-hidden rounded-[1.4rem] border-[5px] border-[#2a2a2e] bg-black shadow-2xl">
                <img src={s.phone} alt={`${s.alt} (phone)`} className="block aspect-[9/19.5] w-full object-cover object-top" loading="lazy" />
              </div>
            </div>
            <figcaption className="fp-label mt-2 text-center text-xs text-white/70">{s.title}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button onClick={() => go(i - 1)} aria-label="Previous screenshot" className="h-10 w-10 border border-white/30 hover:border-white">←</button>
        <div className="flex gap-2">
          {slides.map((s, n) => (
            <button key={s.title} onClick={() => go(n)} aria-label={`Show ${s.title}`} aria-current={n === i} className={`h-2 w-6 transition ${n === i ? 'bg-white' : 'bg-white/25'}`} />
          ))}
        </div>
        <button onClick={() => go(i + 1)} aria-label="Next screenshot" className="h-10 w-10 border border-white/30 hover:border-white">→</button>
      </div>
    </div>
  )
}
