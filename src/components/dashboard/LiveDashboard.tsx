'use client'

import { useEffect, useState } from 'react'
import { DashboardGrid, type DashItem } from './DashboardGrid'

/**
 * The dashboard grid with its badge counts refreshed every few minutes while the tab is open and in view, and when
 * you come back to the tab (at most once a minute) — enough to stay current without keeping the database busy.
 */
export function LiveDashboard({ items, initial, role }: { items: DashItem[]; initial: Record<string, number>; role: 'management' | 'coach' }) {
  const [counts, setCounts] = useState(initial)
  useEffect(() => {
    let stop = false
    let last = Date.now()
    const load = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 55_000) return
      last = Date.now()
      try {
        const r = await fetch(`/attention?for=${role}`, { cache: 'no-store' })
        if (r.ok && !stop) setCounts(await r.json())
      } catch {
        // offline — keep the last counts
      }
    }
    const t = setInterval(load, 180_000)
    document.addEventListener('visibilitychange', load)
    return () => {
      stop = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', load)
    }
  }, [role])
  return <DashboardGrid items={items} counts={counts} role={role} />
}
