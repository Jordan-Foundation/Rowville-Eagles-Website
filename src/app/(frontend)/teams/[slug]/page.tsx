import { hasRole } from '@/access'
import { ContactButtons, MedicalBadge } from '@/components/coach/ContactButtons'
import { formatPhone } from '@/lib/phone'
import { markSeen } from '@/lib/seen'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { teamAccess, teamTitle } from '@/teams/service'
import type { ForumReply, Participant, Team, User } from '@/payload-types'
import { FixtureForm, FixtureTools, ModTools, NoticeForm, NoticeTools, ReplyForm, ThreadForm, TrainingForm } from './TeamForms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Team', robots: { index: false } }

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const clock = (hhmm?: string | null) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}
const who = (u: unknown) => (u && typeof u === 'object' ? [(u as User).firstName, (u as User).lastName].filter(Boolean).join(' ') || 'Member' : 'Member')
const stamp = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function Section({ id, title, children, action }: { id: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-line p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?next=/teams/${slug}`)
  const p = await payload()
  const team = (await p.find({ pagination: false, collection: 'teams', where: { slug: { equals: slug } }, limit: 1, depth: 1, overrideAccess: true })).docs[0] as Team | undefined
  if (team && user) void markSeen(p, user.id, `team:${team.id}`)
  if (!team) notFound()
  const access = await teamAccess(p, user, team)
  if (!access.view) notFound()

  const sections = { info: true, notices: true, fixtures: true, training: true, forum: true, ...(team.sections ?? {}) }
  const tournament = team.type === 'tournament'
  const showForum = !tournament && sections.forum !== false
  const [{ docs: posts }, { docs: threads }, { docs: members }] = await Promise.all([
    p.find({ pagination: false, collection: 'team-posts', where: { team: { equals: team.id } }, sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true }),
    showForum ? p.find({ pagination: false, collection: 'forum-threads', where: { team: { equals: team.id }, removedAt: { exists: false } }, sort: '-lastActivityAt', limit: 50, depth: 1, overrideAccess: true }) : Promise.resolve({ docs: [] }),
    access.manage ? p.find({ pagination: false, collection: 'team-members', where: { team: { equals: team.id }, active: { equals: true } }, depth: 1, limit: 200, overrideAccess: true }) : Promise.resolve({ docs: [] }),
  ])
  const replies = threads.length
    ? (await p.find({ pagination: false, collection: 'forum-replies', where: { thread: { in: threads.map((t) => t.id) }, removedAt: { exists: false } }, sort: 'createdAt', limit: 1000, depth: 1, overrideAccess: true })).docs
    : []
  const ordered = [...posts].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  const threadsOrdered = [...threads].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
  const trainingRecent = team.trainingChangedAt && Date.now() - new Date(team.trainingChangedAt).getTime() < 14 * 86_400_000
  const training = [...(team.training ?? [])].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.start.localeCompare(b.start))
  const fixtures = team.fixtures ?? []
  const now = Date.now()
  const info = team.info ?? {}
  const infoRows = ([['Dates', info.dates], ['Venue(s)', info.venues], ['Schedule', info.schedule], ['What to bring', info.whatToBring], ['Costs', info.costs], ['Contacts', info.contacts]] as const).filter(([, v]) => v)

  return (
    <div data-brand={team.brand === 'academy' ? 'academy' : undefined} data-page-brand={team.brand === 'academy' ? 'academy' : undefined}>
      <div className="container-x py-14">
        <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
        <p className="eyebrow mt-6 !text-brand">{tournament ? 'Tournament team' : 'Team'}{team.season ? ` · ${team.season}` : ''}{team.ageGroup ? ` · ${team.ageGroup}` : ''}{team.archived ? ' · archived' : ''}</p>
        <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase sm:text-5xl">{teamTitle(team)}</h1>
        {access.manage && <p className="mt-2 text-sm text-muted">You manage this team: post notices, edit {tournament ? 'fixtures' : 'training and fixtures'}{showForum ? ' and moderate Team Chat' : ''}. Details like venues and contacts are edited in the admin (Teams).</p>}
        <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2 text-sm">
          {[tournament && sections.info !== false && ['info', 'Tournament info'], sections.notices !== false && ['notices', tournament ? 'Message board' : 'Notice board'], sections.fixtures !== false && ['fixtures', 'Fixtures'], !tournament && sections.training !== false && ['training', 'Training'], showForum && ['team-chat', 'Team Chat'], access.manage && ['members', 'Players']]
            .filter(Boolean)
            .map((x) => {
              const [id, label] = x as [string, string]
              return <a key={id} href={`#${id}`} className="rounded-full border border-line px-4 py-2 font-semibold hover:border-brand">{label}</a>
            })}
        </nav>

        <div className="mt-8 grid gap-6">
          {tournament && sections.info !== false && (
            <Section id="info" title="Tournament info" action={team.externalUrl ? <a href={team.externalUrl} target="_blank" rel="noopener" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Tournament website ↗</a> : undefined}>
              {infoRows.length ? (
                <dl className="grid gap-4 sm:grid-cols-2">
                  {infoRows.map(([k, v]) => (
                    <div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</dt><dd className="mt-1 whitespace-pre-line">{v}</dd></div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted">Tournament details are coming soon.</p>
              )}
            </Section>
          )}

          {sections.notices !== false && (
            <Section id="notices" title={tournament ? 'Message board' : 'Notice board'}>
              {access.manage && <div className="mb-6 rounded-xl bg-surface-2 p-4"><NoticeForm slug={team.slug} families={new Set(members.map((m) => (typeof m.account === 'object' ? m.account?.id : m.account))).size} /></div>}
              {ordered.length === 0 ? (
                <p className="text-muted">No notices yet.</p>
              ) : (
                <ol className="space-y-4">
                  {ordered.map((n) => (
                    <li key={n.id} className={`rounded-xl border p-5 ${n.pinned ? 'border-accent bg-accent/10' : 'border-line'}`}>
                      <p className="font-semibold">{n.pinned && <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-ink">Pinned</span>}{n.title}</p>
                      <p className="mt-2 whitespace-pre-line">{n.body}</p>
                      <p className="mt-3 text-xs text-muted">
                        {who(n.author)} · {stamp(n.createdAt)}{n.editedAt ? ` · edited ${stamp(n.editedAt)}` : ''}{access.manage && n.sentAt ? ` · sent to ${n.sentTo ?? 0} famil${n.sentTo === 1 ? 'y' : 'ies'}` : ''}
                      </p>
                      {access.manage && <NoticeTools slug={team.slug} id={n.id} pinned={Boolean(n.pinned)} editing={{ title: n.title, body: n.body }} />}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          )}

          {sections.fixtures !== false && (
            <Section id="fixtures" title="Fixtures & results" action={team.driblUrl ? <a href={team.driblUrl} target="_blank" rel="noopener" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand">Full fixtures ↗</a> : undefined}>
              {fixtures.length === 0 && !team.driblUrl ? (
                <p className="text-muted">Fixtures not yet released.</p>
              ) : fixtures.length === 0 ? (
                <p className="text-muted">See the full fixtures link.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {fixtures.map((f) => (
                    <li key={f.id} className={`flex flex-wrap items-center justify-between gap-2 py-3 ${new Date(f.startsAt).getTime() < now && !f.result ? 'text-muted' : ''}`}>
                      <span><strong>{stamp(f.startsAt)}</strong> · vs {f.opponent}{f.venue ? ` · ${f.venue}` : ''}</span>
                      <span className="flex items-center gap-3">
                        {f.result && <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">{f.result}</span>}
                        {access.manage && <FixtureTools slug={team.slug} id={f.id!} result={f.result} />}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {access.manage && <div className="mt-4 rounded-xl bg-surface-2 p-4"><FixtureForm slug={team.slug} /></div>}
            </Section>
          )}

          {!tournament && sections.training !== false && (
            <Section id="training" title="Training">
              {trainingRecent && <p className="mb-3 rounded-lg bg-accent/20 px-4 py-2 text-sm font-semibold">Training updated {formatDate(team.trainingChangedAt!, { weekday: 'short', day: 'numeric', month: 'short' })} — check the times below.</p>}
              {training.length === 0 ? (
                <p className="text-muted">Training times coming soon.</p>
              ) : (
                <ul className={`divide-y divide-line rounded-xl ${trainingRecent ? 'ring-2 ring-accent' : ''}`}>
                  {training.map((t) => (
                    <li key={t.id} className="flex flex-wrap justify-between gap-2 p-3"><strong>{t.day}s</strong><span>{clock(t.start)}{t.end ? `–${clock(t.end)}` : ''}{t.location ? ` · ${t.location}` : ''}</span></li>
                  ))}
                </ul>
              )}
              {access.manage && (
                <details className="mt-4 rounded-xl bg-surface-2 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Edit training</summary>
                  <div className="mt-3"><TrainingForm slug={team.slug} rows={training.map((t) => ({ day: t.day, start: t.start, end: t.end, location: t.location }))} /></div>
                </details>
              )}
            </Section>
          )}

          {showForum && <span id="forum" aria-hidden className="block" /> /* old #forum links still land here */}
          {showForum && (
            <Section id="team-chat" title="Team Chat">
              <p className="mb-4 text-sm text-muted">Ask the team a question — coaches answer here. Be kind: Team Chat is moderated by coaches and the committee.</p>
              <div className="mb-6 rounded-xl bg-surface-2 p-4"><ThreadForm slug={team.slug} /></div>
              {threadsOrdered.length === 0 ? (
                <p className="text-muted">No questions yet.</p>
              ) : (
                <ol className="space-y-4">
                  {threadsOrdered.map((t) => {
                    const rs = replies.filter((r: ForumReply) => (typeof r.thread === 'object' ? r.thread.id : r.thread) === t.id)
                    return (
                      <li key={t.id} className={`rounded-xl border p-5 ${t.pinned ? 'border-accent' : 'border-line'}`}>
                        <p className="font-semibold">{t.pinned && <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-ink">Pinned</span>}{t.locked && <span className="mr-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs">Locked</span>}{t.title}</p>
                        <p className="mt-1 whitespace-pre-line text-sm">{t.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">{who(t.author)} · {stamp(t.createdAt)} {access.manage && <ModTools slug={team.slug} id={t.id} kind="thread" pinned={Boolean(t.pinned)} locked={Boolean(t.locked)} />}</div>
                        {rs.length > 0 && (
                          <ul className="mt-3 space-y-2 border-l-2 border-line pl-4">
                            {rs.map((r) => {
                              const coach = (team.coaches ?? []).some((c) => (typeof c === 'object' ? c.id : c) === (typeof r.author === 'object' ? r.author.id : r.author))
                              return (
                                <li key={r.id} className="text-sm">
                                  <p className="whitespace-pre-line">{r.body}</p>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">{who(r.author)}{coach && <span className="font-semibold text-brand">· Coach</span>} · {stamp(r.createdAt)} {access.manage && <ModTools slug={team.slug} id={r.id} kind="reply" />}</div>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        {(!t.locked || access.manage) && <ReplyForm slug={team.slug} thread={t.id} />}
                      </li>
                    )
                  })}
                </ol>
              )}
            </Section>
          )}

          {access.manage && (
            <Section id="members" title={`Players (${members.length})`}>
              {members.length === 0 ? (
                <p className="text-muted">No paid players yet.</p>
              ) : (
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {members.map((m) => {
                    const kid = m.participant as Participant
                    const parent = m.account as User
                    return (
                      <li key={m.id} className="rounded-lg border border-line p-3">
                        <p className="font-semibold">{kid.firstName} {kid.lastName}</p>
                        <MedicalBadge note={kid.medical?.conditions} quiet={false} />
                        {kid.medical?.emergencyContact && <p className="mt-1 text-xs text-muted">Emergency: {kid.medical.emergencyContact}{kid.medical.emergencyPhone ? ` · ${formatPhone(kid.medical.emergencyPhone)}` : ''}</p>}
                        <div className="mt-2">
                          <ContactButtons name={[parent.firstName, parent.lastName].filter(Boolean).join(' ') || parent.email} phone={parent.phone} accountId={user && hasRole(user, 'coach') ? parent.id : null} />
                        </div>
                        {!parent.phone && <p className="text-xs text-muted">{parent.email}</p>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
