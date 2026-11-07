import Link from 'next/link'
import type { Team } from '@/payload-types'
import { teamTitle } from './service'

/** "My teams" cards on the account and player pages. Server component. */
export function TeamCards({ teams }: { teams: { team: Team; players: string[]; coach: boolean }[] }) {
  if (!teams.length) return null
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {teams.map(({ team, players, coach }) => (
        <li key={team.id}>
          <Link href={`/teams/${team.slug}`} className="block h-full rounded-2xl border-2 border-brand/30 p-5 transition hover:border-brand">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">{team.type === 'tournament' ? 'Tournament team' : 'Team'}{coach ? ' · you coach' : ''}</p>
            <p className="mt-1 font-[family-name:var(--font-barlow)] text-xl font-bold uppercase">{teamTitle(team)}</p>
            {players.filter(Boolean).length > 0 && <p className="text-sm text-muted">{players.filter(Boolean).join(', ')}</p>}
            <p className="mt-3 text-sm font-semibold">Team page →</p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
