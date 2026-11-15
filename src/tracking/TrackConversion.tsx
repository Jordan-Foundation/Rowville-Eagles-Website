'use client'

import { useEffect } from 'react'
import type { Conversion } from './config'

type W = Window & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; __rfaTracking?: { ads: string | null; adsLead: string | null; adsPurchase: string | null; google: string[]; meta: string | null } }

/**
 * On a confirmation page: tell Meta and Google a booking happened (once per reference, even if the page is
 * reloaded). Only the type, amount and our reference are sent — never names, emails or children's details.
 */
export function TrackConversion({ c }: { c: Conversion }) {
  useEffect(() => {
    const key = `rfa-conv:${c.ref}`
    try {
      if (localStorage.getItem(key)) return
    } catch {}
    let tries = 0
    const timer = setInterval(() => {
      const w = window as W
      const cfg = w.__rfaTracking
      const ready = cfg && (!cfg.meta || w.fbq) && (!cfg.google.length || w.gtag)
      if (!ready && ++tries < 40) return
      clearInterval(timer)
      if (!cfg) return
      const money = { value: c.value, currency: 'AUD' }
      if (w.fbq) w.fbq('track', c.kind === 'lead' ? 'Lead' : 'Purchase', { ...money, content_category: c.category }, { eventID: c.ref })
      if (w.gtag) {
        w.gtag('event', c.kind === 'lead' ? 'generate_lead' : 'purchase', { ...money, transaction_id: c.ref, items: [{ item_id: c.category, item_category: c.category, price: c.value, quantity: 1 }] })
        const label = c.kind === 'lead' ? cfg.adsLead : cfg.adsPurchase
        if (cfg.ads && label) w.gtag('event', 'conversion', { send_to: `${cfg.ads}/${label}`, ...money, transaction_id: c.ref })
      }
      try {
        localStorage.setItem(key, '1')
      } catch {}
    }, 250)
    return () => clearInterval(timer)
  }, [c])
  return null
}
