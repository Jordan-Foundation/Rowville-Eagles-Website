import { payload } from '@/lib/payload'
import { getAgeRules } from '@/lib/age-rules'
import { groupInfo } from '@/lib/age-groups'
import { inTab, playingYear, type Tab } from '@/selections/board'
import { toCsv } from '@/selections/board'
import { loadRound } from '@/selections/service'
import { entryStatusLabel } from '@/selections/entries'
import { selectorOrNull } from '../../access'
import type { Squad, TrialSession } from '@/payload-types'

/** CSV export of a round's tab (staff and coaches). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await selectorOrNull())) return new Response('Unauthorised', { status: 401 })
  const p = await payload()
  const data = await loadRound(p, Number((await params).id))
  if (!data) return new Response('Not found', { status: 404 })
  const tab = (new URL(req.url).searchParams.get('tab') ?? 'all') as Tab
  const rules = await getAgeRules(p)
  const rows = data.entries
    .filter((e) => inTab(e, tab))
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
      trial: e.trialSession && typeof e.trialSession === 'object' ? (e.trialSession as TrialSession).title : '',
      parent: `${e.contact.firstName} ${e.contact.lastName}`,
      email: e.contact.email,
      phone: e.contact.phone,
      club: e.player.previousClub ?? '',
      flags: (e.flags ?? []).join(' '),
      notes: e.player.notes ?? '',
    }))
  const name = `${data.round.title}-${tab}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return new Response(toCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"` } })
}
