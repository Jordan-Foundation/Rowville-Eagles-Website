import type { Metadata } from 'next'
import { payload } from '@/lib/payload'

export const metadata: Metadata = { title: 'Fixtures & Results' }

/**
 * Phase 3: pull fixtures/results per team via Dribl (team IDs are stored on each Team).
 * Until the integration is confirmed with Football Victoria / Dribl, link out to the club's Dribl page.
 */
export default async function FixturesPage() {
  const settings = await (await payload()).findGlobal({ slug: 'site-settings' })
  return (
    <div className="container-x py-16">
      <h1 className="font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase sm:text-6xl">Fixtures & Results</h1>
      <p className="mt-4 max-w-xl text-muted">Live fixtures, results and ladders for every Rowville Eagles team.</p>
      {settings.links?.driblFixtures ? (
        <a href={settings.links.driblFixtures} className="mt-8 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white">
          View on Dribl →
        </a>
      ) : (
        <p className="mt-8 text-sm text-muted">Fixtures link coming soon.</p>
      )}
    </div>
  )
}
