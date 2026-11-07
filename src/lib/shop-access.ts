import type { Payload } from 'payload'
import type { Product } from '@/payload-types'
import { accountMemberships } from './accounts'

export type Audience = 'everyone' | 'rowville' | 'rfa' | 'foundation-plus'

export const AUDIENCE_LABELS: Record<Audience, string> = {
  everyone: 'Everyone',
  rowville: 'Registered Rowville players',
  rfa: 'RFA players',
  'foundation-plus': 'Foundation+ members',
}

/** Who is looking: their player tags, the teams they're on (or coach) and their account id. */
export type ShopViewer = { userId: number | null; groups: Set<Audience>; teams: Set<number> }

type Rules = Pick<Product, 'audiences' | 'teams' | 'accounts'>

const ids = (v: unknown) =>
  (Array.isArray(v) ? v : []).map((x) => (typeof x === 'object' && x ? (x as { id: number }).id : (x as number))).filter((x) => typeof x === 'number')

/** True when the item has no restrictions at all (supporter gear) — the only items in the public sitemap. */
export function isPublicItem(p: Rules) {
  return (p.audiences ?? []).includes('everyone')
}

/**
 * Can this viewer buy the item? Any one match is enough:
 * "Everyone", a group tag on one of their players, a team they're on (or coach), or their account listed by name.
 */
export function canBuy(p: Rules, v: ShopViewer) {
  const audiences = (p.audiences ?? []) as Audience[]
  if (audiences.includes('everyone')) return true
  if (audiences.some((a) => v.groups.has(a))) return true
  if (ids(p.teams).some((t) => v.teams.has(t))) return true
  return v.userId != null && ids(p.accounts).includes(v.userId)
}

/** Short "who it's for" line shown on locked items. */
export function lockedLabel(p: Rules) {
  const audiences = ((p.audiences ?? []) as Audience[]).filter((a) => a !== 'everyone')
  if (audiences.includes('foundation-plus') && audiences.length === 1 && !ids(p.teams).length) return 'Foundation+ members only'
  if (audiences.length === 1 && !ids(p.teams).length && !ids(p.accounts).length) return audiences[0] === 'rfa' ? 'For RFA players' : 'For registered Rowville players'
  if (ids(p.teams).length && !audiences.length) return 'Team members only'
  return 'Members only'
}

export async function shopViewer(payload: Payload, userId?: number | null): Promise<ShopViewer> {
  if (!userId) return { userId: null, groups: new Set(), teams: new Set() }
  const [tags, members, coached] = await Promise.all([
    accountMemberships(payload, userId),
    payload.find({ collection: 'team-members', where: { account: { equals: userId }, active: { equals: true } }, depth: 0, limit: 100, overrideAccess: true, select: { team: true } }),
    payload.find({ collection: 'teams', where: { coaches: { in: [userId] }, archived: { not_equals: true } }, depth: 0, limit: 50, overrideAccess: true, select: { name: true } }),
  ])
  const teams = new Set<number>([...ids(members.docs.map((m) => m.team)), ...coached.docs.map((t) => t.id)])
  return { userId, groups: new Set([...tags].filter((t) => t in AUDIENCE_LABELS) as Audience[]), teams }
}

export type ShopItemAccess = { canBuy: boolean; label: string; foundationPlus: boolean }

/**
 * What one viewer gets for each item: buyable, shown locked, or left out (null).
 * Foundation+-only items are left out while Foundation+ is switched off (nobody can join yet).
 */
export function itemAccess(p: Rules & { othersSee?: Product['othersSee'] }, v: ShopViewer, foundationLive: boolean): ShopItemAccess | null {
  const fplusOnly = ((p.audiences ?? []) as Audience[]).includes('foundation-plus')
  if (canBuy(p, v)) return { canBuy: true, label: '', foundationPlus: fplusOnly }
  if (p.othersSee === 'hidden') return null
  const others = ((p.audiences ?? []) as Audience[]).filter((a) => a !== 'foundation-plus').length + ids(p.teams).length + ids(p.accounts).length
  if (fplusOnly && !others && !foundationLive) return null
  return { canBuy: false, label: lockedLabel(p), foundationPlus: fplusOnly }
}
