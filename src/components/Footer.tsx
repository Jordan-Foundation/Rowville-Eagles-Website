import Link from 'next/link'
import type { SiteSetting } from '@/payload-types'
import { Crest, RfaLogo } from './Logos'

export function Footer({ settings }: { settings: SiteSetting }) {
  const { ground, links } = settings
  return (
    <footer className="site-footer bg-[#0f2a55] text-white/80">
      <div className="container-x grid gap-10 py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="flex items-center gap-4 text-white">
            <Crest className="h-16 w-auto" />
            <div>
              <p className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase tracking-wide">{settings.clubName}</p>
              <p className="text-xs uppercase tracking-[0.25em] text-white/60">Established 1985</p>
            </div>
          </div>
          {settings.tagline && <p className="mt-5 max-w-sm text-sm">{settings.tagline}</p>}
          <Link href="/academy" className="mt-6 inline-flex items-center gap-3 border border-white/15 bg-black px-4 py-3 transition hover:border-white/40">
            <RfaLogo className="h-5 w-auto" ink="#fff" paper="#000" />
            <span className="text-xs uppercase tracking-[0.2em] text-white/70">Foundation Academy →</span>
          </Link>
        </div>
        <div className="text-sm md:col-span-3">
          <h3 className="mb-3 font-semibold text-white">Home ground</h3>
          {ground?.name && <p>{ground.name}</p>}
          {ground?.address && <p>{ground.address}</p>}
          {ground?.mapUrl && (
            <a href={ground.mapUrl} className="footer-accent mt-2 inline-block text-accent hover:underline">
              Get directions →
            </a>
          )}
        </div>
        <div className="text-sm md:col-span-3">
          <h3 className="mb-3 font-semibold text-white">Contact</h3>
          {settings.email && (
            <a href={`mailto:${settings.email}`} className="hover:text-white">
              {settings.email}
            </a>
          )}
        </div>
        <div className="text-sm md:col-span-2">
          <h3 className="mb-3 font-semibold text-white">Follow</h3>
          <ul className="space-y-1">
            {links?.facebook && <li><a href={links.facebook} className="hover:text-white" rel="noopener" target="_blank">Facebook</a></li>}
            {links?.instagram && <li><a href={links.instagram} className="hover:text-white" rel="noopener" target="_blank">Instagram</a></li>}
            <li className="pt-2"><Link href="/sponsors" className="hover:text-white">Our sponsors</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-rule border-t border-white/10">
        <div className="container-x flex flex-col justify-between gap-2 py-5 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {settings.clubName}</p>
          <p>
            A Child Safe club · <Link href="/admin" className="hover:text-white">Committee login</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
