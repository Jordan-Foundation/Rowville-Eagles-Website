'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Crest, RfaLogo } from './Logos'

const nav = [
  { href: '/teams', label: 'Teams' },
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/programs', label: 'Camps & Programs' },
  { href: '/academy', label: 'Academy' },
  { href: '/news', label: 'News' },
]

export function Header() {
  const path = usePathname() ?? ''
  const academy = path.startsWith('/academy')
  return (
    <header
      data-brand={academy ? 'academy' : undefined}
      className={`sticky top-0 z-50 border-b backdrop-blur ${academy ? 'border-white/10 !bg-black/90 text-white' : 'border-white/10 bg-[#0f2a55]/95 text-white'}`}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href={academy ? '/academy' : '/'} className="flex items-center gap-3" aria-label={academy ? 'Rowville Foundation Academy home' : 'Rowville Eagles home'}>
          <Crest className="h-10 w-auto" />
          {academy ? (
            <>
              <span className="h-7 w-px bg-white/20" aria-hidden />
              <RfaLogo className="h-6 w-auto" ink="#fff" paper="#000" />
            </>
          ) : (
            <span className="leading-tight">
              <span className="block font-[family-name:var(--font-barlow)] text-lg font-bold uppercase tracking-wide">Rowville Eagles</span>
              <span className="block text-[10px] uppercase tracking-[0.25em] opacity-70">Football Club · Est. 1985</span>
            </span>
          )}
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={path.startsWith(n.href) ? 'page' : undefined}
              className={`transition hover:opacity-100 ${path.startsWith(n.href) ? 'opacity-100' : 'opacity-75'} ${academy ? '' : 'hover:text-accent'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href={academy ? '/academy#programs' : '/programs?type=registration'}
          className={`px-4 py-2 text-sm font-semibold transition ${academy ? 'bg-white text-black hover:bg-white/85' : 'rounded-full bg-accent text-accent-ink hover:brightness-110'}`}
        >
          {academy ? 'Book a trial' : 'Register'}
        </Link>
      </div>
      <nav aria-label="Mobile" className="container-x flex gap-5 overflow-x-auto pb-3 text-sm lg:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 opacity-85">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
