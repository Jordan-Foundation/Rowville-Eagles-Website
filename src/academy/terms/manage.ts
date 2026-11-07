import type { Payload } from 'payload'
import type { AcademyCoach, AcademyRegistration, AcademyTermSlot, Program, User } from '@/payload-types'
import { groupLabel, type AgeRules } from '../../lib/age-groups'
import { sendEmail } from '../../lib/email'
import { emailLayout, esc } from '../../lib/email-templates'
import { formatDate } from '../../lib/format'
import { siteUrl } from '../../lib/payments'
import { sendSms } from '../../lib/sms'
import { placeInSlot } from './placement'
import { slotLabel, upcomingSessions } from './slots'

/**
 * Staff changes to Academy term places: move players between training times (age rules apply),
 * put them in groups, allocate coaches. Paid families are told about anything that changes for them,
 * once per change, by email and SMS.
 */

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))
const PLACED = ['paid', 'offered', 'pending_payment'] as const

export type Change = { reg: AcademyRegistration; lines: string[] }

/** Coach names for ids. */
export async function coachNames(payload: Payload, ids: (number | AcademyCoach)[] | null | undefined) {
  const list = (ids ?? []).map((c) => (typeof c === 'object' ? c.id : c))
  if (!list.length) return [] as string[]
  const { docs } = await payload.find({ collection: 'academy-coaches', where: { id: { in: list } }, limit: list.length, depth: 0, overrideAccess: true })
  return docs.map((d) => d.displayName)
}

/** Email + SMS each paid family once, combining every change for their children. */
export async function notifyFamilies(payload: Payload, changes: Change[], heading = 'Training update') {
  const paid = changes.filter((c) => c.reg.status === 'paid' && c.lines.length)
  const byEmail = new Map<string, Change[]>()
  for (const c of paid) byEmail.set(c.reg.contact.email.toLowerCase(), [...(byEmail.get(c.reg.contact.email.toLowerCase()) ?? []), c])
  let sent = 0
  for (const list of byEmail.values()) {
    const first = list[0].reg
    const program = (typeof first.program === 'object' ? first.program : await payload.findByID({ collection: 'programs', id: first.program, depth: 0, overrideAccess: true })) as Program
    const user = first.account ? ((await payload.findByID({ collection: 'users', id: rel(first.account)!, depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
    const html = emailLayout('academy', [
      {
        heading,
        intro: `Hi ${esc(first.contact.firstName)}, there’s a change to ${esc(program.title)}:<br><br>${list
          .map((c) => `<strong>${esc(c.reg.player.firstName)}</strong><br>${c.lines.map(esc).join('<br>')}`)
          .join('<br><br>')}`,
        cta: { label: 'See the timetable', href: `${siteUrl()}/account` },
        after: 'Questions? Just reply to this email.',
      },
    ])
    await sendEmail(payload, { to: first.contact.email, subject: `${heading}: ${list.map((c) => c.reg.player.firstName).join(' & ')} — ${program.title}`, html, sender: 'academy', userId: user?.id })
    const short = list.map((c) => `${c.reg.player.firstName}: ${c.lines.join('; ')}`).join(' | ')
    await sendSms(payload, { to: first.contact.phone, kind: 'service', optedOut: user?.smsOptOut, userId: user?.id, body: `${program.title} update — ${short.slice(0, 300)} – Foundation Academy` })
    sent++
  }
  return sent
}

const groupName = (slot: AcademyTermSlot, id: string | null | undefined) => slot.groups?.find((g) => g.id === id)?.name ?? null

/** Describe a slot for a family: "Thursday 5:30pm–6:30pm · Rowville Reserve, first session Thu 4 Feb" */
function slotLine(slot: AcademyTermSlot, program: Program) {
  const next = upcomingSessions(slot, program)[0]
  return `${slotLabel(slot)}${next ? `, from ${formatDate(next.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}`
}

export type MoveResult = { moved: number; notified: number; needReason?: string[]; blocked: string[]; skipped: string[]; warnings: string[] }

/** Move players to another training time. Moves outside their age group need a reason; blocked moves are skipped. */
export async function moveToSlot(payload: Payload, ids: number[], slotId: number, o: { reason: string; actorId: number; notify: boolean; rules: AgeRules; preview?: boolean }): Promise<MoveResult> {
  const slot = await payload.findByID({ collection: 'academy-term-slots', id: slotId, depth: 0, overrideAccess: true })
  const program = await payload.findByID({ collection: 'programs', id: rel(slot.program)!, depth: 0, overrideAccess: true })
  const { docs } = await payload.find({ collection: 'academy-registrations', where: { id: { in: ids } }, limit: ids.length, depth: 0, overrideAccess: true })
  const res: MoveResult = { moved: 0, notified: 0, blocked: [], skipped: [], warnings: [] }
  const plans: { r: AcademyRegistration; playing: number | null; moveNote?: string }[] = []
  const needReason: string[] = []
  for (const r of docs) {
    const name = `${r.player.firstName} ${r.player.lastName}`
    if (rel(r.program) !== program.id) { res.skipped.push(`${name} (another program)`); continue }
    if (!(PLACED as readonly string[]).includes(r.status)) { res.skipped.push(`${name} (${r.status === 'interest' ? 'use Offer place' : r.status})`); continue }
    if (rel(r.slot) === slot.id) { res.skipped.push(`${name} (already there)`); continue }
    const p = placeInSlot(r.birthYear!, (slot.birthYears ?? []) as number[], o.rules)
    if (p.check && !p.check.allowed) { res.blocked.push(`${name}: ${p.check.message}`); continue }
    if (p.isMove) {
      needReason.push(`${name}: ${p.check!.message}`)
      if (p.check!.warning) res.warnings.push(`${name}: ${p.check!.message}`)
    }
    plans.push({ r, playing: p.playingBirthYear, moveNote: p.isMove ? `${groupLabel(r.birthYear!)} → ${groupLabel(p.playingBirthYear!)}` : undefined })
  }
  if (needReason.length && !o.reason.trim()) return { ...res, needReason }
  if (o.preview) return { ...res, needReason }
  const changes: Change[] = []
  for (const { r, playing, moveNote } of plans) {
    const prev = r.playingBirthYear ?? r.birthYear
    const moves = [...(r.moves ?? [])]
    if ((playing ?? r.birthYear) !== prev) {
      moves.push({ from: groupLabel(prev!), to: groupLabel(playing ?? r.birthYear!), reason: moveNote ? o.reason.trim() : 'Back to their own age group', by: o.actorId, at: new Date().toISOString() })
    }
    const updated = await payload.update({ collection: 'academy-registrations', id: r.id, overrideAccess: true, data: { slot: slot.id, groupId: null, playingBirthYear: playing, moves } })
    changes.push({ reg: { ...updated, program }, lines: [`New training time: ${slotLine(slot, program)}`] })
    res.moved++
  }
  if (slot.capacity) {
    const { totalDocs } = await payload.count({ collection: 'academy-registrations', where: { slot: { equals: slot.id }, status: { in: [...PLACED] } }, overrideAccess: true })
    if (totalDocs > slot.capacity) res.warnings.push(`${slotLabel(slot)} now has ${totalDocs} players for ${slot.capacity} places.`)
  }
  if (o.notify) res.notified = await notifyFamilies(payload, changes, 'Training time changed')
  return res
}

/** Put players into a group of their training time (null = no group). */
export async function setGroup(payload: Payload, ids: number[], slotId: number, groupId: string | null, o: { notify: boolean }) {
  const slot = await payload.findByID({ collection: 'academy-term-slots', id: slotId, depth: 0, overrideAccess: true })
  if (groupId && !slot.groups?.some((g) => g.id === groupId)) throw new Error('That group isn’t part of this training time.')
  const program = await payload.findByID({ collection: 'programs', id: rel(slot.program)!, depth: 0, overrideAccess: true })
  const { docs } = await payload.find({ collection: 'academy-registrations', where: { id: { in: ids }, slot: { equals: slot.id } }, limit: ids.length, depth: 0, overrideAccess: true })
  const g = groupId ? slot.groups!.find((x) => x.id === groupId)! : null
  const coaches = g ? await coachNames(payload, g.coaches as number[]) : []
  const changes: Change[] = []
  for (const r of docs) {
    if ((r.groupId ?? null) === groupId) continue
    const updated = await payload.update({ collection: 'academy-registrations', id: r.id, overrideAccess: true, data: { groupId } })
    if (g) changes.push({ reg: { ...updated, program }, lines: [`Now in ${g.name}${coaches.length ? ` with ${coaches.join(' & ')}` : ''} (${slotLabel(slot)})`] })
  }
  const notified = o.notify ? await notifyFamilies(payload, changes, 'Group update') : 0
  return { changed: changes.length || docs.filter((r) => (r.groupId ?? null) !== groupId).length, skipped: ids.length - docs.length, notified }
}

/** Families affected by a coach change on a slot (whole slot) or one group. */
async function coachChangeNotice(payload: Payload, slot: AcademyTermSlot, groupId: string | null, coaches: number[]) {
  const program = await payload.findByID({ collection: 'programs', id: rel(slot.program)!, depth: 0, overrideAccess: true })
  const names = await coachNames(payload, coaches)
  const { docs } = await payload.find({
    collection: 'academy-registrations',
    where: { slot: { equals: slot.id }, status: { equals: 'paid' }, ...(groupId ? { groupId: { equals: groupId } } : {}) },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const label = groupId ? `${groupName(slot, groupId)} (${slotLabel(slot)})` : slotLabel(slot)
  return notifyFamilies(
    payload,
    docs.map((r) => ({ reg: { ...r, program }, lines: [names.length ? `Coach${names.length > 1 ? 'es' : ''} for ${label}: ${names.join(' & ')}` : `Coach for ${label} to be confirmed`] })),
    'Coach update',
  )
}

export async function setSlotCoaches(payload: Payload, slotId: number, coaches: number[], notify: boolean) {
  const slot = await payload.update({ collection: 'academy-term-slots', id: slotId, overrideAccess: true, context: { skipNotify: true }, data: { coaches } })
  return notify ? coachChangeNotice(payload, slot, null, coaches) : 0
}

export async function setGroupCoaches(payload: Payload, slotId: number, groupId: string, coaches: number[], notify: boolean) {
  const slot = await payload.findByID({ collection: 'academy-term-slots', id: slotId, depth: 0, overrideAccess: true })
  if (!slot.groups?.some((g) => g.id === groupId)) throw new Error('Group not found.')
  const groups = slot.groups.map((g) => ({ ...g, coaches: g.id === groupId ? coaches : ((g.coaches ?? []) as (number | AcademyCoach)[]).map((c) => (typeof c === 'object' ? c.id : c)) }))
  const updated = await payload.update({ collection: 'academy-term-slots', id: slotId, overrideAccess: true, context: { skipNotify: true }, data: { groups } })
  return notify ? coachChangeNotice(payload, updated, groupId, coaches) : 0
}

export async function addGroup(payload: Payload, slotId: number, name: string) {
  const slot = await payload.findByID({ collection: 'academy-term-slots', id: slotId, depth: 0, overrideAccess: true })
  const groups = [...(slot.groups ?? []).map((g) => ({ ...g, coaches: ((g.coaches ?? []) as (number | AcademyCoach)[]).map((c) => (typeof c === 'object' ? c.id : c)) })), { name, coaches: [] }]
  return payload.update({ collection: 'academy-term-slots', id: slotId, overrideAccess: true, context: { skipNotify: true }, data: { groups } })
}

/** Remove a group; its players stay in the training time without a group. */
export async function removeGroup(payload: Payload, slotId: number, groupId: string) {
  const slot = await payload.findByID({ collection: 'academy-term-slots', id: slotId, depth: 0, overrideAccess: true })
  await payload.update({ collection: 'academy-registrations', where: { slot: { equals: slotId }, groupId: { equals: groupId } }, overrideAccess: true, data: { groupId: null } })
  const groups = (slot.groups ?? []).filter((g) => g.id !== groupId).map((g) => ({ ...g, coaches: ((g.coaches ?? []) as (number | AcademyCoach)[]).map((c) => (typeof c === 'object' ? c.id : c)) }))
  return payload.update({ collection: 'academy-term-slots', id: slotId, overrideAccess: true, context: { skipNotify: true }, data: { groups } })
}

// ── Time changes made in the admin (slot day/time/venue, single-week changes) ──

type WeekChange = { date: string; cancelled?: boolean | null; startTime?: string | null; endTime?: string | null; note?: string | null }
const weekKey = (e: WeekChange) => `${String(e.date).slice(0, 10)}|${e.cancelled ? 'x' : ''}|${e.startTime ?? ''}|${e.endTime ?? ''}|${e.note ?? ''}`

/** What changed for families between two versions of a slot (future weeks only). */
export function describeSlotChange(prev: AcademyTermSlot, next: AcademyTermSlot, program: Program, now = new Date()): string[] {
  const lines: string[] = []
  if (prev.weekday !== next.weekday || prev.startTime !== next.startTime || prev.endTime !== next.endTime || (prev.venue ?? '') !== (next.venue ?? '')) {
    lines.push(`New training time: ${slotLine(next, program)} (was ${slotLabel(prev)})`)
  }
  const before = new Set((prev.exceptions ?? []).map(weekKey))
  const sessions = new Map(upcomingSessions({ ...next, exceptions: next.exceptions } as never, program, now).map((s) => [s.date, s]))
  for (const e of next.exceptions ?? []) {
    if (before.has(weekKey(e))) continue
    const ymd = String(e.date).slice(0, 10)
    if (new Date(`${ymd}T23:59:59Z`) < now) continue
    const s = sessions.get(ymd)
    const d = formatDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' })
    if (e.cancelled) lines.push(`No training on ${d}${e.note ? ` — ${e.note}` : ''}`)
    else if (s) lines.push(`${d}: training moves to ${formatDate(s.startsAt, { hour: 'numeric', minute: '2-digit' })}${e.note ? ` — ${e.note}` : ''}`)
  }
  return lines
}

export async function notifySlotChange(payload: Payload, prev: AcademyTermSlot, next: AcademyTermSlot) {
  const program = await payload.findByID({ collection: 'programs', id: rel(next.program)!, depth: 0, overrideAccess: true })
  const lines = describeSlotChange(prev, next, program)
  if (!lines.length) return 0
  const { docs } = await payload.find({ collection: 'academy-registrations', where: { slot: { equals: next.id }, status: { equals: 'paid' } }, limit: 500, depth: 0, overrideAccess: true })
  return notifyFamilies(payload, docs.map((r) => ({ reg: { ...r, program }, lines })), 'Training update')
}
