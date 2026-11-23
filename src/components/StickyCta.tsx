'use client'

import { useEffect, useState } from 'react'

/**
 * Phones only: a booking bar fixed to the bottom of the screen whenever none of the page's own booking buttons
 * ([data-cta]) and not the booking form itself ([data-cta-zone]) is on screen — so the next step is always one tap
 * away, however far down the page someone has read.
 */
export function StickyCta({ href, label, note, academy = false }: { href: string; label: string; note?: string; academy?: boolean }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-cta],[data-cta-zone]'))
    if (!els.length || typeof IntersectionObserver === 'undefined') {
      setShow(true)
      return
    }
    const onScreen = new Set<Element>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) onScreen.add(e.target)
        else onScreen.delete(e.target)
      }
      setShow(onScreen.size === 0)
    })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return (
    <>
      {/* Room at the end of the page so the bar never covers the footer */}
      <div aria-hidden className="h-24 md:hidden" />
      <div
        data-sticky-cta={show ? 'shown' : 'hidden'}
        aria-hidden={!show}
        inert={!show}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-200 md:hidden ${show ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex items-center gap-3">
          {note && <p className="min-w-0 flex-1 text-sm leading-snug text-muted">{note}</p>}
          <a
            href={href}
            className={`shrink-0 px-5 py-3 text-center text-sm font-semibold ${note ? '' : 'flex-1'} ${academy ? 'bg-white uppercase tracking-[0.15em] text-black' : 'rounded-full bg-accent text-accent-ink'}`}
          >
            {label}
          </a>
        </div>
      </div>
    </>
  )
}
