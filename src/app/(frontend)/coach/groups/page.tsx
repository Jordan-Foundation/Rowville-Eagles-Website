import Link from 'next/link'
import { markSeen } from '@/lib/seen'
import { ContactButtons, MedicalBadge } from '@/components/coach/ContactButtons'
import { formatPhone } from '@/lib/phone'
import { todayYmd } from '@/academy/training-day'
import type { Metadata } from 'next'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { groupLabel } from '@/lib/age-groups'
import { coachGroups, nextSession } from '@/academy/terms/coach-groups'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My groups', robots: { index: false } }

const day = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })
const time = (iso: string) => formatDate(iso, { hour: 'numeric', minute: '2-digit' })

export default async function CoachGroupsPage() {
  const { coach, user: me } = await requireCoach('/coach/groups')
  void markSeen(await payload(), me.id, 'groups')
  const p = await payload()
  const groups = await coachGroups(p, coach.id)
  const now = Date.now()

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">My groups</h1>
        <p className="mt-3 text-muted">Academy term training you coach. Player details are for coaching and safety only — please don’t share them.</p>
      </div>
      {groups.length === 0 && <p className="panel border border-line p-6 text-muted">You’re not allocated to any Academy term groups yet.</p>}
      {groups.map((g) => {
        const next = nextSession(g)
        const ahead = g.sessions.filter((s) => new Date(s.endsAt).getTime() > now)
        const first = g.sessions.find((s) => !s.cancelled)
        const upcoming = first && new Date(first.startsAt).getTime() > now // next term's group, shown in advance
        return (
          <section key={g.key} className="panel gloss-sheen border border-line">
            <div className="border-b border-line p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{g.program.title}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold uppercase">
                {g.title}
                {upcoming && <span className="ml-3 align-middle bg-white px-2 py-0.5 text-xs font-bold tracking-wider text-black">Starts {day(first!.startsAt)}</span>}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {g.players.length} player{g.players.length === 1 ? '' : 's'} · {next ? `next ${day(next.startsAt)}, ${time(next.startsAt)}${next.moved ? ' (changed time)' : ''}` : 'no sessions left this term'}
              </p>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {next && next.date === todayYmd() && <Link href="/coach/today" className="font-semibold underline">Take attendance</Link>}
                {g.players.length > 0 && <Link href={`/coach/broadcast?to=group:${g.key.includes(':') ? g.key : `${g.key}:`}`} className="font-semibold underline">Message this group</Link>}
              </p>
              {ahead.filter((s) => s.cancelled || s.moved).map((s) => (
                <p key={s.date} className="mt-1 text-sm font-semibold text-amber-300">{day(s.startsAt)}: {s.cancelled ? 'no training' : `moved to ${time(s.startsAt)}`}{s.note ? ` — ${s.note}` : ''}</p>
              ))}
            </div>
            {g.players.length > 0 ? (
              <ul className="divide-y divide-line">
                {g.players.map((r) => {
                  const by = r.playingBirthYear ?? r.birthYear
                  return (
                    <li key={r.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_1fr]">
                      <div>
                        <p className="font-semibold">
                          {r.player.firstName} {r.player.lastName}
                          <span className="ml-2 text-sm font-normal text-muted">{by ? groupLabel(by) : ''}{r.playingBirthYear && r.playingBirthYear !== r.birthYear ? ` (born ${r.birthYear})` : ''}</span>
                        </p>
                        <MedicalBadge note={r.player.medical} />
                        {r.player.emergencyName && <p className="mt-1 text-sm text-muted">Emergency: {r.player.emergencyName}{r.player.emergencyPhone ? ` · ${formatPhone(r.player.emergencyPhone)}` : ''}</p>}
                        {r.player.photoConsent === false && <p className="text-xs font-semibold text-amber-300">No photos</p>}
                      </div>
                      <div className="text-sm">
                        <ContactButtons name={`${r.contact.firstName} ${r.contact.lastName}`} phone={r.contact.phone} accountId={typeof r.account === 'object' ? r.account?.id : r.account} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted">No paid players yet.</p>
            )}
            {ahead.length > 0 && (
              <details className="border-t border-line p-5 text-sm">
                <summary className="cursor-pointer text-muted">All dates this term ({g.sessions.filter((s) => !s.cancelled).length})</summary>
                <ul className="mt-2 grid gap-1 sm:grid-cols-3">
                  {g.sessions.map((s) => (
                    <li key={s.date} className={s.cancelled ? 'text-muted line-through' : new Date(s.endsAt).getTime() < now ? 'text-muted' : ''}>{day(s.startsAt)}, {time(s.startsAt)}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )
      })}
    </div>
  )
}
