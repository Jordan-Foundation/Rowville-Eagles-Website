'use server'

import { coachOrNull } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { saveAttendance } from '@/academy/training-day'

export type AttendanceState = { saved?: string; error?: string; at?: number }

export async function saveAttendanceAction(_prev: AttendanceState, fd: FormData): Promise<AttendanceState> {
  const c = await coachOrNull()
  if (!c) return { error: 'Please log in again.' }
  try {
    const r = await saveAttendance(await payload(), c.user, c.coach, String(fd.get('key') ?? ''), fd.getAll('present').map(Number).filter(Number.isInteger))
    return { saved: `Saved — ${r.present} of ${r.roster} here.`, at: Date.now() }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Couldn’t save — try again.' }
  }
}
