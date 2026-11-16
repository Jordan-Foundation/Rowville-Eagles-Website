'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  ['/management/finance', 'Overview'],
  ['/management/finance/income', 'Income'],
  ['/management/finance/coaches', 'Coach hours & pay'],
  ['/management/finance/expenses', 'Expenses'],
  ['/management/finance/projections', 'Projections'],
  ['/management/finance/settings', 'Settings'],
] as const

export function FinanceTabs() {
  const path = usePathname()
  return (
    <nav aria-label="Finance" className="flex flex-wrap gap-2">
      {TABS.map(([href, label]) => {
        const on = href === '/management/finance' ? path === href : path.startsWith(href)
        return <Link key={href} href={href} aria-current={on ? 'page' : undefined} className={`min-h-10 border px-3 py-2 text-sm ${on ? 'border-white bg-white text-black' : 'border-line text-muted hover:text-ink'}`}>{label}</Link>
      })}
    </nav>
  )
}
