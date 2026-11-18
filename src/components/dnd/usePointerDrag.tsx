'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Drag and drop with pointer events, so it works with a mouse, a finger (phone / tablet) and a pen.
 * - Mouse: drag the whole card. Touch: drag by the card's grip (so the page still scrolls normally).
 * - Drop targets are any element with data-drop="<target>"; the hovered one is reported as `over`.
 * - The page scrolls when you drag near the top or bottom edge. Escape cancels.
 */
export type DragState = { id: string; label: string; x: number; y: number; over: string | null } | null

export function usePointerDrag(onDrop: (id: string, target: string) => void) {
  const [drag, setDrag] = useState<DragState>(null)
  const pending = useRef<{ id: string; label: string; x: number; y: number; pointer: number } | null>(null)
  const live = useRef<DragState>(null)
  const dropRef = useRef(onDrop)
  dropRef.current = onDrop

  const targetAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null)?.dataset.drop ?? null

  const end = useCallback((commit: boolean) => {
    const d = live.current
    pending.current = null
    live.current = null
    setDrag(null)
    document.body.style.userSelect = ''
    if (commit && d?.over) dropRef.current(d.id, d.over)
  }, [])

  useEffect(() => {
    let raf = 0
    const move = (e: PointerEvent) => {
      const p = pending.current
      if (!p || e.pointerId !== p.pointer) return
      if (!live.current) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return
        document.body.style.userSelect = 'none'
      }
      e.preventDefault()
      const next = { id: p.id, label: p.label, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) }
      live.current = next
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setDrag(next))
      // Scroll when near the edges
      const edge = 60
      if (e.clientY < edge) window.scrollBy(0, -12)
      else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12)
    }
    const up = (e: PointerEvent) => {
      if (!pending.current || e.pointerId !== pending.current.pointer) return
      end(Boolean(live.current))
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && pending.current) end(false) }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', () => end(false))
    window.addEventListener('keydown', key)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', key)
    }
  }, [end])

  /** Props for a draggable card. */
  const dragProps = (id: string, label: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const t = e.target as HTMLElement
      if (t.closest('select, button, a, input, textarea, summary')) return
      // On touch screens only the grip starts a drag, so scrolling the page still works
      if (e.pointerType !== 'mouse' && !t.closest('[data-grip]')) return
      pending.current = { id, label, x: e.clientX, y: e.clientY, pointer: e.pointerId }
    },
    'data-dragging': drag?.id === id ? 'true' : undefined,
  })

  const Ghost = () =>
    drag ? (
      <div aria-hidden="true" className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 border border-white bg-black/90 px-3 py-2 text-sm font-semibold text-white shadow-xl" style={{ left: drag.x, top: drag.y }}>
        {drag.label}
      </div>
    ) : null

  return { drag, dragProps, Ghost }
}

/** The grip for touch dragging (also a visual cue on desktop). */
export function Grip() {
  return (
    <span data-grip aria-hidden="true" className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center text-muted active:cursor-grabbing">
      <svg viewBox="0 0 8 14" width="8" height="14" fill="currentColor"><circle cx="2" cy="2" r="1.3" /><circle cx="6" cy="2" r="1.3" /><circle cx="2" cy="7" r="1.3" /><circle cx="6" cy="7" r="1.3" /><circle cx="2" cy="12" r="1.3" /><circle cx="6" cy="12" r="1.3" /></svg>
    </span>
  )
}
