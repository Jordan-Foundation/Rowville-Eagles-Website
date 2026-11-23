/**
 * When the automatic follow-ups go out (pure — unit tested). All times are compared in Sydney/Melbourne time.
 *
 *  - Trial reminder: the day before (26 to 3 hours before the session), only for trials booked at least 12 hours
 *    ahead (a last-minute booking has just had its confirmation), and only between 8am and 8pm.
 *  - After the trial: an "enrol now" email from 12 hours after the session (so the morning after an evening trial),
 *    between 9am and 7pm, up to two weeks later; then one last reminder 4 days after that.
 *  - Unfinished booking: one email between 1 and 48 hours after someone started a paid booking and didn't pay,
 *    between 8am and 8pm.
 */
import { localYmd, TZ } from './time'

const H = 3_600_000
export const localHour = (at: Date) => Number(new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(at))
const daytime = (now: Date, from: number, to: number) => {
  const h = localHour(now)
  return h >= from && h < to
}

export function trialReminderDue(o: { start: Date; created: Date; now: Date }) {
  const left = o.start.getTime() - o.now.getTime()
  return left <= 26 * H && left >= 3 * H && o.start.getTime() - o.created.getTime() >= 12 * H && daytime(o.now, 8, 20)
}

export function trialEnrolDue(o: { start: Date; now: Date }) {
  const since = o.now.getTime() - o.start.getTime()
  return since >= 12 * H && since <= 14 * 24 * H && daytime(o.now, 9, 19)
}

export function trialNudgeDue(o: { enrolSentAt: Date; now: Date }) {
  const since = o.now.getTime() - o.enrolSentAt.getTime()
  return since >= 4 * 24 * H && since <= 14 * 24 * H && daytime(o.now, 9, 19)
}

export function recoveryDue(o: { created: Date; now: Date }) {
  const since = o.now.getTime() - o.created.getTime()
  return since >= H && since <= 48 * H && daytime(o.now, 8, 20)
}

/** "today", "tomorrow" or the weekday ("Saturday"). */
export function dayWord(start: Date, now: Date) {
  const d = localYmd(start)
  if (d === localYmd(now)) return 'today'
  if (d === localYmd(new Date(now.getTime() + 24 * H))) return 'tomorrow'
  return new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'long' }).format(start)
}

/** "5:30pm" */
export const timeWord = (at: Date) => new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(at).replace(/\s/g, '').replace(':00', '').toLowerCase()
