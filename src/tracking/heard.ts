/** "How did you hear about us?" — optional on the trial, camp/program and 1-on-1 forms. */
export const HEARD_FROM = [
  { value: 'facebook-instagram-ad', label: 'Facebook or Instagram ad' },
  { value: 'google', label: 'Google (search or ad)' },
  { value: 'friend-family', label: 'Friend or family' },
  { value: 'school', label: 'School' },
  { value: 'rowville-eagles', label: 'Already at Rowville Eagles' },
  { value: 'social-post', label: 'Club Facebook / Instagram page' },
  { value: 'other', label: 'Other' },
] as const

export const heardFromValue = (v: unknown) => (HEARD_FROM.some((o) => o.value === v) ? (v as (typeof HEARD_FROM)[number]['value']) : undefined)
export const heardFromLabel = (v?: string | null) => HEARD_FROM.find((o) => o.value === v)?.label ?? 'Not answered'

/** The admin field (bookings and 1-on-1 bookings). */
export const heardFromField = {
  name: 'heardFrom',
  label: 'How did you hear about us?',
  type: 'select' as const,
  options: HEARD_FROM.map((o) => ({ label: o.label, value: o.value })),
  index: true,
  admin: { position: 'sidebar' as const, readOnly: true },
}

/** Bookings (trials, camps, programs, 1-on-1s) made in a period, counted by their answer — for Management. */
export async function heardFromCounts(p: import('payload').Payload, from: string, to: string) {
  const where = { createdAt: { greater_than_equal: from, less_than_equal: to } }
  const q = { pagination: false, limit: 20000, depth: 0, overrideAccess: true } as const
  const [b, ab] = await Promise.all([
    p.find({ ...q, collection: 'bookings', where: { ...where, status: { in: ['paid', 'refunded'] } }, select: { heardFrom: true } }),
    p.find({ ...q, collection: 'academy-bookings', where: { ...where, status: { in: ['confirmed', 'completed', 'payment_failed', 'cancelled'] } }, select: { heardFrom: true } }),
  ])
  const counts = new Map<string, number>()
  for (const d of [...b.docs, ...ab.docs]) counts.set(d.heardFrom ?? '', (counts.get(d.heardFrom ?? '') ?? 0) + 1)
  return [...HEARD_FROM.map((o) => ({ key: o.value as string, label: o.label })), { key: '', label: 'Not answered' }]
    .map((o) => ({ ...o, count: counts.get(o.key) ?? 0 }))
    .filter((o) => o.count > 0)
}
