'use client'

import { useEffect, useState } from 'react'
import { DashboardGrid, type DashItem } from './DashboardGrid'

/** The dashboard grid with its badge counts refreshed about once a minute and when the tab comes back into view. */
export function LiveDashboard({ items, initial, role }: { items: DashItem[]; initial: Record<string, number>; role: 'management' | 'coach' }) {
  const [counts, setCounts] = useState(initial)
  useEffect(() => {
    let stop = false
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const r = await fetch(`/attention?for=${role}`, { cache: 'no-store' })
        if (r.ok && !stop) setCounts(await r.json())
      } catch {
        // offline — keep the last counts
      }
    }
    const t = setInterval(load, 60_000)
    document.addEventListener('visibilitychange', load)
    return () => {
      stop = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', load)
    }
  }, [role])
  return <DashboardGrid items={items} counts={counts} />
}
