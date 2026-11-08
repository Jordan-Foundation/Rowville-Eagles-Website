import React from 'react'
import type { Metadata } from 'next'
import { Barlow_Condensed, Inter, Space_Grotesk } from 'next/font/google'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { payload } from '@/lib/payload'
import { foundationSettings } from '@/academy/pdr/load'
import './styles.css'
import { siteBase } from '@/lib/seo'

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
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const p = await payload()
  const [settings, fplus] = await Promise.all([p.findGlobal({ slug: 'site-settings' }), foundationSettings(p)])
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
              logo: `${siteBase()}/brand/rowville-eagles-crest.png`,
            }).replace(/</g, '\\u003c'),
          }}
        />
        <Header fplusLive={fplus.enabled} />
        <main id="main">{children}</main>
        <Footer settings={settings} />
      </body>
    </html>
  )
}
