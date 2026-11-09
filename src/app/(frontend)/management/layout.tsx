import Link from 'next/link'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { managementAttention } from '@/lib/attention'
import { Breadcrumbs, ManagementNav, type NavGroup } from '@/components/management/ManagementChrome'

const GROUPS: NavGroup[] = [
  { title: 'Overview', items: [{ href: '/management', label: 'Dashboard' }, { href: '/management/programs', label: 'Programs Overview' }, { href: '/management/programs/setup', label: 'Program setup' }, { href: '/management/search', label: 'Find a family or player' }, { href: '/management/guide', label: 'How to run a term' }] },
  { title: 'Families', items: [{ href: '/management/messages', label: 'Messages', key: 'messages' }, { href: '/management/broadcast', label: 'Email a group' }, { href: '/management/academy/bookings', label: 'Bookings & cancellations', key: 'bookings' }, { href: '/management/consent', label: 'Consent review', key: 'consent' }] },
  { title: 'Academy', items: [{ href: '/management/academy', label: 'Payments, cover & availability', key: 'cover' }, { href: '/management/academy/terms', label: 'Academy terms', key: 'terms' }, { href: '/management/reports', label: 'Player reports', key: 'reports' }, { href: '/management/curriculum', label: 'Curriculum' }] },
  { title: 'Club', items: [{ href: '/management/selections', label: 'Selections', key: 'selections' }, { href: '/management/teams', label: 'Teams' }] },
  { title: 'Money & setup', items: [{ href: '/management/money', label: 'Money summary' }, { href: '/management/dates', label: 'Set dates', key: 'dates' }, { href: '/management/prices', label: 'Set prices' }, { href: '/management/promotions', label: 'Promotions', key: 'promotions' }, { href: '/management/foundation-plus', label: 'Foundation+', key: 'foundation' }, { href: '/management/store', label: 'Store', key: 'store' }, { href: '/management/activity', label: 'Activity log' }, { href: '/admin', label: 'Admin & settings', key: 'settings' }] },
]

/**
 * Management area: its own menu (sidebar / phone menu), breadcrumbs and search, in one colour scheme,
 * instead of the public website header and footer. Pages still check access themselves.
 */
export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
  const user = await managementOrNull()
  if (!user) return <>{children}</>
  const counts = (await managementAttention(await payload(), user).catch(() => ({}))) as Record<string, number>
  return (
    <div data-brand="academy" data-page-brand="academy" data-portal="management" className="min-h-screen bg-surface text-ink lg:flex">
      <ManagementNav groups={GROUPS} counts={counts} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2 text-xs text-muted sm:px-8">
          <span>Signed in as {user.firstName || user.email}</span>
          <span className="flex gap-4"><Link href="/" className="underline hover:text-ink">View website</Link><Link href="/account?view=family" className="underline hover:text-ink">My family account</Link></span>
        </div>
        <div className="px-4 pt-5 sm:px-8">
          <Breadcrumbs />
        </div>
        <div className="px-4 pb-16 sm:px-8">{children}</div>
      </div>
    </div>
  )
}
