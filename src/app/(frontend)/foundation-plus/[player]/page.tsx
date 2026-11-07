import Link from 'next/link'
import type { Metadata } from 'next'
import { foundationGate, loadCabinet, loadReport, reportPlayer } from '@/academy/pdr/load'
import { BadgeArt } from '../Badge'
import { Celebrate } from '../Celebrate'
import { PrivacyForm } from './PrivacyForm'
import { displayName } from '@/academy/pdr/leaderboard'
import { TIER_LABEL } from '@/academy/pdr/report'
import { Bar, Crumbs } from '../ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Player page', robots: { index: false } }

export default async function PlayerReport({ params }: { params: Promise<{ player: string }> }) {
  const { player } = await params
  const { p, settings, user } = await foundationGate()
  const kid = await reportPlayer(p, user, player, `/foundation-plus/${player}`)
  const { report, tier } = await loadReport(p, kid)
  const passed = report.reduce((n, a) => n + a.passed, 0)
  const { earned, total, toCelebrate } = await loadCabinet(p, kid)
  const owner = (typeof kid.account === 'object' ? kid.account?.id : kid.account) === user?.id

  return (
    <div>
      <Crumbs items={[{ href: '/foundation-plus', label: settings.name }, { label: kid.firstName }]} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{settings.name} · {TIER_LABEL[tier]} plan</p>
          <h1 className="mt-2 font-display text-5xl font-bold uppercase tracking-tight">{kid.firstName} {kid.lastName.charAt(0)}.</h1>
        </div>
        <div className="text-right text-sm">
          <p className="text-muted">{passed} stage{passed === 1 ? '' : 's'} passed</p>
          <Link href="/foundation-plus/leaderboards" className="mt-1 inline-block font-semibold uppercase tracking-[0.15em]">🏆 Leaderboards →</Link>
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {report.map((a) => (
          <Link key={a.area.id} href={`/foundation-plus/${kid.id}/${a.area.slug}`} className="panel gloss-sheen group block border border-line p-6 transition hover:border-white/40" style={{ borderTop: `3px solid ${a.area.colour || '#fff'}` }}>
            <p className="font-display text-2xl font-semibold uppercase">{a.area.name}</p>
            <p className="mt-1 text-sm text-muted">
              {a.finished ? 'All levels complete 🏆' : a.current ? `Level ${a.current.level.number} · ${a.current.passed}/${a.current.total} stages` : 'Coming soon'}
            </p>
            <div className="mt-4"><Bar percent={a.percent} colour={a.area.colour} /></div>
            <p className="mt-2 text-xs text-muted">{a.passed} of {a.total} stages overall</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] transition group-hover:translate-x-1">Open →</p>
          </Link>
        ))}
      </div>
      <section className="panel mt-8 border border-line p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold uppercase">Trophy Cabinet</h2>
          <Link href={`/foundation-plus/${kid.id}/trophies`} className="text-sm font-semibold uppercase tracking-[0.15em]">{earned.length}/{total} badges →</Link>
        </div>
        {earned.length ? (
          <ul className="mt-4 flex flex-wrap gap-5">
            {earned.slice(0, 4).map((b) => (
              <li key={b.id} className="w-24 text-center">
                <div className="mx-auto w-fit"><BadgeArt badge={b} size={72} /></div>
                <p className="mt-2 text-xs font-semibold">{b.name}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No badges yet — pass all the stages of a level to earn your first one.</p>
        )}
      </section>

      {owner && toCelebrate.length > 0 && (
        <Celebrate player={kid.id} badges={toCelebrate.map((b) => ({ awardId: b.awardId!, name: b.name, area: b.area.name, level: b.level, art: <BadgeArt badge={b} size={140} /> }))} />
      )}

      {owner && (
        <section className="panel mt-8 border border-line p-6">
          <h2 className="font-display text-xl font-semibold uppercase">Leaderboard privacy</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            {kid.pdr?.leaderboardOptOut ? `${kid.firstName} is hidden from leaderboards.` : `${kid.firstName} shows as “${displayName(kid)}” with their age group — no surname, school or photo.`}
          </p>
          <PrivacyForm player={kid.id} show={!kid.pdr?.leaderboardOptOut} name={kid.pdr?.leaderboardName ?? ''} fallback={displayName({ ...kid, pdr: null })} />
        </section>
      )}

      {tier === 'free' && (
        <div className="panel mt-8 border border-line p-6">
          <p className="font-semibold">On the Free plan, Level 1 of every area is open.</p>
          <p className="mt-1 text-sm text-muted">Standard and Premium unlock Levels 2 and up. Plans are coming soon.</p>
        </div>
      )}
    </div>
  )
}
