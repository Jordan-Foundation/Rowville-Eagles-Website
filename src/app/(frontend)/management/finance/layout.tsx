import { requireFinance } from '@/finance/access'
import { FinanceTabs } from './FinanceTabs'

/** Finance (admins only): Overview · Income · Coach hours & pay · Expenses · Projections · Settings. */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireFinance()
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Finance</h1>
        <p className="mt-2 text-sm text-muted">Admins only. AUD · Melbourne time.</p>
      </div>
      <FinanceTabs />
      {children}
    </div>
  )
}
