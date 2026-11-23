'use client'

import { useState } from 'react'

/** One-tap subscribe: Apple/Outlook (webcal), Google Calendar, or copy the link. The calendar updates itself as events are added. */
export function SyncButtons({ feed }: { feed: string }) {
  const [copied, setCopied] = useState(false)
  const webcal = feed.replace(/^https?:\/\//, 'webcal://')
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`
  return (
    <div className="rounded-2xl bg-[#0f2a55] p-5 text-white" data-sync>
      <h2 className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase">Sync with your calendar</h2>
      <p className="mt-1 text-sm text-white/70">One tap and every club event appears in your own calendar — and new events turn up automatically.</p>
      <div className="mt-4 grid gap-2">
        <a href={webcal} className="rounded-full bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-ink hover:brightness-110" data-sync-apple>iPhone, Mac & Outlook</a>
        <a href={google} target="_blank" rel="noopener" className="rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#0f2a55] hover:bg-white/90" data-sync-google>Google Calendar</a>
        <button type="button" onClick={() => navigator.clipboard?.writeText(feed).then(() => setCopied(true)).catch(() => null)} className="rounded-full border border-white/30 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">{copied ? 'Link copied ✓' : 'Copy calendar link'}</button>
      </div>
    </div>
  )
}
