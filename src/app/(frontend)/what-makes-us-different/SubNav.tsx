'use client'

import { useEffect, useRef, useState } from 'react'

/** Sticky jump links; highlights the section in view and keeps it scrolled into view on phones. */
export function SubNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id)
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (seen) setActive(seen.target.id)
    }, { rootMargin: '-35% 0px -55% 0px' })
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [items])
  useEffect(() => {
    bar.current?.querySelector(`[data-id="${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])
  return (
    <nav aria-label="On this page" className="sticky top-[100px] z-30 border-b border-line bg-surface/95 backdrop-blur lg:top-16">
      <div ref={bar} className="container-x flex gap-1 overflow-x-auto py-2 text-sm [scrollbar-width:none]">
        {items.map((i) => (
          <a
            key={i.id}
            data-id={i.id}
            href={`#${i.id}`}
            aria-current={active === i.id ? 'true' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 font-medium transition focus-visible:outline-2 focus-visible:outline-brand ${active === i.id ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}
          >
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
