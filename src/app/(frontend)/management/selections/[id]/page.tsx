import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload } from '@/lib/payload'
import { getAgeRules } from '@/lib/age-rules'
import { groupInfo, groupLabel, miniRoosBirthYears, placementLabel } from '@/lib/age-groups'
import { groupByYear, inTab, TABS, type Tab } from '@/selections/board'
import { entryStatusLabel } from '@/selections/entries'
import { loadRound, renderOutcome } from '@/selections/service'
import type { Squad, TrialSession } from '@/payload-types'
import { formatDate } from '@/lib/format'
import { requireSelector } from '../access'
import { awaitingPayment, isOverdue } from '@/selections/payment'
import { Board, type Row } from './Board'
import { SendForm, SquadForm } from './Forms'

export const dynamic = 'force-dynamic'
// Releasing reports / sending selection emails can take a while
export const maxDuration = 300
export const metadata: Metadata = { title: 'Selection round', robots: { index: false } }

const outcomeName = { selected: 'Selected', successful: 'Successful', unsuccessful: 'Unsuccessful' } as Record<string, string>

export default async function RoundPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; done?: string }> }) {
  const { id } = await params
  const q = await searchParams
  await requireSelector(`/management/selections/${id}`)
  const p = await payload()
  const [data, rules] = await Promise.all([loadRound(p, Number(id)), getAgeRules(p)])
  if (!data) notFound()
  const { round, squads, entries } = data
  const tab = (TABS.some((t) => t.key === q.tab) ? q.tab : 'interest') as Tab
  const list = entries.filter((e) => inTab(e, tab))
  const counts = Object.fromEntries(TABS.map((t) => [t.key, entries.filter((e) => inTab(e, t.key)).length]))

  const groups = groupByYear(list).map((g) => ({
    year: g.year,
    label: g.label,
    hint: g.year ? groupInfo(g.year, rules).hint : '',
    rows: g.entries.map(
      (e): Row => ({
        id: e.id,
        name: `${e.player.firstName} ${e.player.lastName}`,
        placement: e.birthYear ? placementLabel(e.birthYear, e.playingBirthYear, rules) : 'No date of birth',
        moved: Boolean(e.playingBirthYear && e.playingBirthYear !== e.birthYear),
        status: entryStatusLabel(e).label,
        queued: e.outcomeQueued ? outcomeName[e.outcomeQueued] : null,
        squad: e.squad && typeof e.squad === 'object' ? (e.squad as Squad).name : null,
        trial: e.trialSession && typeof e.trialSession === 'object' ? `Trial ${formatDate((e.trialSession as TrialSession).start, { weekday: 'short', day: 'numeric', month: 'short' })}` : null,
        flags: (e.flags ?? []) as string[],
        contact: `${e.contact.firstName} ${e.contact.lastName} · ${e.contact.phone}`,
        notes: e.player.notes ?? null,
        payment: awaitingPayment(e) && e.paymentDueAt ? { due: formatDate(e.paymentDueAt, { weekday: 'short', day: 'numeric', month: 'short' }), overdue: isOverdue(e), reminders: (e.remindersSent ?? []).map((d) => `${d}d`).join(', ') } : null,
        paid: e.paidAt ? formatDate(e.paidAt, { day: 'numeric', month: 'short' }) : null,
        lastMove: e.moves?.length ? `${groupLabel(e.moves.at(-1)!.from)} → ${groupLabel(e.moves.at(-1)!.to)} — “${e.moves.at(-1)!.reason}”` : null,
      }),
    ),
  }))
  const present = [...new Set(entries.map((e) => e.birthYear).filter(Boolean) as number[])]
  const years = [...new Set([...miniRoosBirthYears(rules), ...present])].sort((a, b) => a - b).map((y) => ({ year: y, label: `${groupLabel(y)} · ${groupInfo(y, rules).hint}` }))
  const queued = entries.filter((e) => e.outcomeQueued)
  const previews = queued.map((e) => ({ e, r: renderOutcome(e, round, rules) }))

  return (
    <div className="container-x py-14">
      <Link href="/management/selections" className="text-sm text-muted hover:text-ink">← Selections</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow !text-brand">{round.kind === 'tournament' ? 'Tournament' : 'Rowville trials'} · {round.season}</p>
          <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase sm:text-5xl">{round.title}</h1>
        </div>
        <div className="flex gap-3 text-sm">
          <a href={`/management/selections/${round.id}/export?tab=${tab}`} className="rounded-full border border-line px-4 py-2 font-semibold hover:border-brand">Export CSV</a>
          <a href={`/admin/collections/selection-rounds/${round.id}`} className="rounded-full border border-line px-4 py-2 font-semibold hover:border-brand">Round settings & messages</a>
        </div>
      </div>
      {q.done && <p role="status" className="mt-6 rounded-xl border border-emerald-600/40 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">{q.done}</p>}

      <nav aria-label="Tabs" className="mt-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t.key ? 'bg-brand text-white' : 'border border-line hover:border-brand'} ${t.key === 'queued' && counts.queued ? 'ring-2 ring-accent' : ''}`}>
            {t.label} <span className="opacity-70">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      <section aria-label="Squads" className="mt-6 rounded-2xl border border-line p-5">
        <h2 className="font-semibold">Squads ({squads.length})</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {squads.map((s) => {
            const n = entries.filter((e) => (typeof e.squad === 'object' ? e.squad?.id : e.squad) === s.id).length
            return (
              <li key={s.id} className="rounded-full border border-line px-3 py-1.5">
                <strong>{s.name}</strong> · {n}{s.capacity ? `/${s.capacity}` : ''} players{s.birthYears?.length ? ` · ${s.birthYears.map(groupLabel).join(', ')}` : ''}
                {round.kind === 'rowville' && !s.team && <span className="ml-1 text-amber-700">(link to a club team before offers)</span>}
              </li>
            )
          })}
        </ul>
        <div className="mt-4"><SquadForm roundId={round.id} years={String(miniRoosBirthYears(rules)[3])} /></div>
      </section>

      {tab === 'queued' ? (
        <div className="mt-8 space-y-6">
          <p className="text-muted">Nothing below has been sent. Check each message, change anything in “Round settings & messages”, then send.</p>
          {previews.length === 0 && <p className="rounded-2xl border border-line p-6 text-muted">No outcomes waiting. Tick players on the Interest tab and choose {round.kind === 'tournament' ? 'Select' : 'Successful'} or Unsuccessful.</p>}
          {(['selected', 'successful', 'unsuccessful'] as const).map((k) => {
            const items = previews.filter((x) => x.r.kind === k)
            if (!items.length) return null
            const first = items[0]
            return (
              <section key={k} className="rounded-2xl border border-line p-6">
                <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{outcomeName[k]} · {items.length}</h2>
                <ul className="mt-2 text-sm text-muted">
                  {items.map(({ e, r }) => (
                    <li key={e.id}>
                      {e.player.firstName} {e.player.lastName} · {r.placement}{e.squad && typeof e.squad === 'object' ? ` · ${(e.squad as Squad).name}` : ''}
                      {k === 'unsuccessful' && e.outcomeEmail === false ? ' · no email' : ''}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-xl bg-surface-2 p-5 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Preview — {first.e.player.firstName}’s email</p>
                  <p className="mt-2 font-semibold">{first.r.subject}</p>
                  <div className="mt-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: first.r.bodyHtml }} />
                  {first.r.sms && <p className="mt-3 border-t border-line pt-3"><span className="text-xs font-semibold uppercase tracking-wider text-muted">Text: </span>{first.r.sms}{!process.env.TWILIO_ACCOUNT_SID && <span className="block text-xs text-muted">Texts start sending once Twilio is connected (Stage 20).</span>}</p>}
                  {first.r.missing.length > 0 && <p className="mt-3 text-amber-700">Unknown placeholders: {first.r.missing.join(', ')}</p>}
                </div>
              </section>
            )
          })}
          <SendForm roundId={round.id} count={queued.length} />
        </div>
      ) : (
        <div className="mt-8">
          <Board roundId={round.id} kind={round.kind} groups={groups} squads={squads.map((s) => ({ id: s.id, name: s.name }))} years={years} />
        </div>
      )}
    </div>
  )
}
