'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Crest, RfaLogo } from './Logos'
import { useCart } from '@/lib/cart'
import { useMe } from '@/lib/use-me'
import { FoundationPlusLogo } from './FoundationPlusLogo'

const nav = [
  { href: '/join', label: 'Join us' },
  { href: '/about', label: 'About' },
  { href: '/what-makes-us-different', label: 'Why us' },
  { href: '/programs', label: 'Camps & Programs' },
  { href: '/academy', label: 'Academy' },
  { href: '/shop', label: 'Shop' },
  { href: '/news', label: 'News' },
]

export function Header() {
  const path = usePathname() ?? ''
  const { count } = useCart()
  const me = useMe()
  const accountHref = me ? '/account' : '/login'
  const accountLabel = me ? 'My account' : 'Login'
  return (
    /* Club vs RFA styling is switched in CSS by any page that renders data-page-brand="academy" (see styles.css) */
    <header className="site-header sticky top-0 z-50 border-b border-white/10 bg-[#0f2a55]/95 text-white backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Rowville Eagles home">
          <Crest className="h-10 w-auto" preload />
          <span className="academy-only items-center gap-3">
            <span className="h-7 w-px bg-white/20" aria-hidden />
            <RfaLogo className="h-6 w-auto" ink="#fff" paper="#000" />
          </span>
          <span className="club-only leading-tight">
            <span className="block whitespace-nowrap font-[family-name:var(--font-barlow)] text-lg font-bold uppercase tracking-wide">Rowville Eagles</span>
            <span className="hidden whitespace-nowrap text-[10px] uppercase tracking-[0.25em] opacity-70 sm:block lg:hidden xl:block">Football Club · Est. 1985</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-4 whitespace-nowrap text-[13px] font-medium lg:flex xl:gap-7 xl:text-sm">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={path.startsWith(n.href) ? 'page' : undefined}
              className={`transition hover:opacity-100 ${path.startsWith(n.href) ? 'opacity-100' : 'opacity-75'} ${n.href === '/join' ? 'club-only font-semibold text-accent !opacity-100' : ''}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
        <Link
          href="/foundation-plus"
          aria-label="Foundation+ — online training"
          aria-current={path.startsWith('/foundation-plus') ? 'page' : undefined}
          className="group flex items-center rounded-sm border border-white/25 px-2 py-1 transition hover:border-white hover:shadow-[0_0_18px_rgba(255,255,255,0.28)] focus-visible:border-white aria-[current=page]:border-white"
        >
          <span className="hidden xl:block"><FoundationPlusLogo variant="horizontal" tone="white" height={32} alt="" /></span>
          <span className="xl:hidden"><FoundationPlusLogo variant="mark" tone="white" height={24} alt="" /></span>
        </Link>
        {count > 0 && (
          <Link href="/shop/cart" className="text-sm font-medium opacity-90 hover:opacity-100" aria-label={`Cart, ${count} items`}>
            Cart <span className="ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs">{count}</span>
          </Link>
        )}
        <Link href={accountHref} className="academy-only text-sm font-medium opacity-80 hover:opacity-100">
          {accountLabel}
        </Link>
        <Link href="/academy/trial" className="academy-only bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85">
          Book a trial
        </Link>
        <Link href={accountHref} className="club-only items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110">
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="currentColor"><path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H3Z" /></svg>
          {accountLabel}
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
