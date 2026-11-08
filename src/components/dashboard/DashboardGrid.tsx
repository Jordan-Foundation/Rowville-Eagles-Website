import Link from 'next/link'
import { DashIcon } from './icons'
import { badgeLabel, badgeText } from './badge'

export type DashItem = { key: string; href: string; label: string; icon: string; hint?: string; count?: number }

/** Big, high-contrast section buttons with an attention badge in the top-right corner. Wraps into a grid on phones. */
export function DashboardGrid({ items, counts }: { items: DashItem[]; counts?: Record<string, number> }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((i) => {
        const n = counts?.[i.key] ?? i.count
        const b = badgeText(n)
        return (
          <li key={i.key}>
            <Link
              href={i.href}
              aria-label={badgeLabel(i.label, n)}
              data-dash={i.key}
              className="relative flex h-full min-h-28 flex-col justify-between gap-3 border border-line bg-surface p-4 transition hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-32 sm:p-5"
            >
              <DashIcon name={i.icon} />
              <span>
                <span className="block font-display text-lg font-semibold uppercase leading-tight tracking-tight sm:text-xl">{i.label}</span>
                {i.hint && <span className="mt-0.5 block text-xs text-muted">{i.hint}</span>}
              </span>
              {b && (
                <span aria-hidden className="absolute -right-2 -top-2 grid h-7 min-w-7 place-items-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white ring-2 ring-surface">
                  {b}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
