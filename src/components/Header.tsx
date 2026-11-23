'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Crest, RfaLogo } from './Logos'
import { useCart } from '@/lib/cart'
import { useMe } from '@/lib/use-me'
import { FoundationPlusLogo } from './FoundationPlusLogo'
import { CartSync } from './CartSync'

type NavLink = { href: string; label: string; fplus?: boolean }
type NavItem = NavLink | { label: string; key: string; items: NavLink[] }

export const nav: NavItem[] = [
  { href: '/join', label: 'Join us' },
  { key: 'about', label: 'About', items: [{ href: '/about/history', label: 'History' }, { href: '/about/committee', label: 'Committee' }, { href: '/sponsors', label: 'Sponsors' }] },
  { key: 'seniors', label: 'Senior teams', items: [{ href: '/seniors/senior-men', label: 'Senior Men' }, { href: '/seniors/reserves', label: 'Reserves' }, { href: '/seniors/senior-women', label: 'Senior Women' }] },
  { key: 'juniors', label: 'Junior football', items: [{ href: '/what-makes-us-different', label: 'Why us' }, { href: '/programs', label: 'Camps & Programs' }] },
  { key: 'academy', label: 'Academy', items: [{ href: '/academy', label: 'Foundation Academy' }, { href: '/academy/trial', label: 'Book a free trial' }, { href: '/academy/1-on-1', label: '1-on-1 coaching' }, { href: '/foundation-plus', label: 'Foundation+', fplus: true }] },
  { href: '/events', label: 'Events' },
  { href: '/shop', label: 'Shop' },
  { href: '/news', label: 'News' },
]

const isGroup = (n: NavItem): n is { label: string; key: string; items: NavLink[] } => 'items' in n
const here = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`))

/** Dropdown entry: Foundation+ shows its small F+ mark */
function ItemLabel({ l, fplusLive }: { l: NavLink; fplusLive: boolean }) {
  if (!l.fplus) return <>{l.label}</>
  return (
    <span className="inline-flex items-center gap-2">
      <FoundationPlusLogo variant="mark" tone="white" height={18} alt="" />
      {l.label}
      {!fplusLive && <span className="rounded-sm bg-white/15 px-1 text-[9px] font-bold uppercase leading-[14px] tracking-wider">Soon</span>}
    </span>
  )
}

export function Header({ fplusLive = true }: { fplusLive?: boolean }) {
  const path = usePathname() ?? ''
  const { count } = useCart()
  const me = useMe()
  const accountHref = me ? '/account' : '/login'
  const accountLabel = me ? 'My account' : 'Login'
  const [open, setOpen] = useState(false)
  const [drop, setDrop] = useState<string | null>(null)
  const [section, setSection] = useState<string | null>(null)
  const menuBtn = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const hoverAt = useRef(0)
  // Close the menus when the page changes, and with Escape / a click elsewhere
  useEffect(() => { setOpen(false); setDrop(null) }, [path])
  useEffect(() => {
    if (!drop) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrop(null) }
    const onClick = (e: MouseEvent) => { if (!navRef.current?.contains(e.target as Node)) setDrop(null) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [drop])
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
        <nav ref={navRef} aria-label="Main" className="hidden items-center gap-3 whitespace-nowrap text-[13px] font-medium lg:flex xl:gap-6 xl:text-sm">
          {nav.map((n) =>
            isGroup(n) ? (
              <div key={n.key} className="relative" onMouseEnter={() => { hoverAt.current = Date.now(); setDrop(n.key) }} onMouseLeave={() => setDrop((d) => (d === n.key ? null : d))}>
                <button
                  type="button"
                  aria-expanded={drop === n.key}
                  aria-controls={`nav-${n.key}`}
                  onClick={() => setDrop((d) => (d === n.key && Date.now() - hoverAt.current > 600 ? null : n.key))}
                  className={`flex items-center gap-1 py-5 transition hover:opacity-100 ${n.items.some((l) => here(path, l.href)) || drop === n.key ? 'opacity-100' : 'opacity-75'}`}
                >
                  {n.label}
                  <svg viewBox="0 0 12 12" className={`h-3 w-3 transition ${drop === n.key ? 'rotate-180' : ''}`} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
                </button>
                {drop === n.key && (
                  <ul id={`nav-${n.key}`} data-nav-menu={n.key} className="absolute left-1/2 top-full z-50 min-w-52 -translate-x-1/2 border border-white/10 bg-[#0f2a55] py-2 text-sm shadow-xl [body:has([data-page-brand=academy])_&]:bg-black [body:has([data-page-brand=fplus])_&]:bg-[#0b0b0c]">
                    {n.items.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} aria-current={here(path, l.href) ? 'page' : undefined} className="block px-4 py-2.5 opacity-80 transition hover:bg-white/10 hover:opacity-100 aria-[current=page]:opacity-100">
                          <ItemLabel l={l} fplusLive={fplusLive} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                aria-current={here(path, n.href) ? 'page' : undefined}
                className={`transition hover:opacity-100 ${here(path, n.href) ? 'opacity-100' : 'opacity-75'} ${n.href === '/join' ? 'club-only font-semibold text-accent !opacity-100' : ''}`}
              >
                {n.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex items-center gap-4">
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
            {nav.map((n) =>
              isGroup(n) ? (
                <li key={n.key}>
                  <button type="button" aria-expanded={section === n.key} onClick={() => setSection((x) => (x === n.key ? null : n.key))} className="flex w-full items-center justify-between py-4 text-left text-lg font-semibold">
                    {n.label}
                    <svg viewBox="0 0 12 12" className={`h-4 w-4 opacity-60 transition ${section === n.key ? 'rotate-180' : ''}`} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
                  </button>
                  {section === n.key && (
                    <ul className="-mt-1 pb-3 pl-4">
                      {n.items.map((l) => (
                        <li key={l.href}>
                          <Link href={l.href} aria-current={here(path, l.href) ? 'page' : undefined} className="flex items-center justify-between py-2.5 text-base opacity-85 aria-[current=page]:text-accent">
                            <ItemLabel l={l} fplusLive={fplusLive} /><span aria-hidden className="opacity-50">›</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ) : (
                <li key={n.href}>
                  <Link href={n.href} aria-current={here(path, n.href) ? 'page' : undefined} className="flex items-center justify-between py-4 text-lg font-semibold aria-[current=page]:text-accent">
                    {n.label}<span aria-hidden className="opacity-50">›</span>
                  </Link>
                </li>
              ),
            )}
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
