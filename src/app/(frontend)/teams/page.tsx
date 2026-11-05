import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { teamCategories } from '@/collections/Teams'

export const revalidate = 60
export const metadata: Metadata = { title: 'Teams' }

export default async function TeamsPage() {
  const { docs } = await (await payload()).find({ collection: 'teams', limit: 200, depth: 0, sort: 'order' })
  const groups = teamCategories.map((c) => ({ ...c, teams: docs.filter((t) => t.category === c.value) })).filter((g) => g.teams.length)

  return (
    <>
      <section className="pitch-lines bg-[#0a1a3d] text-white">
        <div className="container-x py-16">
          <p className="eyebrow">2027 Season</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase sm:text-6xl">Our Teams</h1>
        </div>
      </section>
      <div className="container-x space-y-16 py-14">
        {groups.map((g) => (
          <section key={g.value}>
            <h2 className="font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">{g.label}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {g.teams.map((t) => (
                <div key={t.id} className="rounded-2xl border border-line p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t.ageGroup}</p>
                  <h3 className="mt-1 text-lg font-semibold">{t.name}</h3>
                  {t.competition && <p className="mt-1 text-sm text-muted">{t.competition}</p>}
                  {t.trainingTimes && <p className="mt-3 text-sm">🕒 {t.trainingTimes}</p>}
                </div>
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="text-muted">Teams for the new season will be listed soon.</p>}
      </div>
    </>
  )
}
