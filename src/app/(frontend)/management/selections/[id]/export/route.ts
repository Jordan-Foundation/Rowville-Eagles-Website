import { payload } from '@/lib/payload'
import { trialNightsOf } from '@/lib/trials'
import { getAgeRules } from '@/lib/age-rules'
import { groupInfo } from '@/lib/age-groups'
import { inTab, playingYear, type Tab } from '@/selections/board'
import { toCsv } from '@/selections/board'
import { loadRound } from '@/selections/service'
import { entryStatusLabel } from '@/selections/entries'
import { managementOrNull } from '@/lib/management'
import { isSuccessful, notPaid, TRAINING_TAG, GAME_TAG } from '@/selections/flow'
import type { Squad, TrialSession } from '@/payload-types'

/** CSV export of a round (Management). ?tab=selected → the selected players with team, position and preferences. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await managementOrNull())) return new Response('Unauthorised', { status: 401 })
  const p = await payload()
  const data = await loadRound(p, Number((await params).id))
  if (!data) return new Response('Not found', { status: 404 })
  const tabParam = new URL(req.url).searchParams.get('tab') ?? 'all'
  const tab = tabParam as Tab
  const rules = await getAgeRules(p)
  const rows = data.entries
    .filter((e) => (tabParam === 'selected' ? isSuccessful(e) : inTab(e, tab)))
    .map((e) => ({
      reference: e.reference,
      player: `${e.player.firstName} ${e.player.lastName}`,
      date_of_birth: e.player.dateOfBirth?.slice(0, 10),
      rightful_group: e.birthYear ? groupInfo(e.birthYear, rules).label : '',
      playing_in: playingYear(e) ? groupInfo(playingYear(e), rules).label : '',
      moved: e.playingBirthYear && e.playingBirthYear !== e.birthYear ? (e.moves ?? []).map((m) => `${m.from}→${m.to}: ${m.reason}`).join('; ') : '',
      status: entryStatusLabel(e).label,
      queued: e.outcomeQueued ?? '',
      squad: e.squad && typeof e.squad === 'object' ? (e.squad as Squad).name : '',
      trial: trialNightsOf(e).map((t) => t.title).join(' + '),
      parent: `${e.contact.firstName} ${e.contact.lastName}`,
      email: e.contact.email,
      phone: e.contact.phone,
      club: e.player.previousClub ?? '',
      flags: (e.flags ?? []).join(' '),
      notes: e.player.notes ?? '',
      position: e.positionGroup?.toUpperCase() ?? e.position ?? '',
      paid: notPaid(e) ? 'NP' : 'paid',
      training_nights: e.prefs?.trainingNights ? (TRAINING_TAG[e.prefs.trainingNights] ?? 'No preference') : '',
      game_day: e.prefs?.gameDay ? (GAME_TAG[e.prefs.gameDay] ?? 'No preference') : '',
    }))
  const name = `${data.round.title}-${tab}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return new Response(toCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"` } })
}
