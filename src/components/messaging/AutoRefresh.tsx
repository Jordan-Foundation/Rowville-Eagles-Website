'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Re-fetch the page every 15 seconds while it's on screen (new messages, unread dots). */
export function AutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && router.refresh(), 15_000)
    return () => clearInterval(t)
  }, [router])
  return null
}
