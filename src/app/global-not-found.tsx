import type { Metadata } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import { Header } from '@/components/Header'
import { NotFoundBody } from './(frontend)/not-found'
import './(frontend)/styles.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const barlow = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-barlow' })

export const metadata: Metadata = { title: 'Page not found · Rowville Eagles FC', robots: { index: false } }

/** Any address that matches no page at all (the site has two root layouts: website and admin). */
export default function GlobalNotFound() {
  return (
    <html lang="en-AU" className={`${inter.variable} ${barlow.variable}`}>
      <body>
        <Header />
        <main id="main">
          <NotFoundBody />
        </main>
      </body>
    </html>
  )
}
