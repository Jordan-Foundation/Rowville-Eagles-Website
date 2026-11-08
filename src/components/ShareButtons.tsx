'use client'

import { useEffect, useState } from 'react'

/** Share a page: the phone's own share sheet where there is one, plus Facebook, WhatsApp and Copy link. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => setCanShare('share' in navigator), [])
  const btn = 'inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-ink'
  const u = encodeURIComponent(url)
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Share this story">
      <span className="mr-1 text-sm text-muted">Share</span>
      {canShare && (
        <button type="button" className={btn} onClick={() => navigator.share({ title, url }).catch(() => {})}>Share…</button>
      )}
      <a className={btn} href={`https://www.facebook.com/sharer/sharer.php?u=${u}`} target="_blank" rel="noopener">Facebook</a>
      <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener">WhatsApp</a>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2500)
          } catch {
            window.prompt('Copy this link', url)
          }
        }}
      >
        {copied ? 'Link copied ✓' : 'Copy link'}
      </button>
    </div>
  )
}
