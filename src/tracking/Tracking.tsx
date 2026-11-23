'use client'

import Script from 'next/script'
import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { isTrackable, type TrackingConfig } from './config'

type W = Window & { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[]; __rfaTracking?: TrackingConfig }

/** Page views on every public page (path only — no query string is sent to Google). */
function PageViews({ cfg }: { cfg: TrackingConfig }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const ok = isTrackable(pathname, search)
  useEffect(() => {
    if (!ok) return
    // The scripts may still be starting: wait for them (up to ~10s), then send one page view each
    let tries = 0
    const timer = setInterval(() => {
      const w = window as W
      const ready = (!cfg.meta || w.fbq) && (!cfg.google.length || w.gtag)
      if (!ready && ++tries < 40) return
      clearInterval(timer)
      w.fbq?.('track', 'PageView')
      if (cfg.google.length) w.gtag?.('event', 'page_view', { page_location: location.origin + pathname, page_title: document.title })
    }, 250)
    return () => clearInterval(timer)
  }, [ok, pathname, cfg])
  if (!ok) return null
  return (
    <>
      {cfg.meta && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('set','autoConfig',false,${JSON.stringify(cfg.meta)});fbq('init',${JSON.stringify(cfg.meta)});`}
        </Script>
      )}
      {cfg.google.length > 0 && (
        <>
          <Script id="google-tag-src" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.google[0])}`} strategy="afterInteractive" />
          <Script id="google-tag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());${cfg.google.map((id) => `gtag('config',${JSON.stringify(id)},{send_page_view:false});`).join('')}`}
          </Script>
        </>
      )}
    </>
  )
}

/** Meta Pixel + Google tag, live site only (the layout decides). */
export function Tracking({ cfg }: { cfg: TrackingConfig }) {
  useEffect(() => {
    ;(window as W).__rfaTracking = cfg
  }, [cfg])
  // A booking form sent (<form data-track-begin="camp">): "started checkout" — gives the ads a signal between a
  // page view and a booking. Once per form per page; only the booking type is sent.
  useEffect(() => {
    const sent = new WeakSet<HTMLFormElement>()
    const onSubmit = (e: Event) => {
      const form = e.target
      if (!(form instanceof HTMLFormElement) || sent.has(form) || !isTrackable(location.pathname, null)) return
      const category = form.dataset.trackBegin
      if (!category) return
      sent.add(form)
      const w = window as W
      w.fbq?.('track', 'InitiateCheckout', { content_category: category })
      if (cfg.google.length) w.gtag?.('event', 'begin_checkout', { items: [{ item_id: category, item_category: category }] })
    }
    document.addEventListener('submit', onSubmit, true)
    return () => document.removeEventListener('submit', onSubmit, true)
  }, [cfg])
  return (
    <Suspense fallback={null}>
      <PageViews cfg={cfg} />
    </Suspense>
  )
}
