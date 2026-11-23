import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload } from '@/lib/payload'
import { SENIOR_TEAMS } from '@/site/collections'
import type { Media, SeniorTeam } from '@/payload-types'

export const revalidate = 3600
export const dynamicParams = false
export const generateStaticParams = () => SENIOR_TEAMS.map((t) => ({ team: t.slug }))

const DEFAULT_TAGLINE: Record<string, string> = {
  men: 'The Eagles’ senior men’s side.',
  reserves: 'Senior football with the Eagles’ reserves squad.',
  women: 'The Eagles’ senior women’s side.',
}

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params
  const t = SENIOR_TEAMS.find((x) => x.slug === team)
  return t ? { title: t.name, description: `${t.name} at Rowville Eagles Football Club — the team, the coach, the league and training details.` } : {}
}

const media = (v: unknown) => (v && typeof v === 'object' ? (v as Media) : null)

/** Senior Men / Reserves / Senior Women: about the team, the coach, the league, training, and how to join. */
export default async function SeniorTeamPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params
  const t = SENIOR_TEAMS.find((x) => x.slug === team)
  if (!t) notFound()
  const g = await (await payload()).findGlobal({ slug: 'senior-teams', depth: 1 })
  const d = ((g as SeniorTeam)[t.key] ?? {}) as NonNullable<SeniorTeam['men']>
  const photo = media(d.photo)
  const coachPhoto = media(d.coachPhoto)
  const training = (d.training ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
  return (
    <>
      <section className="pitch-lines relative overflow-hidden bg-[#0f2a55] text-white">
        {photo?.url && <Image src={photo.url} alt="" fill priority sizes="100vw" className="object-cover opacity-30" />}
        <div className="container-x relative py-20 md:py-28">
          <p className="eyebrow">Senior teams · 18+</p>
          <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none sm:text-7xl">{t.name}</h1>
          <p className="mt-5 max-w-xl text-lg text-white/80">{d.tagline || DEFAULT_TAGLINE[t.key]}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/join/seniors?team=${t.key}`} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink hover:brightness-110">Join the {t.name}</Link>
            {d.leagueUrl && <a href={d.leagueUrl} target="_blank" rel="noopener" className="rounded-full border border-white/30 px-6 py-3 font-semibold hover:bg-white/10">Fixtures & table ↗</a>}
          </div>
        </div>
      </section>

      <div className="container-x grid gap-10 py-16 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-12">
          <section>
            <p className="eyebrow !text-brand">The team</p>
            <h2 className="mt-2 font-[family-name:var(--font-barlow)] text-4xl font-bold uppercase">About the {t.name}</h2>
            <p className="mt-4 whitespace-pre-line text-lg text-muted" data-about>{d.about || `More about the ${t.name} is coming soon. Want to find out more now? Send an enquiry and the club secretary will be in touch.`}</p>
          </section>
          {(d.coachName || d.coachBio) && (
            <section className="rounded-2xl border border-line p-6 sm:p-8" data-coach>
              <p className="eyebrow !text-brand">{d.coachRole || 'Head coach'}</p>
              <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-start">
                {coachPhoto?.url && <Image src={coachPhoto.url} alt={d.coachName ?? ''} width={140} height={140} className="h-36 w-36 shrink-0 rounded-2xl object-cover" />}
                <div>
                  {d.coachName && <h2 className="font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">{d.coachName}</h2>}
                  {d.coachBio && <p className="mt-2 whitespace-pre-line text-muted">{d.coachBio}</p>}
                </div>
              </div>
            </section>
          )}
        </div>
        <aside className="space-y-5">
          <div className="rounded-2xl bg-surface-2 p-6" data-league>
            <h2 className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase">League</h2>
            <p className="mt-2">{d.league || 'To be confirmed for the season.'}</p>
            {d.matchDay && <p className="mt-2 text-sm text-muted">{d.matchDay}</p>}
          </div>
          <div className="rounded-2xl bg-surface-2 p-6" data-training>
            <h2 className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase">Training</h2>
            {training.length ? <ul className="mt-2 space-y-1">{training.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="mt-2 text-muted">Training times for the season will be posted here.</p>}
          </div>
          <div className="rounded-2xl bg-[#0f2a55] p-6 text-white">
            <h2 className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase">Want to play?</h2>
            <p className="mt-2 text-sm text-white/75">New players are always welcome. Send an enquiry and the club secretary will get back to you about training and trials.</p>
            <Link href={`/join/seniors?team=${t.key}`} className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110">Send an enquiry</Link>
          </div>
          <p className="text-sm text-muted">Other senior teams: {SENIOR_TEAMS.filter((x) => x.key !== t.key).map((x, i) => <span key={x.key}>{i > 0 && ' · '}<Link href={`/seniors/${x.slug}`} className="underline">{x.name}</Link></span>)}</p>
        </aside>
      </div>
    </>
  )
}
