'use client'

import { useEffect } from 'react'

/** Keep the referral code (and invite) for 60 days, so it's there when the family signs up or pays — even weeks later. */
export function RememberCode({ value }: { value: string }) {
  useEffect(() => {
    document.cookie = `rfa_ref=${encodeURIComponent(value)}; path=/; max-age=${60 * 86400}; samesite=lax`
  }, [value])
  return null
}
