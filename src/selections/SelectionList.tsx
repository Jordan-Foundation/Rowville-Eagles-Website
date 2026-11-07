import Link from 'next/link'
import type { SelectionEntry } from '@/payload-types'
import { fullLabel, groupInfo, type AgeRules } from '@/lib/age-groups'
import { formatDate } from '@/lib/format'
import { entryStatusLabel } from './entries'

const tone = {
  info: 'bg-brand/10 text-brand',
  action: 'bg-accent text-accent-ink',
  ok: 'bg-emerald-600 text-white',
  muted: 'bg-surface-2 text-muted',
}

/** Families' view of their selections / trials (account and player pages). Server component. */
export function SelectionList({ entries, rules, showPlayer = true }: { entries: SelectionEntry[]; rules: AgeRules; showPlayer?: boolean }) {
  if (!entries.length) return null
  return (
    <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
      {entries.map((e) => {
        const round = typeof e.round === 'object' ? e.round : null
        const program = round?.program && typeof round.program === 'object' ? round.program : null
        const by = e.playingBirthYear ?? e.birthYear
        const status = entryStatusLabel(e)
        const trial = e.status === 'trial-booked' && e.trialSession && typeof e.trialSession === 'object' ? e.trialSession : null
        return (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-semibold">
                {program && e.kind === 'tournament' ? <Link href={`/programs/${program.slug}`} className="hover:underline">{program.title}</Link> : round?.title ?? 'Trials'}
              </p>
              <p className="text-sm text-muted">
                {[showPlayer && `${e.player.firstName} ${e.player.lastName}`, by && fullLabel(groupInfo(by, rules)), trial && formatDate(trial.start, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }), e.reference].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${tone[status.tone]}`}>{status.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
