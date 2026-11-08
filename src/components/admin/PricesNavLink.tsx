import Link from 'next/link'

/** Shown in the admin side menu and on the dashboard. */
export function PricesNavLink() {
  return (
    <Link href="/admin/prices" className="nav__link" style={{ display: 'block', padding: '6px 0', fontWeight: 600 }}>
      💲 Prices
    </Link>
  )
}

export function PdrNavLink() {
  return (
    <Link href="/admin/pdr" className="nav__link" style={{ display: 'block', padding: '6px 0', fontWeight: 600 }}>
      🎯 Foundation+ content map
    </Link>
  )
}

export function PricesDashboardCard() {
  return (
    <div style={{ marginBottom: 24, padding: '14px 18px', border: '1px solid var(--theme-elevation-150)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <span>
        <strong>Prices</strong> — change 1-on-1, Academy term, program, tournament and shop prices in one place.
      </span>
      <Link href="/admin/prices" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }}>
        Open prices
      </Link>
    </div>
  )
}

export function SetupNavLink() {
  return (
    <Link href="/admin/setup" className="nav__link" style={{ display: 'block', padding: '6px 0', fontWeight: 600 }}>
      ✅ Setup checklist
    </Link>
  )
}

export function FoundationPlusNavLink() {
  return (
    <Link href="/management/programs?program=foundation-plus" className="nav__link" style={{ display: 'block', padding: '6px 0', fontWeight: 600 }}>
      📈 Foundation+ dashboard
    </Link>
  )
}
