'use client'

import { useEffect, useState } from 'react'

/** Coach portal: registers the offline helper (production only) and says when a saved copy is showing. */
export function AppSupport() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  if (!offline) return null
  return <p role="status" className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-black">No signal — showing the last saved copy. Attendance saves once you’re back online.</p>
}
