'use server'

import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { payload } from '@/lib/payload'
import { offerSlot } from '@/academy/terms/service'

export type TermStaffState = { error?: string; done?: string }

async function staff() {
  const user = await currentUser()
  return user && hasRole(user, 'admin', 'committee') ? user : null
}

export async function offerPlace(_prev: TermStaffState, fd: FormData): Promise<TermStaffState> {
  const user = await staff()
  if (!user) return { error: 'Only admins can offer places.' }
  const reg = Number(fd.get('reg'))
  const slot = Number(fd.get('slot'))
  const days = Math.min(30, Math.max(1, Number(fd.get('days') || 7)))
  if (!reg || !slot) return { error: 'Choose a training time.' }
  try {
    const r = await offerSlot(await payload(), reg, slot, { actorId: user.id, holdDays: days })
    revalidatePath('/staff/academy/terms')
    return { done: `Offer sent to ${r.contact.email}.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not send the offer.' }
  }
}

export async function cancelRegistration(_prev: TermStaffState, fd: FormData): Promise<TermStaffState> {
  const user = await staff()
  if (!user) return { error: 'Only admins can cancel.' }
  const p = await payload()
  const reg = await p.findByID({ collection: 'academy-registrations', id: Number(fd.get('reg')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!reg) return { error: 'Not found.' }
  if (reg.status === 'paid') return { error: 'This place is paid — cancel and refund it from the booking in the admin.' }
  await p.update({ collection: 'academy-registrations', id: reg.id, overrideAccess: true, data: { status: 'cancelled', notes: [reg.notes, `Cancelled by ${user.email} on ${new Date().toISOString().slice(0, 10)}`].filter(Boolean).join('\n') } })
  revalidatePath('/staff/academy/terms')
  return { done: 'Cancelled.' }
}

// ── Stage 22: moves, groups, coaches ────────────────────────────────────────

export type BoardState = TermStaffState & { needReason?: string[]; blocked?: string[]; warnings?: string[] }

const ids = (fd: FormData) => fd.getAll('ids').map(Number).filter(Boolean)
const done = () => revalidatePath('/staff/academy/terms')

export async function moveAction(_prev: BoardState, fd: FormData): Promise<BoardState> {
  const user = await staff()
  if (!user) return { error: 'Only admins can move players.' }
  const list = ids(fd)
  const slot = Number(fd.get('slot'))
  if (!list.length) return { error: 'Tick at least one player.' }
  if (!slot) return { error: 'Choose a training time.' }
  const { moveToSlot } = await import('@/academy/terms/manage')
  const { getAgeRules } = await import('@/lib/age-rules')
  const p = await payload()
  const r = await moveToSlot(p, list, slot, { reason: String(fd.get('reason') ?? ''), actorId: user.id, notify: fd.get('notify') === 'on', rules: await getAgeRules(p) })
  if (r.needReason?.length && !r.moved) return { error: 'These players would play outside their own age group — add a reason to continue.', needReason: r.needReason, blocked: r.blocked, warnings: r.warnings }
  done()
  const bits = [`Moved ${r.moved}`, r.notified ? `${r.notified} famil${r.notified === 1 ? 'y' : 'ies'} told` : '', r.skipped.length ? `skipped: ${r.skipped.join(', ')}` : ''].filter(Boolean)
  return { done: bits.join(' · ') + '.', blocked: r.blocked, warnings: r.warnings }
}

export async function groupAction(_prev: BoardState, fd: FormData): Promise<BoardState> {
  const user = await staff()
  if (!user) return { error: 'Only admins can change groups.' }
  const list = ids(fd)
  const [slot, group] = String(fd.get('group') ?? '').split(':')
  if (!list.length) return { error: 'Tick at least one player.' }
  if (!slot) return { error: 'Choose a group.' }
  const { setGroup } = await import('@/academy/terms/manage')
  try {
    const r = await setGroup(await payload(), list, Number(slot), group || null, { notify: fd.get('notify') === 'on' })
    done()
    return { done: `Updated ${r.changed}${r.skipped ? ` · ${r.skipped} skipped (different training time — move them first)` : ''}${r.notified ? ` · ${r.notified} told` : ''}.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not change the group.' }
  }
}

export async function coachesAction(_prev: TermStaffState, fd: FormData): Promise<TermStaffState> {
  const user = await staff()
  if (!user) return { error: 'Only admins can allocate coaches.' }
  const slot = Number(fd.get('slot'))
  const group = String(fd.get('groupId') ?? '')
  const coaches = fd.getAll('coaches').map(Number).filter(Boolean)
  const notify = fd.get('notify') === 'on'
  const m = await import('@/academy/terms/manage')
  try {
    const n = group ? await m.setGroupCoaches(await payload(), slot, group, coaches, notify) : await m.setSlotCoaches(await payload(), slot, coaches, notify)
    done()
    return { done: `Coaches saved${n ? ` · ${n} famil${n === 1 ? 'y' : 'ies'} told` : ''}.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save coaches.' }
  }
}

export async function groupsAction(_prev: TermStaffState, fd: FormData): Promise<TermStaffState> {
  const user = await staff()
  if (!user) return { error: 'Only admins can change groups.' }
  const slot = Number(fd.get('slot'))
  const m = await import('@/academy/terms/manage')
  if (fd.get('op') === 'remove') {
    await m.removeGroup(await payload(), slot, String(fd.get('groupId')))
    done()
    return { done: 'Group removed — its players stay in the training time.' }
  }
  const name = String(fd.get('name') ?? '').trim()
  if (!name) return { error: 'Give the group a name.' }
  await m.addGroup(await payload(), slot, name.slice(0, 40))
  done()
  return { done: `Added ${name}.` }
}
