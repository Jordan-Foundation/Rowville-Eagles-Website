import { cardPrice, formatAUD } from '@/lib/format'
import type { Program } from '@/payload-types'

/** Small "from" + large price + small "/ session". */
export function PriceTag({ p, className = '', big = 'text-2xl' }: { p: Pick<Program, 'type' | 'price' | 'pricePerSession' | 'twoNightPricePerSession'>; className?: string; big?: string }) {
  const c = cardPrice(p)
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
      {c.from && <span className="text-xs font-medium uppercase tracking-wider opacity-70">from</span>}
      <span className={`${big} font-semibold leading-none`}>{formatAUD(c.amount)}</span>
      {c.unit && <span className="text-xs font-medium opacity-70">{c.unit}</span>}
    </span>
  )
}
