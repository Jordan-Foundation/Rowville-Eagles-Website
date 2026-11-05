import React from 'react'
import type { Metadata } from 'next'
import { Barlow_Condensed, Cormorant_Garamond, Inter } from 'next/font/google'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { payload } from '@/lib/payload'
import './styles.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const barlow = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-barlow' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cormorant' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.rowvilleeagles.com.au'),
  title: { default: 'Rowville Eagles Football Club', template: '%s · Rowville Eagles FC' },
  description: 'Community football in Rowville, Victoria — MiniRoos, juniors, seniors and the Foundation Academy.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await (await payload()).findGlobal({ slug: 'site-settings' })
  return (
    <html lang="en-AU" className={`${inter.variable} ${barlow.variable} ${cormorant.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer settings={settings} />
      </body>
    </html>
  )
}
