import type { Payload } from 'payload'
import type { SelectionEntry, SelectionRound, Squad, TrialSession } from '@/payload-types'
import { playingYear } from './board'
import { syncBookedInvites } from './v2'
import type { Invite } from './flow'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))

export type InviteRow = Invite & { id: number; title: string; location: string | null; source: string }

/** Everything the selections pages need for one round: entries, their trial history and the round's teams. */
export async function loadSelection(p: Payload, round: SelectionRound) {
  const [{ docs: entries }, { docs: squads }] = await Promise.all([
    p.find({ collection: 'selection-entries', where: { round: { equals: round.id } }, sort: 'player.lastName', limit: 5000, depth: 1, overrideAccess: true, pagination: false }),
    p.find({ collection: 'squads', where: { round: { equals: round.id } }, sort: 'name', limit: 300, depth: 1, overrideAccess: true, pagination: false }),
  ])
  const ids = entries.map((e) => e.id)
  const load = async () => (ids.length ? (await p.find({ collection: 'trial-invites', where: { entry: { in: ids } }, limit: 20000, depth: 1, overrideAccess: true, pagination: false })).docs : [])
  let invites = await load()
  // Trials booked through the join form show on the trial history too
  const have = new Set(invites.map((i) => `${rel(i.entry)}-${rel(i.session)}`))
  const before = have.size
  await syncBookedInvites(p, entries, have)
  if (have.size !== before) invites = await load()
  const byEntry = new Map<number, InviteRow[]>()
  for (const i of invites) {
    const s = i.session as TrialSession | null
    if (!s || typeof s !== 'object') continue
    const row: InviteRow = { id: i.id, session: s.id, attended: Boolean(i.attended), start: s.start, title: s.title, location: s.location ?? null, source: i.source ?? 'invited' }
    const id = rel(i.entry)!
    byEntry.set(id, [...(byEntry.get(id) ?? []), row].sort((a, b) => a.start.localeCompare(b.start)))
  }
  const ages = [...new Set(entries.map((e) => playingYear(e)).filter(Boolean))].sort((a, b) => b - a)
  return { entries: entries as SelectionEntry[], squads: squads as Squad[], invitesOf: (id: number) => byEntry.get(id) ?? [], ages }
}

export const nameOf = (e: Pick<SelectionEntry, 'player'>) => `${e.player.firstName} ${e.player.lastName}`.trim()
export const matchesSearch = (e: Pick<SelectionEntry, 'player' | 'contact'>, q: string | undefined) => {
  const t = (q ?? '').trim().toLowerCase()
  return !t || nameOf(e).toLowerCase().includes(t) || `${e.contact.firstName} ${e.contact.lastName}`.toLowerCase().includes(t)
}
