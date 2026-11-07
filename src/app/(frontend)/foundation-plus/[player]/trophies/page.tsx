import type { Metadata } from 'next'
import { formatDate } from '@/lib/payload'
import { foundationGate, loadCabinet, reportPlayer } from '@/academy/pdr/load'
import { BadgeArt } from '../../Badge'
import { Crumbs } from '../../ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Trophy Cabinet', robots: { index: false } }

export default async function Trophies({ params }: { params: Promise<{ player: string }> }) {
  const { player } = await params
  const { p, settings, user } = await foundationGate()
  const kid = await reportPlayer(p, user, player, `/foundation-plus/${player}/trophies`)
  const { cabinet, earned, total } = await loadCabinet(p, kid)
  return (
    <div>
      <Crumbs items={[{ href: '/foundation-plus', label: settings.name }, { href: `/foundation-plus/${kid.id}`, label: kid.firstName }, { label: 'Trophy Cabinet' }]} />
      <h1 className="font-display text-5xl font-bold uppercase tracking-tight">Trophy Cabinet</h1>
      <p className="mt-2 text-muted">{earned.length} of {total} badges earned. Finish every stage of a level to earn its badge.</p>
      <div className="mt-10 space-y-10">
        {cabinet.map(({ area, badges }) => (
          <section key={area.id}>
            <h2 className="font-display text-2xl font-semibold uppercase" style={{ color: area.colour ?? undefined }}>{area.name}</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {badges.map((b) => (
                <li key={b.id} className={`panel border p-5 text-center ${b.earnedAt ? 'gloss-sheen border-white/30' : 'border-line'}`}>
                  <div className="mx-auto w-fit"><BadgeArt badge={b} size={88} /></div>
                  <p className={`mt-3 font-semibold ${b.earnedAt ? '' : 'text-muted'}`}>{b.name}</p>
                  <p className="mt-1 text-xs text-muted">{b.earnedAt ? `Earned ${formatDate(b.earnedAt, { day: 'numeric', month: 'short', year: 'numeric' })}` : `🔒 ${b.howToEarn}`}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
