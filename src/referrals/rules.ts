/** Refer a Friend — the rules (pure, unit tested). */
import type { ReferralProgram } from './programs'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** "TOM-7K3Q": the player's first name (letters only, up to 6) and 4 random characters. */
export function makeCode(firstName: string | null | undefined, rand: (n: number) => number[] = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 256))) {
  const name = (firstName ?? '').toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '').slice(0, 6) || 'RFA'
  return `${name}-${rand(4).map((b) => ALPHABET[b % ALPHABET.length]).join('')}`
}

export const normaliseCode = (v: unknown) => {
  const s = String(v ?? '').trim().toUpperCase().replace(/\s+/g, '')
  return /^[A-Z]{1,6}-[A-Z0-9]{4}$/.test(s) ? s : null
}

/** Australian mobile → +614… (or null). */
export function e164(m: string | null | undefined) {
  const d = (m ?? '').replace(/[\s()-]/g, '')
  if (/^04\d{8}$/.test(d)) return `+61${d.slice(1)}`
  if (/^\+?614\d{8}$/.test(d)) return `+${d.replace(/^\+/, '')}`
  return null
}

/** "j•••@gmail.com" / "•••• ••• 678" — enough for a parent to recognise who they invited. */
export function maskContact(email?: string | null, phone?: string | null) {
  if (email) {
    const [u, d] = email.split('@')
    return `${u.slice(0, 1)}•••@${d ?? ''}`
  }
  if (phone) return `•••• ••• ${phone.replace(/\D/g, '').slice(-3)}`
  return ''
}

/**
 * When a referral counts: 1-on-1s once the first session has gone ahead; everything else after the refund
 * window — or as soon as the program starts (a refund can't be given once they've attended), whichever is first.
 */
export function confirmAfterFor(program: ReferralProgram, paidAt: Date, o: { windowDays: number; startsAt?: string | null }) {
  const start = o.startsAt ? new Date(o.startsAt) : null
  if (program === 'one-on-one') return start ?? paidAt
  const windowEnd = new Date(paidAt.getTime() + Math.max(0, o.windowDays) * 86_400_000)
  return start && start < windowEnd ? (start < paidAt ? paidAt : start) : windowEnd
}

/** Attribution: a code at checkout (or saved on the family's account) always wins; otherwise the earliest matching invite. */
export function chooseAttribution(o: { code?: { referrer: number } | null; invites: { id: number; referrer: number; createdAt: string }[] }) {
  if (o.code) return { referrer: o.code.referrer, attribution: 'code' as const, invite: null as number | null }
  const first = [...o.invites].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
  return first ? { referrer: first.referrer, attribution: 'invite_match' as const, invite: first.id } : null
}

/** Milestones the player has reached but not been given yet. */
export function milestonesDue<T extends { id: number; threshold: number; active?: boolean | null }>(confirmed: number, milestones: T[], granted: number[]): T[] {
  const have = new Set(granted)
  return milestones.filter((m) => m.active !== false && m.threshold <= confirmed && !have.has(m.id)).sort((a, b) => a.threshold - b.threshold)
}

/** Progress for the tracker: "3 confirmed — 1 more to your free bag!" */
export function nextMilestone(confirmed: number, milestones: { threshold: number; rewardName: string; active?: boolean | null }[]) {
  const next = milestones.filter((m) => m.active !== false && m.threshold > confirmed).sort((a, b) => a.threshold - b.threshold)[0]
  return next ? { ...next, toGo: next.threshold - confirmed } : null
}

export const DEFAULT_MILESTONES = [
  { threshold: 2, rewardName: 'Free kit', rewardType: 'physical_item', sizes: '120, 130, 140, 150, 160, S, M, L, XL, 2XL', sortOrder: 1 },
  { threshold: 4, rewardName: 'Free bag', rewardType: 'physical_item', sizes: '', sortOrder: 2 },
  { threshold: 6, rewardName: 'Free hoodie', rewardType: 'physical_item', sizes: '120, 130, 140, 150, 160, S, M, L, XL, 2XL', sortOrder: 3 },
  { threshold: 8, rewardName: 'Free 1-on-1 session', rewardType: 'one_on_one_credit', sizes: '', sortOrder: 4 },
  { threshold: 10, rewardName: 'Free Academy term', rewardType: 'academy_term_credit', sizes: '', sortOrder: 5 },
] as const
