'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Crest, RfaLogo } from './Logos'
import { useCart } from '@/lib/cart'

const nav = [
  { href: '/about', label: 'About' },
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/programs', label: 'Camps & Programs' },
  { href: '/academy', label: 'Academy' },
  { href: '/shop', label: 'Shop' },
  { href: '/news', label: 'News' },
]

export function Header() {
  const path = usePathname() ?? ''
  const { count } = useCart()
  return (
    /* Club vs RFA styling is switched in CSS by any page that renders data-page-brand="academy" (see styles.css) */
    <header className="site-header sticky top-0 z-50 border-b border-white/10 bg-[#0f2a55]/95 text-white backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Rowville Eagles home">
          <Crest className="h-10 w-auto" />
          <span className="academy-only items-center gap-3">
            <span className="h-7 w-px bg-white/20" aria-hidden />
            <RfaLogo className="h-6 w-auto" ink="#fff" paper="#000" />
          </span>
          <span className="club-only leading-tight">
            <span className="block font-[family-name:var(--font-barlow)] text-lg font-bold uppercase tracking-wide">Rowville Eagles</span>
            <span className="block text-[10px] uppercase tracking-[0.25em] opacity-70">Football Club · Est. 1985</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={path.startsWith(n.href) ? 'page' : undefined}
              className={`transition hover:opacity-100 ${path.startsWith(n.href) ? 'opacity-100' : 'opacity-75'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
        {count > 0 && (
          <Link href="/shop/cart" className="text-sm font-medium opacity-90 hover:opacity-100" aria-label={`Cart, ${count} items`}>
            Cart <span className="ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs">{count}</span>
          </Link>
        )}
        <Link href="/academy#programs" className="academy-only bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85">
          Book a trial
        </Link>
        <Link href="/programs?type=registration" className="club-only rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110">
          Register
        </Link>
        </div>
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
