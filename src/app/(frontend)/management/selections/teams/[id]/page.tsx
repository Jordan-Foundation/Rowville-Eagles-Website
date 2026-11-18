import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { emailLayout } from '@/lib/email-templates'
import { groupLabel } from '@/lib/age-groups'
import type { SelectionRound, Squad } from '@/payload-types'
import { finaliseWarnings, notPaid, prefTags } from '@/selections/flow'
import { coachIntro, teamEmail } from '@/selections/v2'
import { Flash } from '../../_shared/Nav'
import { href } from '../../_shared/ctx'
import { teamAction } from '../../v2-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 120
export const metadata: Metadata = { title: 'Finalise team', robots: { index: false } }

const btn = 'min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.15em] text-black'

/** Finalise a team: check the warnings, write or edit the coach's message, lock it, then review and send the team email. */
export default async function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ program?: string; round?: string; done?: string; error?: string }> }) {
  await requireManagement('/management/selections/selected')
  const { id } = await params
  const sp = await searchParams
  const p = await payload()
  const squad = (await p.findByID({ collection: 'squads', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })) as Squad | null
  if (!squad) notFound()
  const round = squad.round as SelectionRound
  const { docs: players } = await p.find({ collection: 'selection-entries', where: { squad: { equals: squad.id } }, sort: 'player.lastName', limit: 500, depth: 0, overrideAccess: true, pagination: false })
  const coach = await coachIntro(p, squad)
  const warnings = finaliseWarnings({ players, coachName: coach?.name ?? null, welcome: squad.welcomeMessage })
  const age = squad.birthYears?.[0]
  const keep = { program: sp.program ?? (round.kind === 'tournament' ? 'rfa' : 'eagles'), round: round.id }
  const back = href(`/management/selections/teams/${squad.id}`, keep)
  const mail = squad.finalisedAt ? await teamEmail(p, squad.id) : null
  const preview = mail ? emailLayout(mail.brand, mail.blocks(players[0]?.contact.firstName ?? 'Sam', players[0]?.player.firstName ?? 'Alex')) : null
  const hidden = (op: string) => (<><input type="hidden" name="back" value={back} /><input type="hidden" name="squad" value={squad.id} /><input type="hidden" name="op" value={op} /></>)

  return (
    <div className="max-w-4xl space-y-6">
      <Link href={href('/management/selections/selected', { ...keep, view: 'micro', age })} className="text-sm text-muted hover:text-ink">← {age ? groupLabel(age) : ''} teams</Link>
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">{squad.finalisedAt ? '🔒 ' : ''}{squad.name}</h1>
        <p className="mt-1 text-muted">{round.title}{age ? ` · ${groupLabel(age)}` : ''} · {players.length} players · {coach ? `Coach ${coach.name}` : 'no coach yet'}</p>
      </div>
      <Flash done={sp.done} error={sp.error} />

      <section className="border border-line p-5" aria-label="Players">
        <h2 className="mb-2 font-display text-xl font-semibold uppercase">Players</h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {players.map((e) => <li key={e.id}>{e.player.firstName} {e.player.lastName} <span className="text-xs text-muted">{e.birthYear}{e.positionGroup ? ` · ${e.positionGroup.toUpperCase()}` : ''}{prefTags(e).length ? ` · ${prefTags(e).join(' ')}` : ''}</span>{notPaid(e) && <span className="ml-1 text-xs font-semibold text-amber-300">NP</span>}</li>)}
        </ul>
      </section>

      <section className="space-y-3 border border-line p-5" aria-label="Coach welcome message">
        <h2 className="font-display text-xl font-semibold uppercase">Coach welcome message</h2>
        <p className="text-sm text-muted">{coach ? `${coach.name} can write this in the coach portal; you can write or edit it here.` : 'Assign a coach on the teams page to include a coach introduction.'} {squad.welcomeUpdatedAt ? `Last updated ${formatDate(squad.welcomeUpdatedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.` : ''}</p>
        <form action={teamAction} className="space-y-2">
          {hidden('welcome')}
          <textarea name="message" defaultValue={squad.welcomeMessage ?? ''} maxLength={600} rows={4} aria-label="Welcome message" className="w-full border border-line bg-surface p-2 text-sm" placeholder="Hi everyone — I’m really looking forward to coaching this group…" />
          <button className="min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Save message</button>
        </form>
      </section>

      {!squad.finalisedAt ? (
        <section className="space-y-3 border-2 border-amber-400/60 p-5" aria-label="Finalise">
          <h2 className="font-display text-xl font-semibold uppercase">Finalise {squad.name}</h2>
          {warnings.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-amber-200" data-warnings>{warnings.map((w) => <li key={w}>{w}</li>)}</ul> : <p className="text-sm text-emerald-300">All set — every player has paid and the coach message is written.</p>}
          <p className="text-sm text-muted">Finalising locks the team (you can unlock it later), gives paid families their team page, and lets you review and send the team email. Unpaid players join when they pay.</p>
          <form action={teamAction}>{hidden('finalise')}<button className={btn}>Finalise team</button></form>
        </section>
      ) : (
        <>
          <section className="space-y-3 border border-line p-5" aria-label="Team email">
            <h2 className="font-display text-xl font-semibold uppercase">Team email</h2>
            <p className="text-sm text-muted">Subject: <strong className="text-ink">{mail!.subject}</strong>{squad.teamEmailSentAt ? ` · last sent ${formatDate(squad.teamEmailSentAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</p>
            {!coach?.message && <p className="text-sm text-amber-200">No coach message — the email goes without it.</p>}
            <iframe title="Team email preview" srcDoc={preview!} className="h-[640px] w-full border border-line bg-white" sandbox="" />
            <form action={teamAction} className="space-y-3">
              {hidden('send')}
              <p className="text-sm" data-send-summary>Send to <strong>{players.length} famil{players.length === 1 ? 'y' : 'ies'}</strong> in {squad.name} (with a phone notification for anyone with the app).</p>
              <button className={btn}>{squad.teamEmailSentAt ? 'Send again' : 'Send team email'}</button>
            </form>
          </section>
          <form action={teamAction} className="flex flex-wrap items-center gap-3 text-sm" aria-label="Unlock team">{hidden('unlock')}<label className="flex items-center gap-2 text-muted"><input type="checkbox" name="confirm" required /> Unlock {squad.name} so players can be moved again</label><button className="text-muted underline">Unlock team</button></form>
        </>
      )}
    </div>
  )
}
