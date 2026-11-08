/** Messaging rules (pure — unit tested). */
export type Side = 'family' | 'coach' | 'management'

type ConvLike = { lastFamilyAt?: string | null; lastStaffAt?: string | null; reads?: { user: unknown; at: string }[] | null }
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : v)

/** Unread for this person: the other side wrote after they last opened it. */
export function isUnread(c: ConvLike, userId: number, side: 'family' | 'management') {
  const latest = side === 'family' ? c.lastStaffAt : c.lastFamilyAt
  if (!latest) return false
  const read = (c.reads ?? []).find((r) => rel(r.user) === userId)?.at
  return !read || new Date(latest) > new Date(read)
}

export const preview = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, 120)

/** Text sent to a family: the message, then who it's from (so they know who's replying). */
export const smsReply = (body: string, from: string) => `${body.trim()}\n– ${from === 'Foundation Academy' ? from : `${from}, Foundation Academy`}`
