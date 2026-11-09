'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/coach', label: 'Overview' },
  { href: '/coach/today', label: 'Training day' },
  { href: '/coach/sessions', label: 'Sessions' },
  { href: '/coach/messages', label: 'Messages' },
  { href: '/coach/share', label: 'Share links' },
  { href: '/coach/groups', label: 'My groups' },
  { href: '/coach/teams', label: 'Teams' },
  { href: '/coach/reviews', label: 'Reviews' },
  { href: '/coach/reports', label: 'Reports' },
  { href: '/coach/players', label: 'Players' },
  { href: '/coach/profile', label: 'My profile' },
]

export function CoachNav({ unread = 0 }: { unread?: number }) {
  const path = usePathname()
  return (
    <nav aria-label="Coach portal" className="-mx-1 hidden gap-1 lg:flex overflow-x-auto whitespace-nowrap text-sm">
      {items.map((i) => {
        const active = i.href === '/coach' ? path === '/coach' : path.startsWith(i.href)
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined} className={`px-4 py-2 transition ${active ? 'bg-white text-black' : 'text-muted hover:text-ink'}`}>
            {i.label}
            {i.href === '/coach/messages' && unread > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs font-bold text-white" aria-label={`${unread} unread`}>{unread}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

const tabs = [
  { href: '/coach', label: 'Home', icon: 'M3 10l7-6 7 6v7H3z' },
  { href: '/coach/today', label: 'Today', icon: 'M4 5h12v12H4zM4 9h12M8 3v4M12 3v4' },
  { href: '/coach/messages', label: 'Messages', icon: 'M3 5h14v9H8l-4 3v-3H3z' },
  { href: '/coach/groups', label: 'Groups', icon: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17a5 5 0 0 1 10 0M14 9a2.5 2.5 0 1 0 0-5M13 12a4.5 4.5 0 0 1 5 5' },
  { href: '/coach/players', label: 'Players', icon: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17a6 6 0 0 1 12 0' },
]

/** Phones: a bottom tab bar (the public site menu and footer are hidden in the portal). */
export function CoachTabs({ unread = 0 }: { unread?: number }) {
  const path = usePathname()
  return (
    <nav aria-label="Coach portal tabs" className="coach-tabs fixed inset-x-0 bottom-0 z-50 border-t border-line bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.href === '/coach' ? path === '/coach' : path.startsWith(t.href)
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? 'page' : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-white' : 'text-muted'}`}>
                <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d={t.icon} /></svg>
                {t.label}
                {t.href === '/coach/messages' && unread > 0 && <span className="absolute right-[22%] top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
