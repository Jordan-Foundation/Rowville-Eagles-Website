import { GROUP_MAX, GROUP_MIN } from './group-pricing'

/** Small group rules (pure — unit tested). */

export const MOBILE = /^(\+?61|0)4\d{8}$/
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Families need at least this long to pay, or the group can't be sent. */
export const MIN_PAY_HOURS = 2

/**
 * When families must have paid by: the settings' hours from now, but never later than the booking
 * cut-off before the first session. Null if that leaves too little time to pay.
 */
export function groupDeadline(o: { now: Date; firstSessionAt: string; hours: number; cutoffHours: number }): Date | null {
  const latest = new Date(o.firstSessionAt).getTime() - o.cutoffHours * 3_600_000
  const until = Math.min(o.now.getTime() + Math.max(1, o.hours) * 3_600_000, latest)
  return until >= o.now.getTime() + MIN_PAY_HOURS * 3_600_000 ? new Date(until) : null
}

/** When the reminder goes out (null = no reminder: it would fall before the group was sent). */
export function reminderAt(o: { sentAt: Date; deadline: Date; hoursBefore: number }): Date | null {
  if (o.hoursBefore <= 0) return null
  const at = o.deadline.getTime() - o.hoursBefore * 3_600_000
  return at > o.sentAt.getTime() ? new Date(at) : null
}

export type RosterPlayer =
  | { kind: 'existing'; participantId: number }
  | { kind: 'new'; playerFirstName: string; playerLastName: string; parentFirstName: string; parentLastName: string; email: string; mobile?: string }

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Tidy a roster entry from the form (trims, lower-cases the email, strips spaces from the mobile). */
export function cleanPlayer(raw: unknown): RosterPlayer | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const s = (k: string) => String(r[k] ?? '').trim().slice(0, 120)
  if (r.kind === 'existing') {
    const id = Number(r.participantId)
    return Number.isInteger(id) && id > 0 ? { kind: 'existing', participantId: id } : null
  }
  if (r.kind === 'new') {
    return {
      kind: 'new',
      playerFirstName: s('playerFirstName'),
      playerLastName: s('playerLastName'),
      parentFirstName: s('parentFirstName'),
      parentLastName: s('parentLastName'),
      email: s('email').toLowerCase(),
      mobile: s('mobile').replace(/[\s()-]/g, '') || undefined,
    }
  }
  return null
}

/** What's wrong with one player's details (null if fine). */
export function playerProblem(p: RosterPlayer | null): string | null {
  if (!p) return 'Choose a player or enter their details.'
  if (p.kind === 'existing') return null
  if (!p.playerFirstName || !p.playerLastName) return 'Enter the player’s first and last name.'
  if (!p.parentFirstName || !p.parentLastName) return 'Enter the parent’s first and last name.'
  if (!EMAIL.test(p.email)) return 'Enter the parent’s email address.'
  if (p.mobile && !MOBILE.test(p.mobile)) return 'Enter an Australian mobile, e.g. 0412 345 678 (or leave it empty).'
  return null
}

/** What's wrong with a roster, in words a coach understands — or null if it's fine. */
export function rosterProblem(players: (RosterPlayer | null)[]): string | null {
  if (players.length < GROUP_MIN || players.length > GROUP_MAX) return `A small group is ${GROUP_MIN}–${GROUP_MAX} players.`
  const seen = new Set<string>()
  for (const [i, p] of players.entries()) {
    const n = `Player ${i + 1}`
    if (!p) return `${n}: choose a player or enter their details.`
    let key: string
    if (p.kind === 'existing') key = `id:${p.participantId}`
    else {
      if (!p.playerFirstName || !p.playerLastName) return `${n}: enter the player’s first and last name.`
      if (!p.parentFirstName || !p.parentLastName) return `${n}: enter the parent’s first and last name.`
      if (!EMAIL.test(p.email)) return `${n}: enter the parent’s email address.`
      if (p.mobile && !MOBILE.test(p.mobile)) return `${n}: enter an Australian mobile, e.g. 0412 345 678 (or leave it empty).`
      key = `new:${norm(p.playerFirstName)}|${norm(p.playerLastName)}|${p.email}`
    }
    if (seen.has(key)) return `${n} is already in the group.`
    seen.add(key)
  }
  return null
}

/** "Mia, Leo and Ava" — other players' first names only, never surnames or contact details. */
export function firstNamesList(names: string[]) {
  const n = names.map((x) => x.trim().split(/\s+/)[0]).filter(Boolean)
  if (n.length <= 1) return n[0] ?? ''
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

/** What families and coaches see for each player's place. */
export const INVITE_STATUS: Record<string, { label: string; tone: 'good' | 'wait' | 'bad' | 'off' }> = {
  invited: { label: 'Invited', tone: 'wait' },
  paid: { label: 'Paid', tone: 'good' },
  weekly: { label: 'Paying weekly', tone: 'good' },
  overdue: { label: 'Overdue', tone: 'bad' },
  declined: { label: 'Declined', tone: 'off' },
  removed: { label: 'Removed', tone: 'off' },
}

export const GROUP_STATUS: Record<string, string> = {
  forming: 'Waiting for families to pay',
  confirmed: 'Confirmed',
  shortfall: 'Short of players — your decision needed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
