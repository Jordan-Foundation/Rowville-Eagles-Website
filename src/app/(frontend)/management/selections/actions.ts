'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { getAgeRules } from '@/lib/age-rules'
import { assignSquad, moveEntries, queueOutcome, sendQueued } from '@/selections/service'
import { awaitingPayment, releaseEntries, sendPaymentReminder } from '@/selections/payment'
import { selectorOrNull } from './access'

export type BoardState = { error?: string; done?: string; needsConfirm?: boolean }

const ids = (fd: FormData) => String(fd.get('ids') ?? '').split(',').map(Number).filter(Boolean)
const path = (fd: FormData) => `/management/selections/${Number(fd.get('roundId'))}`

export async function boardAction(_prev: BoardState, fd: FormData): Promise<BoardState> {
  const user = await selectorOrNull()
  if (!user) return { error: 'Please log in again.' }
  const p = await payload()
  const roundId = Number(fd.get('roundId'))
  const round = await p.findByID({ collection: 'selection-rounds', id: roundId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!round) return { error: 'Round not found.' }
  const chosen = ids(fd)
  const op = String(fd.get('op'))
  if (!chosen.length) return { error: 'Tick at least one player.' }

  if (op === 'squad') {
    const squad = String(fd.get('squad') ?? '')
    await assignSquad(p, chosen, squad ? Number(squad) : null)
    revalidatePath(path(fd))
    return { done: squad ? `Put ${chosen.length} in the squad.` : `Removed ${chosen.length} from their squad.` }
  }
  if (op === 'move') {
    const to = Number(fd.get('to'))
    if (!to) return { error: 'Choose the age group to move to.' }
    const res = await moveEntries(p, { ids: chosen, to, reason: String(fd.get('reason') ?? ''), confirmWarning: fd.get('confirm') === 'on', actor: user, rules: await getAgeRules(p) })
    if (!res.ok) return { error: res.error, needsConfirm: 'needsConfirm' in res ? res.needsConfirm : false }
    revalidatePath(path(fd))
    return { done: `Moved ${res.moved} to the ${to}s.` }
  }
  if (op === 'pick' || op === 'unsuccessful' || op === 'clear') {
    const res = await queueOutcome(p, round, chosen, op, fd.get('email') === 'on')
    if (!res.ok) return { error: res.error }
    revalidatePath(path(fd))
    const word = op === 'clear' ? 'Cleared' : op === 'pick' ? (round.kind === 'tournament' ? 'Selected' : 'Marked successful') : 'Marked unsuccessful'
    return { done: `${word}: ${chosen.length - res.skipped}${op === 'clear' ? '' : ' — waiting in Review & send (nothing sent yet).'}${res.skipped ? ` ${res.skipped} already registered/withdrawn — skipped.` : ''}` }
  }
  if (op === 'release') {
    const n = await releaseEntries(p, chosen, { email: fd.get('email') === 'on', actorId: user.id })
    revalidatePath(path(fd))
    return { done: `Released ${n} spot${n === 1 ? '' : 's'}.${n < chosen.length ? ' (Only unpaid selected players can be released.)' : ''}` }
  }
  if (op === 'remind') {
    const { docs } = await p.find({ pagination: false, collection: 'selection-entries', where: { id: { in: chosen } }, limit: chosen.length, depth: 1, overrideAccess: true, showHiddenFields: true })
    const due = docs.filter(awaitingPayment)
    for (const e of due) await sendPaymentReminder(p, e, 'now')
    return { done: `Reminder sent to ${due.length} famil${due.length === 1 ? 'y' : 'ies'}.${due.length < chosen.length ? ' (Only unpaid selected players get reminders.)' : ''}` }
  }
  return { error: 'Unknown action.' }
}

export async function createSquad(_prev: BoardState, fd: FormData): Promise<BoardState> {
  if (!(await selectorOrNull())) return { error: 'Please log in again.' }
  const p = await payload()
  const name = String(fd.get('name') ?? '').trim()
  const years = String(fd.get('years') ?? '').split(/[\s,]+/).map(Number).filter((y) => y > 1990 && y < 2100)
  if (!name) return { error: 'Give the squad a name, e.g. “2016s Red”.' }
  const fee = String(fd.get('fee') ?? '').trim()
  await p.create({ collection: 'squads', overrideAccess: true, data: { round: Number(fd.get('roundId')), name, birthYears: years, capacity: Number(fd.get('capacity')) || undefined, fee: fee ? Number(fee) : undefined } })
  revalidatePath(path(fd))
  return { done: `Squad “${name}” created.` }
}

export async function sendOutcomes(_prev: BoardState, fd: FormData): Promise<BoardState> {
  const user = await selectorOrNull()
  if (!user) return { error: 'Please log in again.' }
  if (fd.get('confirm') !== 'on') return { error: 'Tick the box to confirm the messages are ready to send.' }
  const p = await payload()
  const res = await sendQueued(p, Number(fd.get('roundId')), user, await getAgeRules(p))
  if (!res.ok) return { error: res.error }
  const parts = [res.selected && `${res.selected} selected`, res.successful && `${res.successful} successful`, res.unsuccessful && `${res.unsuccessful} unsuccessful`].filter(Boolean).join(', ')
  const qs = new URLSearchParams({ tab: 'unpaid', done: `Sent: ${parts || 'nothing'} · ${res.emailed} emails.${res.failed.length ? ` Failed: ${res.failed.join(', ')}` : ''}` })
  redirect(`${path(fd)}?${qs}`)
}
