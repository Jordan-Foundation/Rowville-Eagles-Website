import Link from 'next/link'
import { clubBrand, telHref } from '@/academy/brand'

/** Shown when a page asks for something that doesn't exist (e.g. an old news link). Uses the site header/footer. */
export default function NotFound() {
  return <NotFoundBody />
}

export function NotFoundBody() {
  const links = [
    { href: '/programs', label: 'Camps & Programs' },
    { href: '/academy', label: 'Foundation Academy' },
    { href: '/join', label: 'Join the club' },
    { href: '/shop', label: 'Shop' },
    { href: '/news', label: 'News' },
    { href: '/account', label: 'My account' },
  ]
  return (
    <div className="container-x max-w-3xl py-20">
      <p className="eyebrow !text-brand">Page not found</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">That page has moved or doesn’t exist</h1>
      <p className="mt-4 text-muted">The link may be old, or the address mistyped. Try one of these instead:</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className="flex items-center justify-between rounded-2xl border border-line px-5 py-4 font-semibold hover:border-ink">{l.label}<span aria-hidden>→</span></Link></li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-muted">
        Still stuck? Call <a href={telHref(clubBrand.phone)} className="underline">{clubBrand.phone}</a> or email <a href={`mailto:${clubBrand.email}`} className="underline">{clubBrand.email}</a>.
      </p>
    </div>
  )
}
