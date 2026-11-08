import type { Payload } from 'payload'
import { formatAUD } from '../lib/format'
import { PROGRAM_GROUPS } from './rules'

export type PickItem = { id: number; label: string; hint?: string }
export type Pickables = {
  terms: PickItem[]
  programsByGroup: { group: string; label: string; items: PickItem[] }[]
  products: PickItem[]
  rounds: PickItem[]
}

const q = { depth: 0, overrideAccess: true } as const
const typeName: Record<string, string> = { 'holiday-camp': 'Holiday camps', 'academy-term': 'Academy group terms', toddler: 'Mini Ballers', 'academy-trial': 'Academy trial sessions', registration: 'Season registrations', tournament: 'Tournaments', other: 'Other programs' }

/** Everything on the website that costs money, for the "What it applies to" picker. */
export async function loadPickables(p: Payload): Promise<Pickables> {
  const [terms, programs, products, rounds] = await Promise.all([
    p.find({ collection: 'academy-terms', where: { status: { not_equals: 'closed' } }, sort: 'startDate', limit: 20, ...q }),
    p.find({ collection: 'programs', where: { status: { not_equals: 'closed' }, type: { not_in: ['community', 'private-session', 'tournament'] } }, sort: 'startDate', limit: 200, ...q }),
    p.find({ collection: 'products', where: { status: { equals: 'active' } }, sort: 'name', limit: 500, ...q }),
    p.find({ collection: 'selection-rounds', where: { kind: { equals: 'tournament' }, status: { not_equals: 'closed' } }, sort: '-createdAt', limit: 50, ...q }),
  ])
  const grouped = new Map<string, PickItem[]>()
  const known = new Set<string>(PROGRAM_GROUPS.map((g) => g.value))
  for (const x of programs.docs) {
    const g = known.has(x.type) ? x.type : 'other'
    const price = x.pricePerSession != null ? `${formatAUD(x.pricePerSession)} / session` : formatAUD(x.price ?? 0)
    grouped.set(g, [...(grouped.get(g) ?? []), { id: x.id, label: x.title, hint: [price, x.status].filter(Boolean).join(' · ') }])
  }
  return {
    terms: terms.docs.map((t) => ({ id: t.id, label: t.name, hint: `casual ${formatAUD(t.casualPrice)} · term ${formatAUD(t.pricePerSession)} / session` })),
    programsByGroup: [...PROGRAM_GROUPS.map((g) => g.value), 'other'].filter((g, i, a) => a.indexOf(g) === i).map((g) => ({ group: g, label: typeName[g] ?? g, items: grouped.get(g) ?? [] })),
    products: products.docs.map((x) => ({ id: x.id, label: x.name, hint: formatAUD(x.price) })),
    rounds: rounds.docs.map((r) => ({ id: r.id, label: r.title, hint: r.fee != null ? formatAUD(r.fee) : undefined })),
  }
}
