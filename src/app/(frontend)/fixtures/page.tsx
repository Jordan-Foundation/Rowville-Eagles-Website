import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { teamCategories } from '@/collections/Teams'
import type { Team } from '@/payload-types'
import { TeamSelect } from './TeamSelect'

export const metadata: Metadata = { title: 'Fixtures & Results' }

/**
 * Per-team fixtures. Each team's Dribl link is set in the admin (Teams → Dribl fixtures link).
 * When Dribl data access is confirmed, live fixtures/results replace the link-out panel.
 */
export default async function FixturesPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const { team: selectedSlug } = await searchParams
  const p = await payload()
  const [{ docs: teams }, settings] = await Promise.all([
    p.find({ collection: 'teams', limit: 200, depth: 0, sort: 'order' }),
    p.findGlobal({ slug: 'site-settings' }),
  ])
  const groups = teamCategories
    .map((c) => ({ value: c.value, label: c.label, teams: teams.filter((t) => t.category === c.value) }))
    .filter((g) => g.teams.length)
  const selected = teams.find((t) => t.slug === selectedSlug)

  return (
    <>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x py-16">
          <p className="eyebrow">2027 Season</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase sm:text-6xl">Fixtures & Results</h1>
          <div className="mt-8">
            <TeamSelect groups={groups.map((g) => ({ label: g.label, teams: g.teams.map((t) => ({ slug: t.slug, name: t.name })) }))} value={selected?.slug} />
          </div>
        </div>
      </section>

      <div className="container-x py-14">
        {selected ? (
          <TeamPanel team={selected} clubDribl={settings.links?.driblFixtures} ground={settings.ground?.address} />
        ) : (
          <div className="space-y-14">
            {groups.map((g) => (
              <section key={g.value}>
                <h2 className="font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">{g.label}</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {g.teams.map((t) => (
                    <Link
                      key={t.id}
                      href={`/fixtures?team=${t.slug}`}
                      scroll={false}
                      className="group rounded-2xl border border-line p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg hover:shadow-black/5"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t.ageGroup}</p>
                      <h3 className="mt-1 text-lg font-semibold">{t.name}</h3>
                      <p className="mt-3 text-sm font-semibold text-muted group-hover:text-brand">Fixtures →</p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
            {groups.length === 0 && <p className="text-muted">Teams for the new season will be listed soon.</p>}
          </div>
        )}
      </div>
    </>
  )
}

function TeamPanel({ team, clubDribl, ground }: { team: Team; clubDribl?: string | null; ground?: string | null }) {
  const category = teamCategories.find((c) => c.value === team.category)?.label
  const dribl = team.driblUrl || clubDribl
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section className="rounded-2xl border border-line p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">{[category, team.ageGroup].filter(Boolean).join(' · ')}</p>
        <h2 className="mt-2 font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase">{team.name}</h2>
        <div className="mt-8 rounded-xl bg-surface-2 p-6">
          <h3 className="font-semibold">Fixtures & results</h3>
          {dribl ? (
            <>
              <p className="mt-2 text-sm text-muted">Live fixtures, results and the ladder for {team.name} are on Dribl.</p>
              <a href={dribl} target="_blank" rel="noopener" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110">
                View {team.name} on Dribl →
              </a>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Fixtures for this team will be published once the season draw is released.</p>
          )}
        </div>
      </section>
      <aside className="h-fit rounded-2xl border border-line bg-surface-2 p-7">
        <dl className="space-y-4 text-sm">
          {team.competition && <div><dt className="text-muted">Competition</dt><dd className="mt-0.5 font-medium">{team.competition}</dd></div>}
          {team.trainingTimes && <div><dt className="text-muted">Training</dt><dd className="mt-0.5 font-medium">{team.trainingTimes}</dd></div>}
          {ground && <div><dt className="text-muted">Home ground</dt><dd className="mt-0.5 font-medium">{ground}</dd></div>}
        </dl>
        <Link href="/fixtures" scroll={false} className="mt-6 inline-block text-sm font-semibold text-brand hover:underline">← All teams</Link>
      </aside>
    </div>
  )
}
