import React from 'react'
import type { Metadata } from 'next'
import { Barlow_Condensed, Inter, Space_Grotesk } from 'next/font/google'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { payload } from '@/lib/payload'
import { foundationSettings } from '@/academy/pdr/load'
import './styles.css'
import { siteBase } from '@/lib/seo'
import { Tracking } from '@/tracking/Tracking'
import { trackingAllowed, trackingConfig } from '@/tracking/config'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const barlow = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-barlow' })
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-grotesk' })

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://www.rowvilleeagles.com.au'),
  ),
  title: { default: 'Rowville Eagles Football Club', template: '%s · Rowville Eagles FC' },
  description: 'Community football in Rowville, Victoria — MiniRoos, juniors, seniors and the Rowville Foundation Academy. Est. 1985.',
  // Browser tab: the Rowville Eagles crest. Family pages switch the home-screen app to the family's brand (src/lib/app-brand.ts)
  icons: { icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' }, { url: '/icons/favicon-96.png', type: 'image/png', sizes: '96x96' }, { url: '/icons/crest-192.png', type: 'image/png', sizes: '192x192' }], apple: '/icons/eagles-apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Rowville Eagles', statusBarStyle: 'black-translucent' },
  // Search result thumbnail: the crest on solid white (the transparent crest shows on a grey background)
  other: { thumbnail: 'https://www.rowvilleeagles.com.au/brand/rowville-eagles-crest-square.png' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const p = await payload()
  const [settings, fplus] = await Promise.all([p.findGlobal({ slug: 'site-settings' }), foundationSettings(p)])
  // Meta Pixel / Google tag: live site only, set in Admin → Site settings → Ad tracking
  const tracking = trackingAllowed(process.env) ? trackingConfig(settings.tracking) : null
  return (
    <html lang="en-AU" data-scroll-behavior="smooth" className={`${inter.variable} ${barlow.variable} ${grotesk.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black">
          Skip to content
        </a>
        <script
          type="application/ld+json"
          // Structured data so search engines recognise the club (name, location, socials)
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SportsOrganization',
              '@id': `${siteBase()}/#club`,
              url: siteBase(),
              name: settings.clubName,
              telephone: '+61495101515',
              sport: 'Soccer',
              foundingDate: '1985',
              email: settings.email || undefined,
              address: settings.ground?.address ? { '@type': 'PostalAddress', streetAddress: settings.ground.address, addressCountry: 'AU' } : undefined,
              sameAs: [settings.links?.facebook, settings.links?.instagram].filter(Boolean),
              logo: `${siteBase()}/brand/rowville-eagles-crest-square.png`,
              image: `${siteBase()}/brand/rowville-eagles-crest-square.png`,
            }).replace(/</g, '\\u003c'),
          }}
        />
        <Header fplusLive={fplus.enabled} />
        <main id="main">{children}</main>
        <Footer settings={settings} />
        {tracking && <Tracking cfg={tracking} />}
      </body>
    </html>
  )
}
