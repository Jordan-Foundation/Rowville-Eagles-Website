'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { getAgeRules } from '@/lib/age-rules'
import { localToUtc } from '@/lib/time'
import { SelectionError, assignAllUnassigned, deleteSquad, finaliseSquad, inviteToTrial, markOutcome, moveAgeGroup, placePlayer, saveSquad, saveWelcome, sendTeamEmail, setAttendance, unlockSquad, type Outcome } from '@/selections/v2'
import type { PositionGroup } from '@/selections/flow'

/** Selections (Management only). Form actions redirect back with ?done= / ?error=; board actions return a result. */

const safeBack = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '')
  return s.startsWith('/management/selections') ? s : '/management/selections/trialists'
}
const go = (back: string, kind: 'done' | 'error', msg: string): never => {
  const u = new URL(back, 'http://x')
  u.searchParams.delete('done')
  u.searchParams.delete('error')
  u.searchParams.set(kind, msg)
  redirect(`${u.pathname}${u.search}`)
}
const msgOf = (e: unknown) => (e instanceof SelectionError ? e.message : 'Something went wrong — please try again.')
const refresh = () => revalidatePath('/management/selections', 'layout')

/** Trialist page: one row's button ("<id>:<outcome>") or the bulk buttons with ticked players. */
export async function trialistAction(fd: FormData) {
  const back = safeBack(fd.get('back'))
  const me = await managementOrNull()
  if (!me) go(back, 'error', 'Management only.')
  const p = await payload()
  const one = String(fd.get('one') ?? '')
  const invite = String(fd.get('invite') ?? '')
  let msg = ''
  try {
    if (invite) {
      // "Invite to next trial": a single player (invite=<id>) or the ticked players (invite=bulk)
      const ids = invite === 'bulk' ? fd.getAll('ids').map(Number).filter(Boolean) : [Number(invite)]
      const session = Number(fd.get(invite === 'bulk' ? 'session' : `session-${invite}`))
      if (!ids.length) go(back, 'error', 'Tick at least one player.')
      if (!session) go(back, 'error', 'Choose a trial to invite them to.')
      const r = await inviteToTrial(p, { ids, session, by: me! })
      msg = `Invite sent to ${r.sent} famil${r.sent === 1 ? 'y' : 'ies'}.`
    } else {
      const [idPart, outPart] = one ? one.split(':') : [null, String(fd.get('outcome') ?? '')]
      const ids = idPart ? [Number(idPart)] : fd.getAll('ids').map(Number).filter(Boolean)
      const outcome = outPart as Outcome
      if (!['successful', 'unsuccessful', 'another', 'clear'].includes(outcome)) go(back, 'error', 'Choose an outcome.')
      if (!ids.length) go(back, 'error', 'Tick at least one player.')
      const r = await markOutcome(p, { ids, outcome, by: me! })
      const word = { successful: 'successful — on the Selected page', unsuccessful: 'unsuccessful', another: 'needing another trial', clear: 'back to trialist' }[outcome]
      msg = `${r.changed} marked ${word}.${outcome === 'successful' || outcome === 'unsuccessful' ? ' Nothing has been sent — use “Send outcome emails” when you’re ready.' : ''}${r.skipped ? ` ${r.skipped} skipped (outcome already sent).` : ''}`
    }
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e
    go(back, 'error', msgOf(e))
  }
  refresh()
  go(back, 'done', msg)
}

/** Attendance tick list (on the day, on a phone). */
export async function attendanceAction(inviteId: number, attended: boolean): Promise<{ ok?: boolean; error?: string }> {
  const me = await managementOrNull()
  if (!me) return { error: 'Management only.' }
  try {
    // The selections pages always load fresh, so no page refresh is needed (keeps each tap quick)
    await setAttendance(await payload(), inviteId, attended, me)
    return { ok: true }
  } catch (e) {
    return { error: msgOf(e) }
  }
}

/** Create a trial session (program, age groups, date, start/end, venue). Opening it for bookings emails waiting families. */
export async function trialSessionAction(fd: FormData) {
  const back = safeBack(fd.get('back'))
  const me = await managementOrNull()
  if (!me) go(back, 'error', 'Management only.')
  const s = (k: string) => String(fd.get(k) ?? '').trim()
  const date = s('date')
  const start = s('start')
  const end = s('end')
  const years = fd.getAll('years').map(Number).filter((y) => y > 1900)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start)) go(back, 'error', 'Enter the date and start time.')
  if (!years.length) go(back, 'error', 'Tick at least one age group.')
  const startAt = localToUtc(date, start)
  const minutes = /^\d{2}:\d{2}$/.test(end) ? Math.round((localToUtc(date, end).getTime() - startAt.getTime()) / 60000) : 60
  if (minutes <= 0) go(back, 'error', 'The end time must be after the start time.')
  await (await payload()).create({
    collection: 'trial-sessions',
    overrideAccess: true,
    data: {
      title: s('title') || `Trial — ${years.sort().map((y) => `${y}s`).join(', ')}`,
      program: s('program') === 'rfa' ? 'rfa' : 'eagles',
      start: startAt.toISOString(),
      durationMinutes: minutes,
      birthYears: years,
      location: s('location') || undefined,
      whatToBring: s('whatToBring') || undefined,
      status: fd.get('publish') === 'on' ? 'published' : 'draft',
    },
  })
  refresh()
  go(back, 'done', fd.get('publish') === 'on' ? 'Trial added and opened for bookings — families waiting in those age groups have been told.' : 'Trial added. Invite players from the Trialists page.')
}

// ── Depth chart (client board) ───────────────────────────────────────────────

export type BoardResult = { ok?: boolean; error?: string; warning?: string | null }

export async function moveAgeAction(id: number, to: number): Promise<BoardResult> {
  const me = await managementOrNull()
  if (!me) return { error: 'Management only.' }
  const p = await payload()
  try {
    const r = await moveAgeGroup(p, { id, to, by: me, rules: await getAgeRules(p) })
    return { ok: true, warning: r.warning }
  } catch (e) {
    return { error: msgOf(e) }
  }
}

export async function placeAction(id: number, squad: number | null, position?: PositionGroup | null, sortOrder?: number): Promise<BoardResult> {
  const me = await managementOrNull()
  if (!me) return { error: 'Management only.' }
  try {
    await placePlayer(await payload(), { id, squad, position, sortOrder, by: me })
    return { ok: true }
  } catch (e) {
    return { error: msgOf(e) }
  }
}

/** Team admin on the Micro view: add / rename / coach / delete / assign all / finalise / unlock / send / welcome. */
export async function teamAction(fd: FormData) {
  const back = safeBack(fd.get('back'))
  const me = await managementOrNull()
  if (!me) go(back, 'error', 'Management only.')
  const p = await payload()
  const op = String(fd.get('op') ?? '')
  const id = Number(fd.get('squad')) || null
  let msg = ''
  try {
    if (op === 'save') {
      const coach = fd.has('coach') ? Number(fd.get('coach')) || null : undefined
      const doc = await saveSquad(p, { round: Number(fd.get('round')), id, name: String(fd.get('name') ?? ''), ageGroup: Number(fd.get('ageGroup')), coach, by: me! })
      msg = `${doc.name} saved.`
    } else if (op === 'delete' && id) {
      await deleteSquad(p, { id, by: me! })
      msg = 'Team deleted — its players are back in Unassigned.'
    } else if (op === 'assign-all' && id) {
      const r = await assignAllUnassigned(p, { squad: id, by: me! })
      msg = `${r.placed} player${r.placed === 1 ? '' : 's'} placed.`
    } else if (op === 'finalise' && id) {
      const s = await finaliseSquad(p, { id, by: me! })
      msg = `${s.name} is finalised. Check the team email below and send it.`
    } else if (op === 'unlock' && id) {
      await unlockSquad(p, { id, by: me! })
      msg = 'Team unlocked — you can move players again.'
    } else if (op === 'send' && id) {
      const r = await sendTeamEmail(p, { id, by: me! })
      msg = `Team email sent to ${r.sent} of ${r.families} famil${r.families === 1 ? 'y' : 'ies'}.`
    } else if (op === 'welcome' && id) {
      await saveWelcome(p, { squad: id, message: String(fd.get('message') ?? ''), by: me!, asManagement: true })
      msg = 'Welcome message saved.'
    } else go(back, 'error', 'Unknown action.')
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e
    go(back, 'error', msgOf(e))
  }
  refresh()
  go(back, 'done', msg)
}

/** "Send outcome emails" — only after the summary has been checked and confirmed. */
export async function sendOutcomesAction(fd: FormData) {
  const back = safeBack(fd.get('back'))
  const me = await managementOrNull()
  if (!me) go(back, 'error', 'Management only.')
  if (fd.get('confirm') !== 'on') go(back, 'error', 'Tick the box to confirm the emails are ready to send.')
  const p = await payload()
  const { sendQueued } = await import('@/selections/service')
  const res = await sendQueued(p, Number(fd.get('round')), me!, await getAgeRules(p))
  if (!res.ok) go(back, 'error', res.error)
  const r = res as Extract<typeof res, { ok: true }>
  const parts = [r.selected && `${r.selected} selected`, r.successful && `${r.successful} successful`, r.unsuccessful && `${r.unsuccessful} unsuccessful`].filter(Boolean).join(', ')
  refresh()
  go(back, r.failed.length ? 'error' : 'done', `Sent: ${parts || 'nothing'} · ${r.emailed} emails.${r.failed.length ? ` Couldn’t send to: ${r.failed.join(', ')} — they’re still waiting here.` : ''}`)
}

/** Save the round's outcome email templates. */
export async function templatesAction(fd: FormData) {
  const back = safeBack(fd.get('back'))
  const me = await managementOrNull()
  if (!me) go(back, 'error', 'Management only.')
  const s = (k: string, max: number) => String(fd.get(k) ?? '').slice(0, max)
  const kinds = ['selected', 'successful', 'unsuccessful'] as const
  const templates = Object.fromEntries(kinds.flatMap((k) => [[`${k}Subject`, s(`${k}Subject`, 200)], [`${k}Body`, s(`${k}Body`, 4000)], [`${k}Sms`, s(`${k}Sms`, 320)]]))
  await (await payload()).update({ collection: 'selection-rounds', id: Number(fd.get('round')), overrideAccess: true, data: { templates } })
  refresh()
  go(back, 'done', 'Email templates saved.')
}
