import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { logContactView, playerProfile } from '@/academy/coach-players'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Player', robots: { index: false } }

const when = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const day = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const STATUS: Record<string, string> = { not_started: 'Not started', draft: 'Draft', submitted: 'Submitted', returned: 'Returned to coach', approved: 'Approved', released: 'Released to family' }

function Section({ title, id, count, children }: { title: string; id: string; count?: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3" data-section={id}>
      <h2 id={id} className="font-display text-xl font-semibold uppercase">{title}{count !== undefined && <span className="ml-2 text-sm text-muted">({count})</span>}</h2>
      {children}
    </section>
  )
}

/** A coach's view of one of their players: contacts, sessions, summaries, reports, reflections, goals. */
export default async function CoachPlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, coach } = await requireCoach(`/coach/players/${id}`)
  const p = await payload()
  const kidId = Number(id)
  if (!Number.isInteger(kidId)) notFound()
  const pr = await playerProfile(p, coach, user, kidId)
  if (!pr) {
    return (
      <div className="space-y-4" data-not-mine>
        <h1 className="font-display text-3xl font-semibold uppercase">Not one of your players</h1>
        <p className="text-muted">You can only open the profiles of players you coach (your groups, teams, 1-on-1s and small groups).</p>
        <Link href="/coach/players" className="underline">← My players</Link>
      </div>
    )
  }
  await logContactView(p, user, pr.kid)
  return (
    <div className="space-y-10 pb-12">
      <p><Link href="/coach/players" className="text-sm text-muted underline">← My players</Link></p>
      <header className="flex flex-wrap items-center gap-5" data-profile-header>
        {pr.photoUrl ? (
          <Image src={pr.photoUrl} alt="" width={88} height={88} className="h-22 w-22 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="grid h-22 w-22 place-items-center rounded-full border border-line font-display text-3xl font-semibold">{pr.kid.firstName[0]}{pr.kid.lastName[0]}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{pr.name}</h1>
          <p className="mt-1 text-muted">{[pr.birthYear && `Born ${pr.birthYear}`, pr.ageGroup].filter(Boolean).join(' · ')}</p>
          {pr.where.length > 0 && <p className="mt-1 text-sm" data-programs>{pr.where.join(' · ')}</p>}
        </div>
        <Link href={`/foundation-plus/${pr.kid.id}`} className="bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-black" data-fplus>Open in Foundation+</Link>
      </header>

      <section aria-labelledby="contacts" className="border-2 border-red-500/60 p-5" data-section="contacts">
        <h2 id="contacts" className="font-display text-xl font-semibold uppercase">Emergency contacts</h2>
        {pr.contacts.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {pr.contacts.map((c) => (
              <li key={c.tel} className="flex items-center justify-between gap-3 border border-line p-3" data-contact>
                <span><span className="block font-semibold">{c.name}</span><span className="text-xs text-muted">{c.relationship} · {c.phone}</span></span>
                <a href={c.tel} className="shrink-0 bg-white px-4 py-2.5 text-sm font-semibold text-black" aria-label={`Call ${c.name}`}>Call</a>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">No phone numbers on file — ask Management.</p>}
        {pr.medical && <p className="mt-4 border-l-4 border-red-500 pl-3 text-sm" data-medical><strong>Medical:</strong> {pr.medical}</p>}
      </section>

      <Section title="Upcoming sessions with you" id="upcoming" count={pr.upcoming.length}>
        {pr.upcoming.length ? (
          <ul className="divide-y divide-line border border-line">
            {pr.upcoming.slice(0, 10).map((s) => (
              <li key={`${s.at}-${s.label}`} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span><span className="font-semibold">{when(s.at)}</span><span className="block text-xs text-muted">{s.label}</span></span>
                {s.href && <Link href={s.href} className="text-xs underline">Open</Link>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Nothing booked with you right now.</p>}
      </Section>

      <Section title="Session summaries" id="summaries" count={pr.summaries.length}>
        {pr.summaries.length ? (
          <ul className="space-y-2">
            {pr.summaries.map((s, i) => (
              <li key={s.id}>
                <details className="border border-line p-3" open={i === 0} data-summary>
                  <summary className="cursor-pointer text-sm"><span className="font-semibold">{day(s.at)}</span> · {s.kind}{s.coach ? ` · ${s.coach}` : ''}{s.workedOn.length ? ` · ${s.workedOn.join(', ')}` : ''}</summary>
                  <dl className="mt-3 space-y-2 text-sm">
                    {s.workedOn.length > 0 && <div><dt className="text-xs uppercase tracking-wider text-muted">Worked on</dt><dd>{s.workedOn.join(', ')}</dd></div>}
                    {s.wentWell && <div><dt className="text-xs uppercase tracking-wider text-muted">What went well</dt><dd className="whitespace-pre-line">{s.wentWell}</dd></div>}
                    {s.note && <div><dt className="text-xs uppercase tracking-wider text-muted">About {pr.kid.firstName}</dt><dd className="whitespace-pre-line">{s.note}</dd></div>}
                    {s.nextSteps && <div><dt className="text-xs uppercase tracking-wider text-muted">Next steps</dt><dd className="whitespace-pre-line">{s.nextSteps}</dd></div>}
                    {s.homework && <div><dt className="text-xs uppercase tracking-wider text-muted">Practise at home</dt><dd className="whitespace-pre-line">{s.homework}</dd></div>}
                  </dl>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No session summaries yet.</p>}
      </Section>

      <Section title="Player Development Reports" id="reports" count={pr.reports.length}>
        {pr.reports.length ? (
          <ul className="divide-y divide-line border border-line">
            {pr.reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span><span className="font-semibold">{r.cycle}</span><span className="block text-xs text-muted">{STATUS[r.status] ?? r.status}{r.releasedAt ? ` · ${day(r.releasedAt)}` : ''}</span></span>
                {r.mine && <Link href={`/coach/reports/${r.id}`} className="text-xs underline">Open</Link>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No reports yet.</p>}
      </Section>

      {pr.inTeam && (
        <Section title="Match reflections" id="reflections" count={pr.reflections.length}>
          {pr.reflections.length ? (
            <ul className="space-y-2">
              {pr.reflections.map((r) => (
                <li key={r.id} className="border border-line p-3 text-sm" data-reflection>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{day(r.at)} · {r.team}{r.opponent ? ` v ${r.opponent}` : ''}</span>
                    <Link href={r.href} className="text-xs underline">Open</Link>
                  </div>
                  {r.moments.length > 0 && <ul className="mt-2 space-y-1">{r.moments.map((m, i) => <li key={i}><span className="text-xs uppercase tracking-wider text-muted">{m.type === 'great' ? 'Did well' : 'To work on'}{m.pillar ? ` · ${m.pillar}` : ''}:</span> {m.comment}</li>)}</ul>}
                  {r.focus && <p className="mt-1 text-xs text-muted">Focus for next game: {r.focus}</p>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No match reflections yet.</p>}
        </Section>
      )}

      <Section title="Goals" id="goals">
        {pr.goals ? <p className="whitespace-pre-line border border-line p-3 text-sm" data-goals>{pr.goals}</p> : <p className="text-sm text-muted">No goals set yet.</p>}
      </Section>
    </div>
  )
}
