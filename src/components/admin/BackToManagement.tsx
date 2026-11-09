import Link from 'next/link'

/** Top of the admin side menu: back to the Management area (where everyday jobs live). */
export function BackToManagement() {
  return (
    <Link href="/management" className="nav__link" style={{ display: 'block', padding: '8px 0 14px', fontWeight: 700 }}>
      ← Back to Management
    </Link>
  )
}
