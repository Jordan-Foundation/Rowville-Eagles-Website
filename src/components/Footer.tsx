import Link from 'next/link'
import type { SiteSetting } from '@/payload-types'
import { Crest } from './Crest'

export function Footer({ settings }: { settings: SiteSetting }) {
  return (
    <footer className="bg-[#0a1a3d] text-white/80" style={{ ['--brand' as string]: '#12306b', ['--accent' as string]: '#f5b301' }}>
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 text-white">
            <Crest className="h-11 w-10" />
            <span className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase tracking-wide">{settings.clubName}</span>
          </div>
          {settings.tagline && <p className="mt-4 max-w-sm text-sm">{settings.tagline}</p>}
        </div>
        <div className="text-sm">
          <h3 className="mb-3 font-semibold text-white">Visit</h3>
          <p>{settings.ground?.name}</p>
          <p>{settings.ground?.address}</p>
        </div>
        <div className="text-sm">
          <h3 className="mb-3 font-semibold text-white">Contact</h3>
          {settings.email && <p><a href={`mailto:${settings.email}`} className="hover:text-white">{settings.email}</a></p>}
          <div className="mt-3 flex gap-4">
            {settings.links?.facebook && <a href={settings.links.facebook} className="hover:text-white">Facebook</a>}
            {settings.links?.instagram && <a href={settings.links.instagram} className="hover:text-white">Instagram</a>}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
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
