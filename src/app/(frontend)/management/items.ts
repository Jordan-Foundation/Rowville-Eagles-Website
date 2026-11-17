import type { DashItem } from '@/components/dashboard/DashboardGrid'

/** Management dashboard sections; keys match the badge counts in src/lib/attention.ts. */
/** Shown to admins only. */
export const ADMIN_ONLY = new Set(['refunds', 'finance'])

export const managementItems: DashItem[] = [
  { key: 'programs', href: '/management/programs', label: 'Programs Overview', icon: 'chart' },
  { key: 'yearly', href: '/management/yearly-setup', label: 'Yearly setup', icon: 'calendar', hint: 'Next year’s terms & holidays' },
  { key: 'dates', href: '/management/dates', label: 'Set dates', icon: 'calendar' },
  { key: 'prices', href: '/management/prices', label: 'Set prices', icon: 'dollar' },
  { key: 'finance', href: '/management/finance', label: 'Finance', icon: 'dollar', hint: 'Income, coach pay, expenses' },
  { key: 'invoices', href: '/management/invoices', label: 'Invoices', icon: 'dollar', hint: 'Charge after the fact' },
  { key: 'refunds', href: '/management/refunds', label: 'Refunds', icon: 'card', hint: 'Admins only' },
  { key: 'bookings', href: '/management/academy/bookings', label: 'Bookings & cancellations', icon: 'booking' },
  { key: 'payments', href: '/management/academy#payments', label: 'Weekly payments', icon: 'card' },
  { key: 'cover', href: '/management/academy#cover', label: 'Cover', icon: 'swap' },
  { key: 'coaches', href: '/management/coaches', label: 'Coaches', icon: 'users', hint: 'Add coaches, check WWCC' },
  { key: 'availability', href: '/management/academy', label: 'Coach availability', icon: 'clock' },
  { key: 'terms', href: '/management/academy/terms', label: 'Academy terms', icon: 'grid' },
  { key: 'camps', href: '/management/camps', label: 'Holiday camps', icon: 'users', hint: 'Groups & coaches' },
  { key: 'selections', href: '/management/selections', label: 'Selections', icon: 'flag' },
  { key: 'teams', href: '/management/teams', label: 'Teams', icon: 'users' },
  { key: 'messages', href: '/management/messages', label: 'Messages', icon: 'chat' },
  { key: 'notifications', href: '/management/notifications', label: 'Notifications', icon: 'bell', hint: 'Bookings, payments, trials' },
  { key: 'broadcast', href: '/management/broadcast', label: 'Email a group', icon: 'megaphone', hint: 'Group, team or report round' },
  { key: 'promotions', href: '/management/promotions', label: 'Promotions', icon: 'megaphone' },
  { key: 'reflections', href: '/management/reflections', label: 'Match reflections', icon: 'report', hint: 'Dashboard, welfare & AI reports' },
  { key: 'referrals', href: '/management/referrals', label: 'Referrals', icon: 'users', hint: 'Refer a Friend & rewards' },
  { key: 'announcements', href: '/management/announcements', label: 'Announcements', icon: 'megaphone', hint: 'Registrations open' },
  { key: 'foundation', href: '/management/foundation-plus', label: 'Foundation+', icon: 'star' },
  { key: 'store', href: '/management/store', label: 'Store', icon: 'bag' },
  { key: 'reports', href: '/management/reports', label: 'Reports', icon: 'report', hint: 'Player reports' },
  { key: 'curriculum', href: '/management/curriculum', label: 'Curriculum', icon: 'board' },
  { key: 'consent', href: '/management/consent', label: 'Consent review', icon: 'shield' },
  { key: 'settings', href: '/admin', label: 'Settings', icon: 'gear', hint: 'Admin, setup checklist' },
]

const by = (keys: string[]) => keys.map((k) => managementItems.find((i) => i.key === k)!)

/** The dashboard shows these 6 categories (plus a "Needs attention" list); each opens a page with its buttons. */
export type ManagementSection = { key: string; label: string; hint: string; icon: string; items: DashItem[]; href?: string }
export const managementSections: ManagementSection[] = [
  { key: 'academy', label: 'Academy & coaches', hint: 'Coaches, terms, cover, bookings', icon: 'grid', items: by(['coaches', 'availability', 'terms', 'cover', 'bookings', 'payments', 'reports', 'curriculum']) },
  { key: 'programs', label: 'Programs & camps', hint: 'Camps, dates, prices, setup', icon: 'calendar', items: by(['programs', 'camps', 'dates', 'prices', 'yearly']) },
  { key: 'families', label: 'Families & messages', hint: 'Messages, emails, reflections', icon: 'chat', items: by(['messages', 'notifications', 'broadcast', 'announcements', 'promotions', 'referrals', 'reflections', 'consent']) },
  { key: 'money', label: 'Money & shop', hint: 'Finance, invoices, store', icon: 'dollar', items: by(['finance', 'invoices', 'refunds', 'store', 'foundation']) },
  { key: 'club', label: 'Club teams', hint: 'Selections & teams', icon: 'flag', items: by(['selections', 'teams']) },
  { key: 'settings', label: 'Settings', hint: 'Admin & checklist', icon: 'gear', items: by(['settings']), href: '/admin' },
]

/** Sections and their buttons for this person (Finance and Refunds are admins only). */
export const sectionsFor = (admin: boolean) => managementSections.map((s) => ({ ...s, items: s.items.filter((i) => admin || !ADMIN_ONLY.has(i.key)) }))
