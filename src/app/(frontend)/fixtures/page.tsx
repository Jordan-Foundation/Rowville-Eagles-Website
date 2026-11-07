import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { teamCategories } from '@/collections/Teams'
import type { Post, Team } from '@/payload-types'
import { formatDate } from '@/lib/format'
import type { Where } from 'payload'
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
    p.find({ collection: 'teams', where: { type: { not_equals: 'tournament' }, archived: { not_equals: true } }, limit: 200, depth: 0, sort: 'order' }),
    p.findGlobal({ slug: 'site-settings' }),
  ])
  const groups = teamCategories
    .map((c) => ({ value: c.value, label: c.label, teams: teams.filter((t) => t.category === c.value) }))
    .filter((g) => g.teams.length)
  const selected = teams.find((t) => t.slug === selectedSlug)
  const newsWhere: Where = selected
    ? { status: { equals: 'published' }, teams: { contains: selected.id } }
    : { status: { equals: 'published' }, or: [{ teams: { exists: true } }, { category: { in: ['Match report', 'Tournament', 'Seniors'] } }] }
  const { docs: newsDocs } = await p.find({ collection: 'posts', where: newsWhere, limit: 12, depth: 0, sort: '-publishedAt' })
  const allPosts = selected ? [] : newsDocs
  const teamPosts = selected ? newsDocs : []

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
          <div className="space-y-12">
            <TeamPanel team={selected} clubDribl={settings.links?.driblFixtures} ground={settings.ground?.address} />
            <TeamNews title={`${selected.name} news`} posts={teamPosts} teams={teams} empty={`No news for ${selected.name} yet.`} />
          </div>
        ) : (
          <TeamNews title="Team news" posts={allPosts} teams={teams} empty="Match reports, tournament results and senior game updates will appear here." />
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

function TeamNews({ title, posts, teams, empty }: { title: string; posts: Post[]; teams: Team[]; empty: string }) {
  const nameOf = (id: number | Team) => (typeof id === 'object' ? id.name : teams.find((t) => t.id === id)?.name)
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">{title}</h2>
        <Link href="/news" className="text-sm font-semibold text-brand hover:underline">All club news →</Link>
      </div>
      {posts.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">{empty}</p>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <Link
              key={post.id}
              href={`/news/${post.slug}`}
              className={`group flex flex-col rounded-2xl border border-line p-6 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg hover:shadow-black/5 ${i === 0 ? 'md:col-span-2 lg:col-span-2 bg-[#0f2a55] pitch-lines border-transparent text-white' : ''}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wider ${i === 0 ? 'text-accent' : 'text-brand'}`}>
                {post.category} · {formatDate(post.publishedAt)}
              </p>
              <h3 className={`mt-2 font-semibold ${i === 0 ? 'font-[family-name:var(--font-barlow)] text-3xl uppercase' : 'text-xl group-hover:text-brand'}`}>{post.title}</h3>
              <p className={`mt-2 flex-1 text-sm ${i === 0 ? 'text-white/75' : 'text-muted'}`}>{post.excerpt}</p>
              {(post.teams?.length ?? 0) > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {post.teams!.map((t) => (
                    <span key={typeof t === 'object' ? t.id : t} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${i === 0 ? 'bg-white/15' : 'bg-surface-2'}`}>{nameOf(t)}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
