'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export type NavGroup = { title: string; items: { href: string; label: string; key?: string }[] }

/** Words for the breadcrumb trail (anything numeric becomes "Details"). */
const CRUMBS: Record<string, string> = {
  management: 'Management', academy: 'Academy', bookings: 'Bookings', dashboard: '1-on-1 dashboard', terms: 'Academy terms', consent: 'Consent review',
  curriculum: 'Curriculum', dates: 'Set dates', 'foundation-plus': 'Foundation+', challenges: 'Challenges', messages: 'Messages', prices: 'Set prices',
  programs: 'Programs Overview', promotions: 'Promotions', send: 'Send', reports: 'Reports', r: 'Report', selections: 'Selections', teams: 'Teams',
  search: 'Search', families: 'Families', players: 'Players', new: 'New', money: 'Money summary', store: 'Store', activity: 'Activity', guide: 'How to run a term', broadcast: 'Email a group', export: 'Download', setup: 'Program setup',
}

export function Breadcrumbs() {
  const path = usePathname() ?? ''
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return null
  // Some levels have no page of their own: send them somewhere useful
  const HREF: Record<string, string> = { '/management/families': '/management/search', '/management/players': '/management/search', '/management/reports/r': '/management/reports', '/management/foundation-plus/challenges': '/management/foundation-plus' }
  const trail = parts.map((p, i) => ({ href: HREF['/' + parts.slice(0, i + 1).join('/')] ?? '/' + parts.slice(0, i + 1).join('/'), label: CRUMBS[p] ?? (/^\d+$/.test(p) ? 'Details' : p.replace(/-/g, ' ')) }))
  const back = trail[trail.length - 2]
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      <Link href={back.href} className="mr-2 font-semibold text-ink sm:hidden">← {back.label}</Link>
      <ol className="hidden flex-wrap items-center gap-2 sm:flex">
        {trail.map((c, i) => (
          <li key={c.href} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>/</span>}
            {i === trail.length - 1 ? <span aria-current="page" className="text-ink">{c.label}</span> : <Link href={c.href} className="hover:text-ink hover:underline">{c.label}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim().length < 2) return
        router.push(`/management/search?q=${encodeURIComponent(q.trim())}`)
        onDone?.()
      }}
    >
      <label className="sr-only" htmlFor="mgmt-search">Search families, players, emails, phones or references</label>
      <input id="mgmt-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, ref…" className="min-h-10 w-full border border-line bg-black/40 px-3 text-sm" />
    </form>
  )
}

/** Management menu: a sidebar on computers, a slide-down menu on phones. Replaces the public website header. */
export function ManagementNav({ groups, counts }: { groups: NavGroup[]; counts: Record<string, number> }) {
  const path = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [path])
  const active = (href: string) => (href === '/management' ? path === '/management' : path.startsWith(href.split('#')[0]))
  const list = (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">{g.title}</p>
          <ul className="mt-1">
            {g.items.map((i) => {
              const n = i.key ? counts[i.key] ?? 0 : 0
              return (
                <li key={i.href}>
                  <Link href={i.href} aria-current={active(i.href) ? 'page' : undefined} className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${active(i.href) ? 'bg-white font-semibold text-black' : 'text-muted hover:text-ink'}`}>
                    {i.label}
                    {n > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white">{n > 99 ? '99+' : n}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
  return (
    <>
      {/* Phones */}
      <div className="sticky top-0 z-40 border-b border-line bg-black/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/management" className="font-display text-sm font-semibold uppercase tracking-[0.2em]">Management</Link>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mgmt-menu" className="min-h-10 border border-line px-3 text-xs font-semibold uppercase tracking-[0.15em]">{open ? 'Close' : 'Menu'}</button>
        </div>
        {open && (
          <div id="mgmt-menu" className="max-h-[80vh] space-y-5 overflow-y-auto border-t border-line px-1 py-4">
            <div className="px-3"><SearchBox onDone={() => setOpen(false)} /></div>
            {list}
          </div>
        )}
      </div>
      {/* Computers */}
      <aside aria-label="Management menu" className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r border-line bg-surface-2 py-6 lg:block">
        <Link href="/management" className="block px-6 font-display text-lg font-semibold uppercase tracking-[0.15em]">Management</Link>
        <p className="px-6 text-[11px] text-muted">Rowville Eagles &amp; Foundation Academy</p>
        <div className="mt-4 px-3"><SearchBox /></div>
        <nav aria-label="Management" className="mt-6 px-3">{list}</nav>
      </aside>
    </>
  )
}
