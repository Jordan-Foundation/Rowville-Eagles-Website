import type { CollectionAfterChangeHook, CollectionConfig, GlobalAfterChangeHook, GlobalConfig } from 'payload'

/** Who changed which price, date or promotion, and when (shown in Management → Activity). */

type Track = { area: string; title: (doc: Record<string, unknown>) => string; fields: Record<string, string> }

export const TRACKED: Record<string, Track> = {
  programs: { area: 'Programs', title: (d) => String(d.title ?? 'Program'), fields: { title: 'Name', status: 'Status', price: 'Price', pricePerSession: 'Per session (1 night)', twoNightPricePerSession: 'Per session (2 nights)', startDate: 'Starts', endDate: 'Finishes', capacity: 'Places', minAge: 'Min age', maxAge: 'Max age' } },
  'academy-terms': { area: 'Academy terms', title: (d) => String(d.name ?? 'Term'), fields: { name: 'Name', status: 'Status', startDate: 'First day', endDate: 'Last day', availabilityDeadline: 'Availability due', casualPrice: 'Casual 1-on-1 price', pricePerSession: 'Term 1-on-1 per session', termMemberPrice: 'Term-member casual price' } },
  products: { area: 'Shop', title: (d) => String(d.name ?? 'Item'), fields: { name: 'Name', price: 'Price', status: 'Status' } },
  promotions: { area: 'Promotions', title: (d) => String(d.name ?? 'Promotion'), fields: { name: 'Name', status: 'Status', type: 'Discount type', value: 'Discount', usesPerFamily: 'Uses per family', startsAt: 'Starts', endsAt: 'Ends' } },
  'report-cycles': { area: 'Player reports', title: (d) => String(d.name ?? 'Report round'), fields: { name: 'Name', dueDate: 'Coach due date', status: 'Status' } },
  'selection-rounds': { area: 'Selections', title: (d) => String(d.title ?? 'Round'), fields: { title: 'Name', status: 'Status', fee: 'Fee', paymentDeadlineDays: 'Days to pay' } },
  teams: { area: 'Teams', title: (d) => String(d.name ?? 'Team'), fields: { name: 'Name', ageGroup: 'Age group', competition: 'Competition', archived: 'Archived', trainingTimes: 'Training (summary)' } },
}
export const TRACKED_GLOBALS: Record<string, Track> = {
  'site-settings': { area: 'Club settings', title: () => 'Site settings', fields: { season: 'Season year', email: 'Club email' } },
}

/** A value as people read it: dates in Melbourne time, money-ish numbers plain, empty as "—". */
export function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(v))
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 120)
  return String(v)
}

/** What changed between two versions of a document, for the watched fields (pure — unit tested). */
export function diff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown>, fields: Record<string, string>) {
  return Object.entries(fields)
    .filter(([k]) => show(before?.[k]) !== show(after[k]))
    .map(([k, label]) => ({ field: k, label, from: before ? show(before[k]) : '—', to: show(after[k]) }))
}

async function record(req: Parameters<CollectionAfterChangeHook>[0]['req'], o: { area: string; what: string; collection: string; docId?: string | number; changes: ReturnType<typeof diff>; action: string }) {
  if (!o.changes.length) return
  if (req.context?.skipActivity) return
  try {
    await req.payload.create({
      collection: 'activity-log',
      overrideAccess: true,
      req,
      context: { skipActivity: true },
      data: { area: o.area, what: o.what, action: o.action, source: o.collection, docId: o.docId != null ? String(o.docId) : undefined, by: req.user && req.user.collection === 'users' ? req.user.id : undefined, byName: req.user ? String((req.user as { firstName?: string; email?: string }).firstName || (req.user as { email?: string }).email || '') : 'System', changes: o.changes },
    })
  } catch (e) {
    req.payload.logger.error({ err: e, msg: 'Activity log failed' })
  }
}

export function withActivity(c: CollectionConfig): CollectionConfig {
  const t = TRACKED[c.slug]
  if (!t) return c
  const hook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
    await record(req, { area: t.area, what: t.title(doc), collection: c.slug, docId: doc.id, action: operation === 'create' ? 'Created' : 'Changed', changes: diff(operation === 'create' ? null : previousDoc, doc, t.fields) })
    return doc
  }
  return { ...c, hooks: { ...c.hooks, afterChange: [...(c.hooks?.afterChange ?? []), hook] } }
}

export function withGlobalActivity(g: GlobalConfig): GlobalConfig {
  const t = TRACKED_GLOBALS[g.slug]
  if (!t) return g
  const hook: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
    await record(req as never, { area: t.area, what: t.title(doc), collection: g.slug, action: 'Changed', changes: diff(previousDoc, doc, t.fields) })
    return doc
  }
  return { ...g, hooks: { ...g.hooks, afterChange: [...(g.hooks?.afterChange ?? []), hook] } }
}
