'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/coach', label: 'Overview' },
  { href: '/coach/sessions', label: 'Sessions' },
  { href: '/coach/share', label: 'Share links' },
  { href: '/coach/groups', label: 'My groups' },
  { href: '/coach/reviews', label: 'Reviews' },
  { href: '/coach/players', label: 'Players' },
  { href: '/coach/profile', label: 'My profile' },
]

export function CoachNav() {
  const path = usePathname()
  return (
    <nav aria-label="Coach portal" className="-mx-1 flex gap-1 overflow-x-auto whitespace-nowrap text-sm">
      {items.map((i) => {
        const active = i.href === '/coach' ? path === '/coach' : path.startsWith(i.href)
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined} className={`px-4 py-2 transition ${active ? 'bg-white text-black' : 'text-muted hover:text-ink'}`}>
            {i.label}
          </Link>
        )
      })}
    </nav>
  )
}
