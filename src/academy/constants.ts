export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type Weekday = (typeof WEEKDAYS)[number]
export const weekdayOptions = WEEKDAYS.map((d) => ({ label: d, value: d }))
export const isWeekend = (d: string) => d === 'Saturday' || d === 'Sunday'

/** Default fixed start times for 60-minute sessions (admin can change per term). */
export const DEFAULT_WEEKDAY_TIMES = ['15:00', '16:00', '17:00', '18:00', '19:00', '20:00'] // 3pm–9pm
export const DEFAULT_WEEKEND_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'] // 8am–5pm
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Start times a coach can choose on a given day of this term. */
export function startTimesFor(term: { slotStartTimes?: { time: string }[] | null; weekendStartTimes?: { time: string }[] | null }, day: string) {
  return ((isWeekend(day) ? term.weekendStartTimes : term.slotStartTimes) ?? []).map((t) => t.time)
}
