'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Crest, RfaLogo } from './Logos'
import { useCart } from '@/lib/cart'
import { useMe } from '@/lib/use-me'
import { FoundationPlusLogo } from './FoundationPlusLogo'
import { CartSync } from './CartSync'

const nav = [
  { href: '/join', label: 'Join us' },
  { href: '/about', label: 'About' },
  { href: '/what-makes-us-different', label: 'Why us' },
  { href: '/programs', label: 'Camps & Programs' },
  { href: '/academy', label: 'Academy' },
  { href: '/shop', label: 'Shop' },
  { href: '/news', label: 'News' },
]

export function Header({ fplusLive = true }: { fplusLive?: boolean }) {
  const path = usePathname() ?? ''
  const { count } = useCart()
  const me = useMe()
  const accountHref = me ? '/account' : '/login'
  const accountLabel = me ? 'My account' : 'Login'
  const [open, setOpen] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null)
  // Close the phone menu when the page changes, and with Escape
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuBtn.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])
  return (
    /* Club vs RFA styling is switched in CSS by any page that renders data-page-brand="academy" (see styles.css) */
    <header className="site-header sticky top-0 z-50 border-b border-white/10 bg-[#0f2a55]/95 text-white backdrop-blur">
      <CartSync />
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
          aria-label={fplusLive ? 'Foundation+ — online training' : 'Foundation+ — online training, coming soon'}
          aria-current={path.startsWith('/foundation-plus') ? 'page' : undefined}
          className="group relative flex items-center rounded-sm border border-white/25 px-2 py-1 transition hover:border-white hover:shadow-[0_0_18px_rgba(255,255,255,0.28)] focus-visible:border-white aria-[current=page]:border-white"
        >
          <span className="hidden xl:block"><FoundationPlusLogo variant="horizontal" tone="white" height={32} alt="" /></span>
          <span className="xl:hidden"><FoundationPlusLogo variant="mark" tone="white" height={24} alt="" /></span>
          {!fplusLive && <span aria-hidden className="absolute -bottom-2 -right-2 rounded-sm bg-white px-1 text-[9px] font-bold uppercase leading-[14px] tracking-wider text-black">Soon</span>}
        </Link>
        {count > 0 && (
          <Link href="/shop/cart" className="text-sm font-medium opacity-90 hover:opacity-100" aria-label={`Cart, ${count} items`}>
            Cart <span className="ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs">{count}</span>
          </Link>
        )}
        <Link href={accountHref} className="academy-only text-sm font-medium opacity-80 hover:opacity-100">
          {accountLabel}
        </Link>
        <Link href="/academy/trial" className="academy-only sm-up bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85">
          Book a trial
        </Link>
        <Link href={accountHref} aria-label={accountLabel} className="club-only items-center gap-2 whitespace-nowrap rounded-full bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110 sm:px-4">
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="currentColor"><path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H3Z" /></svg>
          <span className="hidden sm:inline">{accountLabel}</span>
          <span className="sm:hidden">{me ? 'Account' : 'Login'}</span>
        </Link>
        <button
          ref={menuBtn}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="-mr-2 grid h-11 w-11 place-items-center lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Menu" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false) }} className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 pb-6 lg:hidden">
          <ul className="container-x divide-y divide-white/10">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={path.startsWith(n.href) ? 'page' : undefined} className="flex items-center justify-between py-4 text-lg font-semibold aria-[current=page]:text-accent">
                  {n.label}<span aria-hidden className="opacity-50">›</span>
                </Link>
              </li>
            ))}
            <li><Link href="/foundation-plus" className="flex items-center justify-between py-4 text-lg font-semibold">Foundation+ online training{!fplusLive && <span className="ml-2 rounded-sm bg-white/15 px-1.5 py-0.5 text-xs uppercase tracking-wider">Coming soon</span>}<span aria-hidden className="ml-auto pl-2 opacity-50">›</span></Link></li>
            {count > 0 && <li><Link href="/shop/cart" className="flex items-center justify-between py-4 text-lg font-semibold">Cart ({count})<span aria-hidden className="opacity-50">›</span></Link></li>}
          </ul>
          <div className="container-x mt-4 grid gap-3">
            <Link href={accountHref} className="rounded-full bg-accent py-3 text-center font-semibold text-accent-ink">{accountLabel}</Link>
            <Link href="/academy/trial" className="rounded-full border border-white/40 py-3 text-center font-semibold">Book an Academy trial</Link>
          </div>
        </nav>
      )}
    </header>
  )
}
