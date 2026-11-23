'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * "Payment processing": check again every few seconds (for up to two minutes) until Stripe's confirmation lands,
 * so the family sees "You're booked in!" without reloading — and the booking is reported to the ads as a purchase.
 */
export function RefreshWhilePending({ everyMs = 3000, forMs = 120_000 }: { everyMs?: number; forMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started > forMs) return clearInterval(timer)
      router.refresh()
    }, everyMs)
    return () => clearInterval(timer)
  }, [router, everyMs, forMs])
  return null
}
