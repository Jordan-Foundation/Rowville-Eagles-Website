import type { Payload } from 'payload'
import { localYmd } from '../lib/time'

/**
 * Session length per age group (Management setting, e.g. U7 = 60 minutes). Applied to Academy term training times
 * (slots) and trial nights. A time slot follows the setting only when every year of birth in it is in the same
 * configured age group. Weeks already held keep their old length (so coach pay for past sessions doesn't change),
 * and anything with bookings is skipped and reported instead of changed.
 */

export type LengthRule = { ageGroup: string; minutes: number }
export const DEFAULT_LENGTHS: LengthRule[] = [{ ageGroup: 'U7', minutes: 60 }]

/** "U7" for a player born in 2020 in a 2027 program (club rule: U = year − year of birth, as on the join page). */
export const ageGroupOf = (birthYear: number, year: number) => `U${year - birthYear}`

/** The configured length for these years of birth, or null if they're not all in one configured group. */
export function lengthFor(birthYears: number[] | null | undefined, year: number, rules: LengthRule[]) {
  const ys = (birthYears ?? []).filter((y) => Number.isFinite(y))
  if (!ys.length) return null
  const mins = ys.map((y) => rules.find((r) => r.ageGroup.trim().toUpperCase() === ageGroupOf(y, year))?.minutes ?? null)
  return mins.every((m) => m !== null && m === mins[0]) ? (mins[0] as number) : null
}

export function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(':').map(Number)
  const t = (h * 60 + m + minutes + 24 * 60) % (24 * 60)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
export const minutesBetween = (a: string, b: string) => {
  const [h1, m1] = a.split(':').map(Number)
  const [h2, m2] = b.split(':').map(Number)
  return h2 * 60 + m2 - (h1 * 60 + m1)
}

export async function lengthRules(p: Payload): Promise<LengthRule[]> {
  const s = await p.findGlobal({ slug: 'academy-settings', depth: 0, overrideAccess: true }).catch(() => null)
  const rows = (s?.sessionLengths ?? []).filter((r): r is LengthRule => Boolean(r?.ageGroup && r?.minutes))
  return rows.length ? rows : DEFAULT_LENGTHS
}

export type ApplyReport = { at: string; changed: string[]; skipped: string[]; trialNights: number }

const q = { overrideAccess: true, depth: 0 } as const
const yearOf = (iso?: string | null) => (iso ? Number(localYmd(new Date(iso)).slice(0, 4)) : new Date().getFullYear())

/** Bring every current/upcoming Academy term slot (and trial night) into line with the setting. Idempotent. */
export async function applySessionLengths(p: Payload, now = new Date()): Promise<ApplyReport> {
  const rules = await lengthRules(p)
  const today = localYmd(now)
  const nowIso = now.toISOString()
  const report: ApplyReport = { at: nowIso, changed: [], skipped: [], trialNights: 0 }
  const { docs: programs } = await p.find({ ...q, collection: 'programs', where: { type: { in: ['academy-term', 'toddler'] }, or: [{ endDate: { greater_than_equal: nowIso } }, { endDate: { exists: false } }] }, limit: 200, pagination: false })
  for (const prog of programs) {
    const year = yearOf(prog.startDate)
    const { docs: slots } = await p.find({ ...q, collection: 'academy-term-slots', where: { program: { equals: prog.id } }, limit: 500, pagination: false })
    for (const slot of slots) {
      const mins = lengthFor(slot.birthYears as number[], year, rules)
      if (mins === null || minutesBetween(slot.startTime, slot.endTime) === mins) continue
      const label = `${prog.title} — ${slot.title ?? `${slot.weekday} ${slot.startTime}`}`
      // Safety: never change a slot families have booked (report it instead)
      const [regs, trials] = await Promise.all([
        p.count({ ...q, collection: 'academy-registrations', where: { slot: { equals: slot.id }, status: { in: ['offered', 'pending_payment', 'paid'] } } }),
        p.count({ ...q, collection: 'bookings', where: { program: { equals: prog.id }, bookingType: { equals: 'trial' }, status: { in: ['paid', 'pending'] }, sessionStart: { greater_than_equal: nowIso }, birthYear: { in: (slot.birthYears ?? []) as number[] } } }),
      ])
      if (regs.totalDocs || trials.totalDocs) {
        report.skipped.push(`${label}: ${regs.totalDocs} registration${regs.totalDocs === 1 ? '' : 's'}, ${trials.totalDocs} trial booking${trials.totalDocs === 1 ? '' : 's'} — not changed`)
        continue
      }
      const started = Boolean(prog.startDate && localYmd(new Date(prog.startDate)) < today)
      const endTime = addMinutes(slot.startTime, mins)
      await p.update({
        ...q,
        collection: 'academy-term-slots',
        id: slot.id,
        context: { skipNotify: true, skipLengthRule: true },
        data: {
          endTime,
          // Weeks already held keep their old finish time (pay and history unchanged)
          ...(started && !slot.previousEndUntil ? { previousEndTime: slot.endTime, previousEndUntil: today } : {}),
        },
      })
      report.changed.push(`${label}: ${slot.startTime}–${slot.endTime} → ${slot.startTime}–${endTime}`)
    }
    // Trial nights set on the program (older setup without time slots)
    let touched = false
    const weekly = (prog.weeklySessions ?? []).map((w) => {
      const mins = lengthFor(w.birthYears as number[], year, rules)
      if (mins === null || w.durationMinutes === mins) return w
      touched = true
      report.trialNights++
      return { ...w, durationMinutes: mins }
    })
    if (touched) await p.update({ ...q, collection: 'programs', id: prog.id, context: { skipOffer: true }, data: { weeklySessions: weekly } })
  }
  await p.updateGlobal({ slug: 'academy-settings', ...q, data: { sessionLengthsLastRun: report } }).catch(() => null)
  return report
}
