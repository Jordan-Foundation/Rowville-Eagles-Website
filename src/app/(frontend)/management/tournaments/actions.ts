'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { localToUtc } from '@/lib/time'
import { invitePlayers, TournamentError } from '@/tournaments/service'

const go = (path: string, kind: 'done' | 'error', msg: string): never => redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`)
const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const num = (fd: FormData, k: string) => (s(fd, k) === '' ? null : Number(s(fd, k)))

function tournamentData(fd: FormData, back: string) {
  const name = s(fd, 'name')
  if (!name) go(back, 'error', 'Give the tournament a name.')
  const start = s(fd, 'startDate')
  const rsvpDate = s(fd, 'rsvpDate')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) go(back, 'error', 'Choose the start date.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rsvpDate)) go(back, 'error', 'Choose the RSVP deadline.')
  const end = s(fd, 'endDate')
  if (end && end < start) go(back, 'error', 'The end date is before the start date.')
  const rsvp = localToUtc(rsvpDate, s(fd, 'rsvpTime') || '20:00')
  if (rsvp.toISOString().slice(0, 10) > start) go(back, 'error', 'The RSVP deadline must be before the tournament.')
  const size = num(fd, 'squadSize') ?? 10
  if (!(size >= 1 && size <= 40)) go(back, 'error', 'Squad size must be 1–40.')
  const fee = num(fd, 'fee')
  if (fee !== null && !(fee >= 0)) go(back, 'error', 'The fee must be a number.')
  return {
    name, startDate: localToUtc(start, '09:00').toISOString(), endDate: end ? localToUtc(end, '17:00').toISOString() : null,
    venue: s(fd, 'venue') || null, ageGroups: s(fd, 'ageGroups') || null, squadSize: size, fee: fee || null,
    rsvpDeadline: rsvp.toISOString(), arrivalTime: s(fd, 'arrivalTime') || null, whatToBring: s(fd, 'whatToBring') || null, details: s(fd, 'details') || null,
  }
}

export async function createTournament(fd: FormData) {
  if (!(await managementOrNull())) go('/management/tournaments', 'error', 'Management only.')
  const t = await (await payload()).create({ collection: 'rfa-tournaments', overrideAccess: true, data: tournamentData(fd, '/management/tournaments') })
  redirect(`/management/tournaments/${t.id}?done=${encodeURIComponent('Tournament created — now add a squad.')}`)
}

export async function updateTournament(fd: FormData) {
  const id = Number(fd.get('id'))
  const back = `/management/tournaments/${id}`
  if (!(await managementOrNull())) go(back, 'error', 'Management only.')
  await (await payload()).update({ collection: 'rfa-tournaments', id, overrideAccess: true, data: tournamentData(fd, back) })
  revalidatePath(back)
  go(back, 'done', 'Saved.')
}

export async function addSquad(fd: FormData) {
  const id = Number(fd.get('tournament'))
  const back = `/management/tournaments/${id}`
  if (!(await managementOrNull())) go(back, 'error', 'Management only.')
  const name = s(fd, 'name')
  if (!name) go(back, 'error', 'Name the squad, e.g. U11 Squad A.')
  const years = s(fd, 'birthYears').split(/[\s,]+/).map(Number).filter((y) => y > 1990 && y < 2100)
  const limit = num(fd, 'limit')
  const sq = await (await payload()).create({ collection: 'tournament-squads', overrideAccess: true, data: { tournament: id, name, birthYears: years, limit: limit || null } })
  redirect(`${back}?squad=${sq.id}&done=${encodeURIComponent(`${name} added — choose players to invite.`)}#squad-${sq.id}`)
}

export async function invite(fd: FormData) {
  const tid = Number(fd.get('tournament'))
  const squad = Number(fd.get('squad'))
  const back = `/management/tournaments/${tid}?squad=${squad}`
  const me = await managementOrNull()
  if (!me) go(back, 'error', 'Management only.')
  const ids = fd.getAll('player').map(Number).filter(Boolean)
  if (!ids.length) go(back, 'error', 'Tick the players to invite.')
  let msg = ''
  try {
    const r = await invitePlayers(await payload(), squad, ids, me!)
    msg = `Invite sent to ${r.invited} famil${r.invited === 1 ? 'y' : 'ies'} (email + phone notification)${r.skipped ? ` · ${r.skipped} already invited` : ''}.`
  } catch (e) {
    if (!(e instanceof TournamentError)) throw e
    go(back, 'error', e.message)
  }
  revalidatePath(`/management/tournaments/${tid}`)
  go(back, 'done', msg)
}

export async function withdrawInvite(fd: FormData) {
  const tid = Number(fd.get('tournament'))
  const back = `/management/tournaments/${tid}?squad=${Number(fd.get('squad'))}`
  if (!(await managementOrNull())) go(back, 'error', 'Management only.')
  await (await payload()).update({ collection: 'tournament-invites', id: Number(fd.get('invite')), overrideAccess: true, data: { status: 'withdrawn' } })
  go(back, 'done', 'Invite withdrawn — that place is free to invite someone else.')
}
