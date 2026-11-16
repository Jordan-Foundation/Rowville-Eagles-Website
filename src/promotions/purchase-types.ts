/**
 * "Has bought this type of session" tags (pure — unit tested). Families get every tag that matches
 * something they've paid for, so promotions can target e.g. everyone who's done a holiday camp.
 */
export const PURCHASE_TYPES = [
  { key: 'type:1on1', label: '1-on-1 sessions' },
  { key: 'type:small-group', label: 'Small group sessions' },
  { key: 'type:holiday-pack', label: 'Holiday 1-on-1 packs' },
  { key: 'type:academy-term', label: 'Academy term training' },
  { key: 'type:mini-ballers', label: 'Mini Ballers' },
  { key: 'type:camp', label: 'Holiday camps' },
  { key: 'type:academy-trial', label: 'Academy trial sessions' },
  { key: 'type:club-trial', label: 'Rowville Eagles trials' },
  { key: 'type:club-registration', label: 'Rowville Eagles registration' },
  { key: 'type:tournament', label: 'Tournaments' },
  { key: 'type:shop', label: 'Shop orders' },
  { key: 'type:invoice', label: 'Paid invoices' },
] as const

export type PurchaseType = (typeof PURCHASE_TYPES)[number]['key']

/** The tag for a camp / program / trial booking. */
export function bookingPurchaseType(b: { bookingType?: string | null }, programType?: string | null): PurchaseType | null {
  if (b.bookingType === 'trial') return 'type:academy-trial'
  switch (programType) {
    case 'holiday-camp': return 'type:camp'
    case 'academy-term':
    case 'academy-year': return 'type:academy-term'
    case 'toddler': return 'type:mini-ballers'
    case 'registration': return 'type:club-registration'
    case 'tournament': return 'type:tournament'
    case 'academy-trial': return 'type:academy-trial'
    default: return null
  }
}

/** The tag for a 1-on-1 / small group booking. */
export const academyPurchaseType = (b: { kind?: string | null; packSize?: number | null }): PurchaseType => (b.kind === 'group' ? 'type:small-group' : b.packSize ? 'type:holiday-pack' : 'type:1on1')

export const purchaseTypeLabel = (key: string) => PURCHASE_TYPES.find((t) => t.key === key)?.label ?? key
