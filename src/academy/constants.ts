export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type Weekday = (typeof WEEKDAYS)[number]
export const weekdayOptions = WEEKDAYS.map((d) => ({ label: d, value: d }))

/** Default fixed start times for 60-minute sessions (admin can change per term). */
export const DEFAULT_SLOT_TIMES = ['15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
