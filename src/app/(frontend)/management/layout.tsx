import Link from 'next/link'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { managementAttention } from '@/lib/attention'
import { Breadcrumbs, ManagementNav, type NavGroup } from '@/components/management/ManagementChrome'
import { sectionsFor } from './items'

/** The menu follows the dashboard categories (items.ts), with a few extra pages that have no dashboard button. */
const navGroups = (admin: boolean): NavGroup[] => {
  const sections = sectionsFor(admin)
  const extras: Record<string, { href: string; label: string }[]> = {
    academy: [{ href: '/management/programs/setup', label: 'Program setup' }],
    settings: [{ href: '/management/activity', label: 'Activity log' }],
  }
  const solo = sections.filter((s) => s.href).map((s) => ({ href: s.items[0].href, label: s.items[0].label, key: s.items[0].key }))
  return [
    { title: 'Overview', items: [{ href: '/management', label: 'Dashboard' }, ...solo, { href: '/management/search', label: 'Find a family or player' }, { href: '/management/guide', label: 'How to run a term' }] },
    ...sections.filter((s) => !s.href).map((s) => ({ title: s.label, items: [...s.items.map((i) => ({ href: i.href, label: i.label, key: i.key })), ...(extras[s.key] ?? [])] })),
  ]
}

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
      <ManagementNav groups={navGroups(Boolean(user.roles?.includes('admin')))} counts={counts} />
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
