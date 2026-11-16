/**
 * Management notifications — pure rules (unit-tested in tests/int/staff-feed.int.spec.ts).
 * Every booking, payment, trial sign-up and problem becomes a feed item; urgent ones are texted straight away
 * (held overnight and bundled into one 7am text), and everything goes into the 8pm digest email.
 */

export type FeedKind = 'problem' | 'trial' | 'booking' | 'payment' | 'enquiry'
export type FeedItem = { kind: FeedKind; title: string; detail?: string | null; href?: string | null; urgent?: boolean | null }

export const QUIET_FROM = 21 // 9pm
export const QUIET_TO = 7 // 7am
export const DIGEST_HOUR = 20 // 8pm

/** No texts between 9pm and 7am (local). */
export const isQuiet = (localHour: number) => localHour >= QUIET_FROM || localHour < QUIET_TO

/** “Soon” = starts within the next 48 hours (and hasn't already finished). */
export const isSoon = (startsAt: string | Date | null | undefined, now = new Date()) => {
  if (!startsAt) return false
  const t = new Date(startsAt).getTime() - now.getTime()
  return t > -2 * 3_600_000 && t <= 48 * 3_600_000
}

/** A status that has just changed into `to` (not on every later save). */
export const became = (prev: { status?: string | null } | null | undefined, doc: { status?: string | null }, to: string | string[]) => {
  const list = Array.isArray(to) ? to : [to]
  return list.includes(String(doc.status)) && !list.includes(String(prev?.status ?? ''))
}

export const SECTION: Record<FeedKind, string> = {
  problem: 'Needs attention',
  trial: 'Trial sign-ups',
  enquiry: 'Enquiries',
  booking: 'Bookings',
  payment: 'Payments',
}
export const ORDER: FeedKind[] = ['problem', 'trial', 'enquiry', 'booking', 'payment']

/** Digest sections in a fixed order, empty ones left out. */
export function groupForDigest<T extends { kind: FeedKind }>(items: T[]): { kind: FeedKind; title: string; items: T[] }[] {
  return ORDER.map((kind) => ({ kind, title: SECTION[kind], items: items.filter((i) => i.kind === kind) })).filter((g) => g.items.length)
}

/** One text for an urgent item. */
export const urgentText = (i: FeedItem, link: string) => `${i.title}${i.detail ? ` — ${i.detail}` : ''}. ${link}`.slice(0, 320)

/** The 7am text for everything held overnight (kept short: first 4, then a count). */
export function morningText(items: FeedItem[], link: string) {
  const lines = items.slice(0, 4).map((i) => `• ${i.title}${i.detail ? ` — ${i.detail}` : ''}`.slice(0, 110))
  const more = items.length > 4 ? `\n+${items.length - 4} more` : ''
  return `Overnight (${items.length}):\n${lines.join('\n')}${more}\n${link}`
}

/** Has the 8pm digest for this local date gone? `lastSent` is the local YYYY-MM-DD it was last sent for. */
export const digestDue = (localHour: number, todayYmd: string, lastSent: string | null | undefined) => localHour >= DIGEST_HOUR && lastSent !== todayYmd
