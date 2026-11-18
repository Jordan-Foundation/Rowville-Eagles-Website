/**
 * Trials → selections → teams (pure — unit tested).
 *
 * Programs: Rowville Eagles = the season's "rowville" trial round; RFA = Foundation Academy tournament team rounds.
 * A player's season registration is a selection entry:
 * - trialist: registered / invited / attended (and "needs another trial") — no outcome marked yet;
 * - successful: outcome marked successful (queued or sent) → on the Selected page;
 * - unsuccessful: outcome marked unsuccessful (queued or sent) → kept in the Unsuccessful archive.
 */
import type { SelectionEntry } from '@/payload-types'

export type ProgramKey = 'eagles' | 'rfa'
export const PROGRAMS: { key: ProgramKey; label: string; kind: 'rowville' | 'tournament' }[] = [
  { key: 'eagles', label: 'Rowville Eagles', kind: 'rowville' },
  { key: 'rfa', label: 'RFA tournament teams', kind: 'tournament' },
]
export const kindOf = (p: string | null | undefined) => (p === 'rfa' ? 'tournament' : 'rowville')
export const programOf = (kind: string | null | undefined): ProgramKey => (kind === 'tournament' ? 'rfa' : 'eagles')

type E = Pick<SelectionEntry, 'status' | 'outcomeQueued'> & Partial<Pick<SelectionEntry, 'needsAnotherTrial'>>

const TRIAL_STATUSES = ['interested', 'trial-booked', 'attended']
const SELECTED_STATUSES = ['selected', 'offered', 'registered']

export const isSuccessful = (e: E) => SELECTED_STATUSES.includes(e.status) || e.outcomeQueued === 'successful' || e.outcomeQueued === 'selected'
export const isUnsuccessful = (e: E) => e.status === 'unsuccessful' || e.outcomeQueued === 'unsuccessful'
export const isTrialist = (e: E) => TRIAL_STATUSES.includes(e.status) && !isSuccessful(e) && !isUnsuccessful(e)

export type Invite = { session: number; attended: boolean; start: string }

/** Where a trialist is up to (the status shown on the trialist page). */
export function trialistStage(e: E, invites: Invite[]): 'another_trial' | 'attended' | 'invited' | 'registered' {
  if (e.needsAnotherTrial) return 'another_trial'
  if (e.status === 'attended' || invites.some((i) => i.attended)) return 'attended'
  if (invites.length || e.status === 'trial-booked') return 'invited'
  return 'registered'
}
export const STAGE_LABEL = { registered: 'Registered interest', invited: 'Invited', attended: 'Attended', another_trial: 'Needs another trial' } as const

/** Not paid yet (offer sent or still to send) — shown as "NP" on the depth chart. */
export const notPaid = (e: Pick<SelectionEntry, 'status'>) => e.status !== 'registered'

export const TRAINING_TAG = { mon_wed: 'Mon/Wed', tue_thu: 'Tue/Thu', none: null } as const
export const GAME_TAG = { sat: 'Sat', sun: 'Sun', none: null } as const

/** Survey answers as small tags for the player card. */
export function prefTags(e: Pick<SelectionEntry, 'prefs'>) {
  const t = e.prefs?.trainingNights ? TRAINING_TAG[e.prefs.trainingNights] : null
  const g = e.prefs?.gameDay ? GAME_TAG[e.prefs.gameDay] : null
  return [t, g].filter((x): x is NonNullable<typeof x> => Boolean(x))
}

/** Team column header counts: players and the preference split, to help balance teams. */
export function teamCounts(list: Pick<SelectionEntry, 'prefs'>[]) {
  const c = { players: list.length, monWed: 0, tueThu: 0, sat: 0, sun: 0, unanswered: 0 }
  for (const e of list) {
    if (e.prefs?.trainingNights === 'mon_wed') c.monWed++
    if (e.prefs?.trainingNights === 'tue_thu') c.tueThu++
    if (e.prefs?.gameDay === 'sat') c.sat++
    if (e.prefs?.gameDay === 'sun') c.sun++
    if (!e.prefs?.answeredAt) c.unanswered++
  }
  return c
}

export const POSITION_GROUPS = [
  { key: 'gk', label: 'GK' },
  { key: 'def', label: 'DEF' },
  { key: 'mid', label: 'MID' },
  { key: 'fwd', label: 'FWD' },
] as const
export type PositionGroup = (typeof POSITION_GROUPS)[number]['key']

/** Guess a depth-chart group from a free-text position ("Goalkeeper", "centre back", "striker"). */
export function positionGroupOf(text: string | null | undefined): PositionGroup | null {
  const t = (text ?? '').toLowerCase()
  if (!t) return null
  if (/\bgk\b|goal ?keep|keeper|goalie/.test(t)) return 'gk'
  if (/def|back|\bcb\b|\blb\b|\brb\b|sweeper/.test(t)) return 'def'
  if (/mid|\bcm\b|\bdm\b|\bam\b|playmaker/.test(t)) return 'mid'
  if (/forward|striker|wing|attack|\bst\b|\bcf\b|\bfw/.test(t)) return 'fwd'
  return null
}

/** Warnings before a team is finalised (finalising is still allowed). */
export function finaliseWarnings(o: { players: Pick<SelectionEntry, 'status' | 'player'>[]; coachName: string | null; welcome: string | null | undefined }) {
  const w: string[] = []
  const np = o.players.filter(notPaid)
  if (!o.players.length) w.push('No players in this team yet.')
  if (np.length) w.push(`${np.length} player${np.length === 1 ? ' hasn’t' : 's haven’t'} paid yet (NP): ${np.map((e) => e.player.firstName).join(', ')}.`)
  if (!o.coachName) w.push('No coach assigned — the team email will go without a coach introduction.')
  else if (!o.welcome?.trim()) w.push(`${o.coachName} hasn’t written a welcome message — the email will go without it.`)
  return w
}

/** Is a family still allowed to change their preferences? (Until their team is finalised.) */
export const prefsEditable = (squad: { finalisedAt?: string | null } | null | undefined) => !squad?.finalisedAt

export const SURVEY_WORDING =
  'We’d love to know what suits your family best. These preferences can’t be guaranteed, as training nights and game days depend on teams, coaches, grounds and the league fixture. We’re just asking so we can do our best to accommodate everyone.'
