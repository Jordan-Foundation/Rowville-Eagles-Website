'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Crest } from './Crest'

const nav = [
  { href: '/teams', label: 'Teams' },
  { href: '/programs', label: 'Camps & Programs' },
  { href: '/academy', label: 'Foundation Academy' },
  { href: '/news', label: 'News' },
]

export function Header() {
  const academy = usePathname()?.startsWith('/academy')
  return (
    <header
      data-brand={academy ? 'academy' : undefined}
      className={`sticky top-0 z-50 border-b border-white/10 backdrop-blur ${academy ? '!bg-[#0b0b0c]/95 text-[#f4f1ea]' : 'bg-[#0a1a3d]/95 text-white'}`}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <Crest className="h-9 w-8" />
          <span className="leading-tight">
            <span className="block font-[family-name:var(--font-barlow)] text-lg font-bold uppercase tracking-wide">Rowville Eagles</span>
            <span className="block text-[10px] uppercase tracking-[0.25em] opacity-70">Football Club</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="opacity-85 transition hover:opacity-100 hover:text-[var(--accent)]">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/programs?type=registration"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110"
        >
          Register
        </Link>
      </div>
      <nav aria-label="Mobile" className="container-x flex gap-5 overflow-x-auto pb-3 text-sm md:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 opacity-85">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
