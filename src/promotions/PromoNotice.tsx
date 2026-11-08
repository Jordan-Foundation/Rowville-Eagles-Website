import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { covers, discountLabel, usable, type Target } from './rules'
import { promosFor, usesFor } from './service'

/**
 * "Your offer: Winter special — 20% off. It's taken off automatically at checkout." Shown on booking pages to a
 * logged-in family who received a live promotion covering what's on the page. Nothing shows otherwise.
 */
export async function PromoNotice({ targets, tone = 'light' }: { targets: Target[]; tone?: 'light' | 'dark' }) {
  const user = await currentUser()
  if (!user) return null
  const pl = await payload()
  const all = await promosFor(pl, user.id)
  const uses = await usesFor(pl, user.id, all.map((x) => x.id))
  const promos = all.filter((p) => usable(p, uses.get(p.id) ?? 0) && targets.some((t) => covers(p, t)))
  if (!promos.length) return null
  const best = promos.sort((a, b) => (b.type === a.type ? b.value - a.value : 0))[0]
  return (
    <div role="note" className={`rounded-xl border px-4 py-3 text-sm ${tone === 'dark' ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100' : 'border-emerald-300 bg-emerald-50 text-emerald-950'}`}>
      <strong>Your offer: {best.name} — {discountLabel(best)}.</strong> It’s taken off automatically when you pay{best.endsAt ? ` (until ${formatDate(best.endsAt, { day: 'numeric', month: 'long' })})` : ''}
      {best.usesPerFamily ? ` · ${best.usesPerFamily === 1 ? 'one use' : `${best.usesPerFamily} uses`} per family` : ''}.
    </div>
  )
}
