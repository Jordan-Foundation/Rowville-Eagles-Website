'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { coachOrNull } from '@/academy/portal'
import { WEEKDAYS, startTimesFor, type Weekday } from '@/academy/constants'
import { toYmd } from '@/academy/term-dates'
import { localToUtc } from '@/lib/time'
import type { AcademyAvailability, AcademyTerm } from '@/payload-types'
import { alertBlockedRemoval, alertCoverNeeded, sessionsOnSlot, syncCoverFlags, upcomingSessions } from '@/academy/cover'

export type AvailabilityState = { error?: string; saved?: boolean; first?: boolean }

const key = (s: { weekday: string; startTime: string }) => `${s.weekday} ${s.startTime}`

async function load(termIdRaw: FormDataEntryValue | null) {
  const me = await coachOrNull()
  if (!me) return { error: 'Please log in as a coach.' as const }
  const p = await payload()
  const termId = Number(termIdRaw)
  const term = termId ? await p.findByID({ collection: 'academy-terms', id: termId, depth: 0, disableErrors: true }) : null
  if (!term || !['availability', 'open'].includes(term.status)) return { error: 'This term isn’t taking availability any more. Contact the admin to make changes.' as const }
  const { docs } = await p.find({ pagination: false, collection: 'academy-availability', where: { coach: { equals: me.coach.id }, term: { equals: term.id } }, limit: 1, depth: 0, overrideAccess: true })
  return { me, p, term: term as AcademyTerm, existing: docs[0] as AcademyAvailability | undefined }
}

export async function saveAvailability(_prev: AvailabilityState, fd: FormData): Promise<AvailabilityState> {
  const ctx = await load(fd.get('termId'))
  if ('error' in ctx) return { error: ctx.error }
  const { me, p, term, existing } = ctx

  let picked: { weekday: Weekday; startTime: string }[]
  try {
    picked = (JSON.parse(String(fd.get('slots') ?? '[]')) as string[]).map((k) => {
      const [weekday, startTime] = k.split(' ')
      if (!(WEEKDAYS as readonly string[]).includes(weekday) || !startTimesFor(term, weekday).includes(startTime)) throw new Error(k)
      return { weekday: weekday as Weekday, startTime }
    })
  } catch {
    return { error: 'Some of those times aren’t available for this term. Please refresh and try again.' }
  }
  const unique = Array.from(new Map(picked.map((s) => [key(s), s])).values())
  const before = new Set((existing?.slots ?? []).map(key))
  const after = new Set(unique.map(key))
  const added = [...after].filter((k) => !before.has(k))
  const removed = [...before].filter((k) => !after.has(k))

  // Families have already booked these times — block the removal and tell the admin
  if (removed.length) {
    const booked = await upcomingSessions(p, me.coach.id, term)
    const blocked = removed
      .map((k) => {
        const [weekday, time] = k.split(' ')
        return { slot: k, sessions: sessionsOnSlot(booked, weekday, time) }
      })
      .filter((b) => b.sessions.length > 0)
    if (blocked.length) {
      await alertBlockedRemoval(p, me.coach, term.name, blocked)
      return {
        error: `Families are booked on ${blocked.map((b) => b.slot).join(', ')}, so those times can’t be removed here. Please contact the Academy admin — we’ve let them know. If you’ll be away, add an away period below instead.`,
      }
    }
  }

  const now = new Date().toISOString()
  const change = added.length || removed.length ? [{ at: now, added: added.join(', ') || undefined, removed: removed.join(', ') || undefined }] : []
  const sorted = unique.sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime))
  if (existing) {
    await p.update({ collection: 'academy-availability', id: existing.id, overrideAccess: true, data: { slots: sorted, submittedAt: existing.submittedAt ?? now, changes: [...(existing.changes ?? []), ...change] } })
  } else {
    await p.create({ collection: 'academy-availability', overrideAccess: true, data: { coach: me.coach.id, term: term.id, slots: sorted, submittedAt: now, changes: change } })
  }
  revalidatePath('/coach')
  return { saved: true, first: !existing?.submittedAt }
}

export type AwayState = { error?: string; saved?: boolean }

/** Add or remove a period the coach is away during the term. */
export async function updateAway(_prev: AwayState, fd: FormData): Promise<AwayState> {
  const ctx = await load(fd.get('termId'))
  if ('error' in ctx) return { error: ctx.error }
  const { me, p, term, existing } = ctx
  const periods = (existing?.awayPeriods ?? []).map(({ from, to, note }) => ({ from, to, note }))
  const removeIndex = fd.get('remove')
  let change: string

  if (removeIndex !== null) {
    const i = Number(removeIndex)
    const gone = periods[i]
    if (!gone) return { error: 'That period has already been removed.' }
    periods.splice(i, 1)
    change = `away removed ${toYmd(gone.from)} – ${toYmd(gone.to)}`
  } else {
    const from = String(fd.get('from') ?? '')
    const to = String(fd.get('to') ?? '') || from
    const note = String(fd.get('note') ?? '').trim().slice(0, 120)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: 'Please choose the first and last day you’re away.' }
    if (to < from) return { error: 'The last day can’t be before the first day.' }
    if (to < toYmd(term.startDate) || from > toYmd(term.endDate)) return { error: `Those dates are outside ${term.name}.` }
    periods.push({ from: localToUtc(from, '00:00').toISOString(), to: localToUtc(to, '23:59').toISOString(), note: note || undefined })
    periods.sort((a, b) => a.from.localeCompare(b.from))
    change = `away added ${from} – ${to}${note ? ` (${note})` : ''}`
  }

  const entry = { at: new Date().toISOString(), added: removeIndex === null ? change : undefined, removed: removeIndex !== null ? change : undefined }
  if (existing) {
    await p.update({ collection: 'academy-availability', id: existing.id, overrideAccess: true, data: { awayPeriods: periods, changes: [...(existing.changes ?? []), entry] } })
  } else {
    await p.create({ collection: 'academy-availability', overrideAccess: true, data: { coach: me.coach.id, term: term.id, slots: [], awayPeriods: periods, changes: [entry] } })
  }

  // Sessions families have already booked on away days now need a replacement coach
  const flagged = await syncCoverFlags(p, me.coach.id, term, periods)
  if (flagged.length) await alertCoverNeeded(p, me.coach, flagged, `will be away (${change.replace(/^away added /, '')})`)

  revalidatePath(`/coach/availability/${term.id}`)
  return { saved: true }
}
