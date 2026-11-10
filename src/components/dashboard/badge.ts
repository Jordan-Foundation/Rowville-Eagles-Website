/** Badge text: hidden at 0, "99+" above 99 (pure — unit tested). */
export const badgeText = (n: number | null | undefined) => (!n || n <= 0 ? null : n > 99 ? '99+' : String(n))
export const badgeLabel = (label: string, n: number | null | undefined, meaning?: string | null) => (badgeText(n) ? `${label}, ${meaning ?? `${n! > 99 ? 'more than 99' : n} need${n === 1 ? 's' : ''} attention`}` : label)

/** What a badge number means, per dashboard button ("3 to fulfil"). */
export const BADGE_UNITS: Record<string, string> = {
  // Management
  bookings: 'to action', payments: 'overdue', cover: 'need cover', availability: 'not submitted', terms: 'waiting or no coach',
  selections: 'to decide', store: 'to fulfil', foundation: 'to review', consent: 'to review', reports: 'to review', dates: 'to fix',
  promotions: 'live or scheduled', settings: 'to do', camps: 'to sort', yearly: 'due', announcements: 'to approve',
  // Coach (messages: both)
  messages: 'unread', sessions: 'to check', attendance: 'to mark', groups: 'new', teams: 'new posts', reviews: 'to review',
}
/** "3 to fulfil" — or null at 0. Coach reports read "to write". */
export const badgeMeaning = (key: string, n: number | null | undefined, role?: 'coach' | 'management') =>
  !n || n <= 0 ? null : `${n > 99 ? '99+' : n} ${role === 'coach' && key === 'reports' ? 'to write' : role === 'coach' && key === 'availability' ? 'due' : role === 'coach' && key === 'camps' ? 'to answer' : BADGE_UNITS[key] ?? 'need attention'}`
